/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isScopedQualityFallbackOverride, normalizeSavedQualityPreferences, resolveAcquisitionQualityProfileCode } from '../acquisition/acquisition-quality-evidence-policy.js';
import { createOperatorTrackScopeVerificationService } from '../metadata/operator-track-scope-verification-service.js';
import { getOperatorTrackRequirements, refuseOperatorTrackFiles } from '../metadata/operator-track-file-policy.js';
import { applyQualityReviewSearchRequirement, QUALITY_REVIEW_SEARCH_REASON } from './library-quality-review-search-policy.js';

const PROFILE_PRIORITY = { any_available: 0, high_quality: 1, lossless_archive: 2 };

export function buildSharedFormatPreferences(profileCode, fallbackOverrideActive = false, minimumBitrateKbps = 256) {
  if (fallbackOverrideActive) return { minimumQuality: 'high', preferredFormat: 'any', minimumBitrateKbps };
  if (profileCode === 'lossless_archive') return { minimumQuality: 'lossless', preferredFormat: 'flac' };
  if (profileCode === 'high_quality') return { minimumQuality: 'high', preferredFormat: 'any' };
  return { minimumQuality: 'any', preferredFormat: 'any' };
}

function normalizeLinks(value) {
  const ids = new Set();
  return (Array.isArray(value) ? value : []).filter((link) => {
    if (typeof link?.appUserId !== 'string' || typeof link?.wantedReleaseId !== 'string' || ids.has(link.wantedReleaseId)) return false;
    ids.add(link.wantedReleaseId);
    return true;
  });
}

function hasKnownRequirement(explicitProfile, preferences) {
  if (explicitProfile != null) return Object.hasOwn(PROFILE_PRIORITY, explicitProfile);
  return normalizeSavedQualityPreferences(preferences) != null;
}

export function createLibraryDiscoveryQualityContextService({ getUserPreferencesFn = null,
  trackScopeVerifier = createOperatorTrackScopeVerificationService() } = {}) {
  async function readPreferences(userId) {
    if (!userId || typeof getUserPreferencesFn !== 'function') return null;
    try { return await getUserPreferencesFn({ userId }); } catch { return null; }
  }

  async function resolveCurrentSharedDiscoveryQualityContext(claimedRequest, { queryable = null } = {}) {
    const links = normalizeLinks(claimedRequest?.operatorLinks);
    const sharedExplicitProfile = claimedRequest?.evidence?.qualityProfile ?? claimedRequest?.evidence?.acquisitionProfile ?? null;
    const operatorTrackScopes = links.filter(link => Object.hasOwn(link, 'operatorTrackScope'))
      .map(link => ({ wantedReleaseId: link.wantedReleaseId, scope: link.operatorTrackScope }));
    if (claimedRequest?.metadataReleaseId && operatorTrackScopes.some(entry => entry.scope?.metadataReleaseId !== claimedRequest.metadataReleaseId)) {
      await trackScopeVerifier.assertScopesCurrent([{ scope: null }], { queryable });
    }
    if (operatorTrackScopes.length === 0 && Object.hasOwn(claimedRequest?.evidence ?? {}, 'operatorTrackScope')) {
      operatorTrackScopes.push({ mediaRequestId: claimedRequest.evidence.sourceMediaRequestId, scope: claimedRequest.evidence.operatorTrackScope });
    }
    if (operatorTrackScopes.length > 0) await trackScopeVerifier.assertScopesCurrent(operatorTrackScopes, { queryable });
    let operatorTrackParticipants = null;
    if (operatorTrackScopes.some(entry => entry.scope?.mode === 'tracks')) {
      const tracks = getOperatorTrackRequirements(operatorTrackScopes);
      if (!claimedRequest?.evidence?.sourceMediaRequestId || !claimedRequest?.evidence?.sourceRequestedForUserId) throw refuseOperatorTrackFiles();
      if (links.length > 0 && links.some(link => !Object.hasOwn(link, 'operatorTrackScope') || link.isDisabled === true)) throw refuseOperatorTrackFiles();
      if (tracks.length === 2) operatorTrackParticipants = await trackScopeVerifier.resolveDiscoveryParticipants(claimedRequest, { queryable });
    }
    if (links.length === 0) {
      const preferences = await readPreferences(claimedRequest?.evidence?.sourceRequestedForUserId ?? claimedRequest?.evidence?.sourceRequestedByUserId);
      const profileCode = resolveAcquisitionQualityProfileCode({ explicitProfile: sharedExplicitProfile, userPreferences: preferences });
      const legacyOverride = claimedRequest?.evidence?.musicQueueQualityOverride;
      const wantedReleaseId = claimedRequest?.wantedReleaseId ?? legacyOverride?.wantedReleaseId ?? claimedRequest?.evidence?.musicQueueRediscovery?.wantedReleaseId ?? null;
      const qualityOverride = isScopedQualityFallbackOverride(legacyOverride, wantedReleaseId) ? legacyOverride : null;
      return { profileCode, qualityOverride, ...(wantedReleaseId ? { wantedReleaseId } : {}), sharedOperatorDiscovery: false,
        ...(operatorTrackScopes.length > 0 ? { operatorTrackScopes } : {}),
        ...(preferences?.minimumQuality === 'high' ? { minimumBitrateKbps: 320 } : {}),
        formatPreferences: qualityOverride ? buildSharedFormatPreferences(profileCode, true, preferences?.minimumQuality === 'high' ? 320 : 256)
          : preferences ? { minimumQuality: preferences.minimumQuality, preferredFormat: preferences.preferredFormat } : null,
        preferredFormat: qualityOverride ? 'any' : preferences?.preferredFormat ?? null };
    }

    const requirements = await Promise.all(links.map(async (link) => {
      const preferences = link.qualityPreferences !== undefined ? link.qualityPreferences : await readPreferences(link.appUserId);
      const explicitProfile = link.qualityProfile ?? null;
      const profileCode = link.isDisabled === true ? 'lossless_archive'
        : resolveAcquisitionQualityProfileCode({ explicitProfile, userPreferences: preferences });
      const scopedFloor = isScopedQualityFallbackOverride(link.qualityOverride, link.wantedReleaseId)
        && typeof link.qualityOverride.minimumBitrateKbps === 'number' && Number.isFinite(link.qualityOverride.minimumBitrateKbps)
        && link.qualityOverride.minimumBitrateKbps >= 256 && link.qualityOverride.minimumBitrateKbps <= 10_000
        ? link.qualityOverride.minimumBitrateKbps : 0;
      return { link, profileCode, minimumBitrateKbps: Math.max(preferences?.minimumQuality === 'high' ? 320 : 256, scopedFloor),
        known: hasKnownRequirement(explicitProfile, preferences),
        hasConsent: link.isDisabled !== true && isScopedQualityFallbackOverride(link.qualityOverride, link.wantedReleaseId) };
    }));
    const profileCode = requirements.reduce((selected, requirement) => PROFILE_PRIORITY[requirement.profileCode] > PROFILE_PRIORITY[selected]
      ? requirement.profileCode : selected, 'any_available');
    const strictRequirements = requirements.filter((requirement) => requirement.profileCode === 'lossless_archive');
    const fallbackOverrideActive = strictRequirements.length > 0
      && strictRequirements.every((requirement) => requirement.known && requirement.hasConsent);
    const minimumBitrateKbps = Math.max(...requirements.map((requirement) => requirement.minimumBitrateKbps));
    const qualityOverride = fallbackOverrideActive ? { ...strictRequirements[0].link.qualityOverride,
      ...(minimumBitrateKbps > 256 ? { minimumBitrateKbps } : {}) } : null;
    const wantedReleaseIds = links.map((link) => link.wantedReleaseId);
    if (operatorTrackParticipants) {
      const primary = operatorTrackParticipants.find(owner => owner.ownerId === claimedRequest.evidence.sourceRequestedForUserId)?.wantedReleaseId;
      wantedReleaseIds.sort((a, b) => Number(b === primary) - Number(a === primary));
    }
    return { profileCode, qualityOverride, wantedReleaseId: wantedReleaseIds[0],
      ...(operatorTrackParticipants ? { operatorTrackParticipants } : {}),
      ...(operatorTrackScopes.length > 0 ? { operatorTrackScopes } : {}),
      ...(minimumBitrateKbps > 256 ? { minimumBitrateKbps } : {}),
      ...(wantedReleaseIds.length > 1 ? { wantedReleaseIds } : {}), sharedOperatorDiscovery: true,
      formatPreferences: buildSharedFormatPreferences(profileCode, fallbackOverrideActive, minimumBitrateKbps),
      preferredFormat: profileCode === 'lossless_archive' && !fallbackOverrideActive ? 'flac' : 'any' };
  }
  async function resolveSharedDiscoveryQualityContext(claimedRequest, options) {
    const current = await resolveCurrentSharedDiscoveryQualityContext(claimedRequest, options);
    const context = applyQualityReviewSearchRequirement(current, claimedRequest);
    const intent = claimedRequest?.evidence?.musicQueueRediscovery;
    if (intent?.reasonCode !== QUALITY_REVIEW_SEARCH_REASON && intent?.qualityReviewRequirement == null) return context;
    return { ...context, formatPreferences: { ...buildSharedFormatPreferences(context.profileCode, Boolean(context.qualityOverride), context.minimumBitrateKbps ?? 256),
      ...(context.minimumBitrateKbps ? { minimumBitrateKbps: context.minimumBitrateKbps } : {}) },
      preferredFormat: context.profileCode === 'lossless_archive' && !context.qualityOverride ? 'flac' : 'any' };
  }
  return { resolveSharedDiscoveryQualityContext };
}

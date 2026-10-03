/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isScopedQualityFallbackOverride, normalizeSavedQualityPreferences, resolveAcquisitionQualityProfileCode } from '../acquisition/acquisition-quality-evidence-policy.js';

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

export function createLibraryDiscoveryQualityContextService({ getUserPreferencesFn = null } = {}) {
  async function readPreferences(userId) {
    if (!userId || typeof getUserPreferencesFn !== 'function') return null;
    try { return await getUserPreferencesFn({ userId }); } catch { return null; }
  }

  async function resolveSharedDiscoveryQualityContext(claimedRequest) {
    const links = normalizeLinks(claimedRequest?.operatorLinks);
    const sharedExplicitProfile = claimedRequest?.evidence?.qualityProfile ?? claimedRequest?.evidence?.acquisitionProfile ?? null;
    if (links.length === 0) {
      const preferences = await readPreferences(claimedRequest?.evidence?.sourceRequestedForUserId ?? claimedRequest?.evidence?.sourceRequestedByUserId);
      const profileCode = resolveAcquisitionQualityProfileCode({ explicitProfile: sharedExplicitProfile, userPreferences: preferences });
      const legacyOverride = claimedRequest?.evidence?.musicQueueQualityOverride;
      const wantedReleaseId = claimedRequest?.wantedReleaseId ?? legacyOverride?.wantedReleaseId ?? claimedRequest?.evidence?.musicQueueRediscovery?.wantedReleaseId ?? null;
      const qualityOverride = isScopedQualityFallbackOverride(legacyOverride, wantedReleaseId) ? legacyOverride : null;
      return { profileCode, qualityOverride, ...(wantedReleaseId ? { wantedReleaseId } : {}), sharedOperatorDiscovery: false,
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
      return { link, profileCode, minimumBitrateKbps: preferences?.minimumQuality === 'high' ? 320 : 256,
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
    return { profileCode, qualityOverride, wantedReleaseId: wantedReleaseIds[0],
      ...(minimumBitrateKbps > 256 ? { minimumBitrateKbps } : {}),
      ...(wantedReleaseIds.length > 1 ? { wantedReleaseIds } : {}), sharedOperatorDiscovery: true,
      formatPreferences: buildSharedFormatPreferences(profileCode, fallbackOverrideActive, minimumBitrateKbps),
      preferredFormat: profileCode === 'lossless_archive' && !fallbackOverrideActive ? 'flac' : 'any' };
  }
  return { resolveSharedDiscoveryQualityContext };
}

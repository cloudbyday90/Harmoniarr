/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { QUALITY_DECISION_CODES, QUALITY_PROFILE_CODES } from './acquisition-quality-policy-service.js';

const PROFILE_CODES = new Set(Object.values(QUALITY_PROFILE_CODES));
const DECISION_CODES = new Set(Object.values(QUALITY_DECISION_CODES));
const AUDIO_FORMATS = new Set(['aac', 'alac', 'ape', 'flac', 'mp3', 'ogg', 'opus', 'wav', 'wave']);

export function normalizeQualityFormats(value) {
  return Array.isArray(value) ? [...new Set(value.filter((format) => typeof format === 'string')
    .map((format) => format.trim().toLowerCase()).filter((format) => AUDIO_FORMATS.has(format)))].slice(0, AUDIO_FORMATS.size) : [];
}

export function normalizeQualityBitrate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000 ? value : null;
}

export function resolveAcquisitionQualityProfileCode({ explicitProfile = null, userPreferences = null } = {}) {
  if (explicitProfile != null) return PROFILE_CODES.has(explicitProfile) ? explicitProfile : QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE;
  const preferences = normalizeSavedQualityPreferences(userPreferences);
  if (!preferences) return QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE;
  if (preferences.minimumQuality === 'lossless' || preferences.preferredFormat === 'flac') return QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE;
  if (preferences.minimumQuality === 'high' || ['mp3_320', 'mp3_v0'].includes(preferences.preferredFormat)) return QUALITY_PROFILE_CODES.HIGH_QUALITY;
  return QUALITY_PROFILE_CODES.ANY_AVAILABLE;
}

export function normalizeSavedQualityPreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const minimumQuality = Object.hasOwn(value, 'minimumQuality') ? value.minimumQuality : 'any';
  const preferredFormat = Object.hasOwn(value, 'preferredFormat') ? value.preferredFormat : 'any';
  return ['any', 'high', 'lossless'].includes(minimumQuality) && ['any', 'flac', 'mp3_320', 'mp3_v0'].includes(preferredFormat)
    ? { minimumQuality, preferredFormat } : null;
}

export function isScopedQualityFallbackOverride(value, wantedReleaseId) {
  return value?.mode === 'allow_fallback_quality' && typeof wantedReleaseId === 'string'
    && value.wantedReleaseId === wantedReleaseId;
}

export function isAwaitingRediscoveryQualityEvidence(release) {
  const request = release?.discoveryRequest;
  const observedAt = Date.parse(request?.evidence?.lastSearchResult?.observedAt);
  const dispatchedAt = Date.parse(request?.lastSearchAt);
  if (request?.requestStatus === 'cooldown' && Number.isFinite(dispatchedAt)
    && (!Number.isFinite(observedAt) || observedAt < dispatchedAt)) return true;
  const requestedAt = Date.parse(request?.evidence?.musicQueueRediscovery?.requestedAt);
  if (!Number.isFinite(requestedAt) || !['ready', 'cooldown'].includes(request?.requestStatus)) return false;
  return !Number.isFinite(observedAt) || observedAt < requestedAt;
}

export function evaluateReleaseQualityEvidence(release, qualityPolicyService) {
  const evidence = release.discoveryRequest?.evidence ?? {};
  const profileCode = resolveAcquisitionQualityProfileCode({
    explicitProfile: release.evidence?.qualityProfile ?? release.acquisitionProfile
      ?? (release.appUserId ? null : evidence.qualityProfile ?? null),
    userPreferences: release.qualityPreferences ?? null,
  });
  const workerQuality = evidence.lastSearchResult?.autoSelection?.quality;
  const candidate = isAwaitingRediscoveryQualityEvidence(release) ? {} : workerQuality
    ? { formats: normalizeQualityFormats(workerQuality.formats), bitrateKbps: normalizeQualityBitrate(workerQuality.bitrateKbps) }
    : evidence.bestCandidate ?? {};
  const qualityOverride = isScopedQualityFallbackOverride(release.discoveryQualityOverride, release.id)
    ? release.discoveryQualityOverride : null;
  return qualityPolicyService.evaluateQualityEvidence({ candidate,
    mediaVerification: isAwaitingRediscoveryQualityEvidence(release) || workerQuality ? {} : evidence.mediaVerification ?? {},
    profileCode, qualityOverride,
    minimumBitrateKbps: release.qualityPreferences?.minimumQuality === 'high' ? 320 : null });
}

export function buildPublicQualityEvidence(quality) {
  return {
    code: DECISION_CODES.has(quality?.code) ? quality.code : null,
    profileCode: PROFILE_CODES.has(quality?.profile?.code) ? quality.profile.code : null,
    formats: normalizeQualityFormats(quality?.formats),
    bitrateKbps: normalizeQualityBitrate(quality?.bitrateKbps),
    preferredFormats: normalizeQualityFormats(quality?.profile?.preferredFormats),
    minimumFormats: normalizeQualityFormats(quality?.profile?.minimumFormats),
    minimumBitrateKbps: normalizeQualityBitrate(quality?.profile?.minimumBitrateKbps),
    requiresVerification: quality?.profile?.requiresVerification === true,
    verifiedLossless: quality?.verifiedLossless === true,
    fallbackAllowed: quality?.profile?.fallbackAllowed === true,
    fallbackOverrideActive: quality?.fallbackOverrideActive === true,
  };
}

export function canAllowAcquisitionFallbackQuality(projectedRelease) {
  return projectedRelease?.status?.code === 'quality_choice_needed'
    && projectedRelease.evidence?.search?.searchMode === 'automatic'
    && ['blocked', 'cooldown'].includes(projectedRelease.evidence?.search?.status)
    && projectedRelease?.quality?.code === QUALITY_DECISION_CODES.BELOW_MINIMUM
    && projectedRelease.quality.profile?.code === QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE
    && projectedRelease.quality.fallbackOverrideActive !== true;
}

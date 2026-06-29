/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const QUALITY_PROFILE_CODES = Object.freeze({
  ANY_AVAILABLE: 'any_available',
  HIGH_QUALITY: 'high_quality',
  LOSSLESS_ARCHIVE: 'lossless_archive',
});

export const QUALITY_DECISION_CODES = Object.freeze({
  ACCEPTED: 'accepted',
  BELOW_MINIMUM: 'below_minimum',
  NEEDS_VERIFICATION: 'needs_verification',
  NO_EVIDENCE: 'no_evidence',
});

const LOSSLESS_FORMATS = new Set(['alac', 'ape', 'flac', 'wav', 'wave']);
const FALLBACK_MINIMUM_FORMATS = Object.freeze(['mp3', 'aac', 'opus', 'ogg']);
const FALLBACK_MINIMUM_BITRATE_KBPS = 256;

const QUALITY_PROFILES = Object.freeze({
  [QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE]: Object.freeze({
    code: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
    label: 'Lossless archive',
    cutoffFormats: Object.freeze(['flac', 'alac', 'wav']),
    fallbackAllowed: false,
    preferredFormats: Object.freeze(['flac']),
    minimumFormats: Object.freeze(['flac', 'alac', 'wav']),
    manualReviewBelowPreferred: true,
    requiresVerification: true,
    upgradeAllowed: false,
  }),
  [QUALITY_PROFILE_CODES.HIGH_QUALITY]: Object.freeze({
    code: QUALITY_PROFILE_CODES.HIGH_QUALITY,
    label: 'High quality',
    cutoffFormats: Object.freeze(['flac', 'alac', 'wav']),
    fallbackAllowed: true,
    preferredFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus']),
    minimumBitrateKbps: 256,
    minimumFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg']),
    manualReviewBelowPreferred: false,
    requiresVerification: false,
    upgradeAllowed: true,
  }),
  [QUALITY_PROFILE_CODES.ANY_AVAILABLE]: Object.freeze({
    code: QUALITY_PROFILE_CODES.ANY_AVAILABLE,
    label: 'Any available',
    cutoffFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg', 'wav']),
    fallbackAllowed: true,
    preferredFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg']),
    minimumFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg', 'wav']),
    manualReviewBelowPreferred: false,
    requiresVerification: false,
    upgradeAllowed: false,
  }),
});

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFallbackOverride(value) {
  if (!value || typeof value !== 'object') return null;
  const mode = normalizeToken(value.mode);
  if (mode !== 'allow_fallback_quality') return null;
  return {
    allowedAt: value.allowedAt ?? null,
    allowedByUserId: value.allowedByUserId ?? null,
    mode,
    reasonCode: value.reasonCode ?? null,
    wantedReleaseId: value.wantedReleaseId ?? null,
  };
}

function withFallbackOverride(profile, qualityOverride) {
  const fallbackOverride = normalizeFallbackOverride(qualityOverride);
  if (!fallbackOverride) {
    return { fallbackOverride: null, profile };
  }

  const minimumFormats = [
    ...new Set([
      ...profile.minimumFormats,
      ...FALLBACK_MINIMUM_FORMATS,
    ]),
  ];

  return {
    fallbackOverride,
    profile: {
      ...profile,
      fallbackAllowed: true,
      fallbackOverrideActive: true,
      fallbackTargetFormats: FALLBACK_MINIMUM_FORMATS,
      minimumBitrateKbps: profile.minimumBitrateKbps ?? FALLBACK_MINIMUM_BITRATE_KBPS,
      minimumFormats,
      upgradeAllowed: true,
    },
  };
}

function collectFormatTokens({ candidate = {}, mediaVerification = {} } = {}) {
  const normalizedPayload = candidate.normalizedPayload ?? candidate.normalized_payload ?? {};
  const rawFormats = [
    candidate.audioFormat,
    candidate.codec,
    candidate.extension,
    normalizedPayload.audioFormat,
    normalizedPayload.codec,
    normalizedPayload.extension,
    mediaVerification.audioFormat,
    mediaVerification.codec,
    mediaVerification.container,
    mediaVerification.extension,
  ];
  return [...new Set(rawFormats.map(normalizeToken).filter(Boolean))];
}

function resolveVerifiedLossless({ mediaVerification = {} } = {}) {
  if (
    normalizeBoolean(mediaVerification.isLossless)
    || normalizeBoolean(mediaVerification.verifiedLossless)
  ) {
    return true;
  }

  const mediaFormats = [
    mediaVerification.audioFormat,
    mediaVerification.codec,
    mediaVerification.container,
    mediaVerification.extension,
  ].map(normalizeToken).filter(Boolean);
  if (mediaFormats.length > 0) {
    return mediaFormats.some((format) => LOSSLESS_FORMATS.has(format));
  }

  return false;
}

export function resolveQualityProfile(profileCode) {
  const normalizedProfileCode = normalizeToken(profileCode);
  return QUALITY_PROFILES[normalizedProfileCode] ?? QUALITY_PROFILES[QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE];
}

export function evaluateQualityEvidence({
  candidate = {},
  mediaVerification = {},
  profileCode = QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
  qualityOverride = null,
} = {}) {
  const { fallbackOverride, profile } = withFallbackOverride(resolveQualityProfile(profileCode), qualityOverride);
  const formats = collectFormatTokens({ candidate, mediaVerification });
  const normalizedPayload = candidate.normalizedPayload ?? candidate.normalized_payload ?? {};
  const bitrateKbps = toNumberOrNull(
    mediaVerification.bitrateKbps
      ?? mediaVerification.bitRateKbps
      ?? candidate.bitrateKbps
      ?? candidate.bitRateKbps
      ?? normalizedPayload.bitrateKbps
      ?? normalizedPayload.bitRateKbps,
  );
  const verifiedLossless = resolveVerifiedLossless({ mediaVerification });
  const hasLosslessFormat = formats.some((format) => LOSSLESS_FORMATS.has(format));
  const preferredMet = profile.preferredFormats.some((format) => formats.includes(format));
  const minimumFormatMet = profile.minimumFormats.some((format) => formats.includes(format));
  const minimumBitrateMet = profile.minimumBitrateKbps == null || (bitrateKbps != null && bitrateKbps >= profile.minimumBitrateKbps);
  const minimumMet = profile.minimumBitrateKbps != null
    ? (minimumFormatMet && (hasLosslessFormat || minimumBitrateMet))
    : minimumFormatMet;
  const needsLosslessVerification = profile.requiresVerification
    && hasLosslessFormat
    && !verifiedLossless;

  if (formats.length === 0 && bitrateKbps == null) {
    return {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps,
      code: QUALITY_DECISION_CODES.NO_EVIDENCE,
      explanation: 'No audio quality evidence has been collected yet.',
      formats,
      fallbackOverride,
      fallbackOverrideActive: Boolean(fallbackOverride),
      minimumMet: false,
      preferredMet: false,
      profile,
      tone: 'warning',
      verifiedLossless,
    };
  }

  if (!minimumMet) {
    return {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps,
      code: QUALITY_DECISION_CODES.BELOW_MINIMUM,
      explanation: `${profile.label} requires ${profile.minimumFormats.join(', ')}${profile.minimumBitrateKbps ? ` or ${profile.minimumBitrateKbps} kbps+ evidence` : ''}.`,
      formats,
      fallbackOverride,
      fallbackOverrideActive: Boolean(fallbackOverride),
      minimumMet: false,
      preferredMet,
      profile,
      tone: 'danger',
      verifiedLossless,
    };
  }

  if (needsLosslessVerification) {
    return {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps,
      code: QUALITY_DECISION_CODES.NEEDS_VERIFICATION,
      explanation: 'Lossless preference needs verified media evidence before automatic download or import.',
      formats,
      fallbackOverride,
      fallbackOverrideActive: Boolean(fallbackOverride),
      minimumMet,
      preferredMet,
      profile,
      tone: 'warning',
      verifiedLossless,
    };
  }

  return {
    autoAddEligible: true,
    autoDownloadEligible: true,
    bitrateKbps,
    code: QUALITY_DECISION_CODES.ACCEPTED,
    explanation: preferredMet
      ? `${profile.label} preference is satisfied.`
      : (fallbackOverride
          ? `${profile.label} fallback quality is allowed for this release.`
          : `${profile.label} minimum is satisfied by fallback quality.`),
    formats,
    fallbackOverride,
    fallbackOverrideActive: Boolean(fallbackOverride),
    minimumMet,
    preferredMet,
    profile,
    tone: preferredMet ? 'success' : 'info',
    verifiedLossless,
  };
}

export function createAcquisitionQualityPolicyService() {
  return {
    evaluateQualityEvidence,
    resolveQualityProfile,
  };
}

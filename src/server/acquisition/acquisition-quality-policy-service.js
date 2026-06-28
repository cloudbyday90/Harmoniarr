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

const QUALITY_PROFILES = Object.freeze({
  [QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE]: Object.freeze({
    code: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
    label: 'Lossless archive',
    preferredFormats: Object.freeze(['flac']),
    minimumFormats: Object.freeze(['flac', 'alac', 'wav']),
    requiresVerification: true,
  }),
  [QUALITY_PROFILE_CODES.HIGH_QUALITY]: Object.freeze({
    code: QUALITY_PROFILE_CODES.HIGH_QUALITY,
    label: 'High quality',
    preferredFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus']),
    minimumBitrateKbps: 256,
    minimumFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg']),
    requiresVerification: false,
  }),
  [QUALITY_PROFILE_CODES.ANY_AVAILABLE]: Object.freeze({
    code: QUALITY_PROFILE_CODES.ANY_AVAILABLE,
    label: 'Any available',
    preferredFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg']),
    minimumFormats: Object.freeze(['flac', 'alac', 'mp3', 'aac', 'opus', 'ogg', 'wav']),
    requiresVerification: false,
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
} = {}) {
  const profile = resolveQualityProfile(profileCode);
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
  const preferredMet = profile.preferredFormats.some((format) => formats.includes(format));
  const minimumFormatMet = profile.minimumFormats.some((format) => formats.includes(format));
  const minimumBitrateMet = profile.minimumBitrateKbps == null || (bitrateKbps != null && bitrateKbps >= profile.minimumBitrateKbps);
  const minimumMet = profile.code === QUALITY_PROFILE_CODES.HIGH_QUALITY
    ? (minimumFormatMet && (verifiedLossless || minimumBitrateMet))
    : minimumFormatMet;

  if (formats.length === 0 && bitrateKbps == null) {
    return {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps,
      code: QUALITY_DECISION_CODES.NO_EVIDENCE,
      explanation: 'No audio quality evidence has been collected yet.',
      formats,
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
      minimumMet: false,
      preferredMet,
      profile,
      tone: 'danger',
      verifiedLossless,
    };
  }

  if (profile.requiresVerification && !verifiedLossless) {
    return {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps,
      code: QUALITY_DECISION_CODES.NEEDS_VERIFICATION,
      explanation: 'Lossless preference needs verified media evidence before automatic download or import.',
      formats,
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
      : `${profile.label} minimum is satisfied by fallback quality.`,
    formats,
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

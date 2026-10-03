/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const PROFILE_LABELS = Object.freeze({
  any_available: 'Any available',
  high_quality: 'High quality',
  lossless_archive: 'Lossless archive',
});
const DECISION_LABELS = Object.freeze({
  accepted: 'Quality accepted',
  below_minimum: 'Below preference',
  needs_verification: 'Needs verification',
  no_evidence: 'No quality evidence',
});
const FORMAT_LABELS = Object.freeze({
  aac: 'AAC', alac: 'ALAC', ape: 'APE', flac: 'FLAC', mp3: 'MP3',
  ogg: 'Ogg', opus: 'Opus', wav: 'WAV', wave: 'WAV',
});
const NOT_REPORTED = 'Not reported';

function normalizeBitrate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000
    ? value
    : null;
}

function formatFormats(values) {
  const labels = Array.isArray(values)
    ? [...new Set(values.map((value) => Object.hasOwn(FORMAT_LABELS, value) ? FORMAT_LABELS[value] : null).filter(Boolean))]
    : [];
  return labels.length ? labels.join(', ') : NOT_REPORTED;
}

function formatBitrate(value) {
  const bitrate = normalizeBitrate(value);
  return bitrate !== null
    ? `${Math.round(bitrate)} kbps`
    : NOT_REPORTED;
}

export function buildMissingMusicQualityEvidencePresentation(detail) {
  const evidence = detail?.qualityEvidence ?? {};
  const knownProfile = Object.hasOwn(PROFILE_LABELS, evidence.profileCode);
  const knownDecision = Object.hasOwn(DECISION_LABELS, evidence.code);
  const isReadOnly = detail?.permissions?.isReadOnly === true
    || detail?.decision?.requestedFor?.accountStatus === 'disabled';
  const username = typeof detail?.decision?.requestedFor?.username === 'string'
    && detail.decision.requestedFor.username.trim()
    ? detail.decision.requestedFor.username.trim()
    : 'the selected recipient';
  const minimumFormats = formatFormats(evidence.minimumFormats);
  const minimumBitrate = formatBitrate(evidence.minimumBitrateKbps);
  const fallbackMinimumBitrateKbps = Math.max(256, Math.ceil(normalizeBitrate(evidence.minimumBitrateKbps) ?? 256));
  const minimumLabel = minimumBitrate === NOT_REPORTED
    ? minimumFormats
    : `${minimumFormats} · lossy audio ${minimumBitrate} or higher`;

  return {
    canAllowFallbackQuality: !isReadOnly && detail?.permissions?.canAllowFallbackQuality === true,
    actionExplanation: `Allow MP3, AAC, Opus, or Ogg at ${fallbackMinimumBitrateKbps} kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.`,
    facts: [
      { label: 'Profile', value: knownProfile ? PROFILE_LABELS[evidence.profileCode] : NOT_REPORTED },
      { label: 'Decision', value: knownDecision ? DECISION_LABELS[evidence.code] : NOT_REPORTED },
      { label: 'Observed formats', value: formatFormats(evidence.formats) },
      { label: 'Bitrate', value: formatBitrate(evidence.bitrateKbps) },
      { label: 'Preferred formats', value: formatFormats(evidence.preferredFormats) },
      { label: 'Minimum', value: minimumLabel },
      { label: 'Lossless proof', value: knownProfile && typeof evidence.requiresVerification === 'boolean'
        ? evidence.requiresVerification ? 'Required' : 'Not required by this profile'
        : NOT_REPORTED },
      { label: 'Lossless verification', value: knownDecision && typeof evidence.verifiedLossless === 'boolean'
        ? evidence.verifiedLossless ? 'Verified lossless' : 'Not verified'
        : NOT_REPORTED },
      { label: 'Fallback', value: evidence.fallbackOverrideActive === true
        ? 'Allowed for this recipient'
        : knownProfile && typeof evidence.fallbackAllowed === 'boolean'
          ? evidence.fallbackAllowed ? 'Allowed by profile' : 'Not allowed'
          : NOT_REPORTED },
    ],
    recipientNote: `This choice applies to this release for ${username}. Other household recipients’ quality requirements still apply.`,
  };
}

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

import {
  formatQualityBitrateLabel,
  formatQualityDecisionLabel,
  formatQualityFallbackLabel,
  formatQualityFormatList,
  formatQualityProfileLabel,
  formatQualityUpgradeLabel,
  formatQualityVerificationRequirement,
} from './acquisition-quality-presentation.js';
import { normalizeMissingMusicToken } from './missing-music-presentation-utils.js';

export function buildMissingMusicQualitySummary(release) {
  const quality = release?.quality ?? {};
  const profile = quality.profile ?? {};
  const formatsLabel = Array.isArray(quality.formats) && quality.formats.length > 0
    ? formatQualityFormatList(quality.formats)
    : 'No format evidence';
  const decisionLabel = formatQualityDecisionLabel(quality.code);
  const profileLabel = formatQualityProfileLabel(profile.code);
  const reviewGuidance = buildMissingMusicQualityReviewGuidance(quality);

  return {
    autoAddLabel: quality.autoAddEligible ? 'Automatic add allowed' : 'Automatic add blocked',
    autoDownloadLabel: quality.autoDownloadEligible ? 'Automatic download allowed' : 'Automatic download blocked',
    bitrateLabel: formatQualityBitrateLabel(quality.bitrateKbps),
    canAllowFallbackQuality: quality.code === 'below_minimum' && quality.fallbackOverrideActive !== true,
    code: quality.code ?? 'no_evidence',
    cutoffFormatsLabel: formatQualityFormatList(profile.cutoffFormats),
    decisionLabel,
    explanation: quality.explanation ?? 'Quality evidence has not been evaluated yet.',
    fallbackLabel: quality.fallbackOverrideActive ? 'Fallback allowed for this release' : formatQualityFallbackLabel(profile),
    fallbackOverrideLabel: quality.fallbackOverrideActive ? 'Allowed for this release' : 'No release override',
    formatsLabel,
    minimumFormatsLabel: formatQualityFormatList(profile.minimumFormats),
    preferredFormatsLabel: formatQualityFormatList(profile.preferredFormats),
    profileLabel,
    reviewGuidance,
    tone: quality.tone ?? 'warning',
    upgradeLabel: formatQualityUpgradeLabel(profile),
    verificationRequirementLabel: formatQualityVerificationRequirement(profile),
    verifiedLabel: quality.verifiedLossless ? 'Verified lossless' : 'Needs verification',
  };
}

function buildMissingMusicQualityReviewGuidance(quality = {}) {
  if (quality.fallbackOverrideActive) {
    return 'Fallback quality is allowed for this release. Harmoniarr can use the best acceptable match and keep looking for a preferred upgrade when the profile allows it.';
  }

  switch (quality.code) {
    case 'accepted':
      return 'This quality decision is acceptable for automation.';
    case 'below_minimum':
      return 'These matches are below the selected profile. Use a better match, search again, or change the profile before Harmoniarr downloads automatically.';
    case 'needs_verification':
      return quality.autoDownloadEligible
        ? 'Harmoniarr will verify this advertised lossless download before adding it to your library.'
        : 'Harmoniarr needs real audio evidence before treating this as lossless.';
    case 'no_evidence':
      return 'No usable quality evidence has been collected yet.';
    default:
      return 'Harmoniarr has not finished evaluating quality for this release.';
  }
}

export function normalizeMissingMusicFormats(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(normalizeMissingMusicToken).filter(Boolean))]
    : [];
}

export function formatMissingMusicFormatsLabel(formats) {
  return formats.length > 0 ? formats.join(', ').toUpperCase() : 'No format evidence';
}

export function buildMissingMusicMatchQualityFit(match, qualityProfile) {
  const formats = normalizeMissingMusicFormats(match?.formats);
  const spectralVerdict = normalizeMissingMusicToken(
    match?.spectralVerdict
      ?? match?.mediaVerification?.spectralVerdict
      ?? match?.mediaVerification?.transcodeVerdict
      ?? match?.mediaVerification?.losslessVerdict,
  );
  const preferredFormats = normalizeMissingMusicFormats(qualityProfile?.preferredFormats);
  const minimumFormats = normalizeMissingMusicFormats(qualityProfile?.minimumFormats);
  const cutoffFormats = normalizeMissingMusicFormats(qualityProfile?.cutoffFormats);
  const effectiveCutoffFormats = cutoffFormats.length > 0 ? cutoffFormats : preferredFormats;
  const preferredMet = formats.some((format) => preferredFormats.includes(format));
  const minimumMet = formats.some((format) => minimumFormats.includes(format));
  const cutoffMet = formats.some((format) => effectiveCutoffFormats.includes(format));
  const fallbackUsed = minimumMet && !preferredMet;
  const verificationRequired = qualityProfile?.requiresVerification === true;
  const verifiedLossless = match?.verifiedLossless === true || match?.mediaVerification?.verifiedLossless === true;

  const detailRows = buildMissingMusicMatchQualityRows({
    cutoffFormats: effectiveCutoffFormats,
    cutoffMet,
    fallbackUsed,
    formats,
    minimumFormats,
    minimumMet,
    preferredFormats,
    preferredMet,
    qualityProfile,
    spectralVerdict,
    verificationRequired,
    verifiedLossless,
  });

  if (formats.length === 0) {
    return {
      cutoffMet,
      detailRows,
      fallbackUsed,
      label: 'No format evidence',
      minimumMet,
      preferredMet,
      tone: 'warning',
    };
  }

  if (preferredMet) {
    return {
      cutoffMet,
      detailRows,
      fallbackUsed,
      label: 'Preferred quality',
      minimumMet,
      preferredMet,
      tone: 'success',
    };
  }

  if (minimumMet) {
    return {
      cutoffMet,
      detailRows,
      fallbackUsed,
      label: qualityProfile?.fallbackAllowed ? 'Fallback quality' : 'Needs quality choice',
      minimumMet,
      preferredMet,
      tone: qualityProfile?.fallbackAllowed ? 'info' : 'warning',
    };
  }

  return {
    cutoffMet,
    detailRows,
    fallbackUsed,
    label: 'Below profile',
    minimumMet,
    preferredMet,
    tone: 'danger',
  };
}

function buildMissingMusicMatchQualityRows({
  cutoffFormats,
  cutoffMet,
  fallbackUsed,
  formats,
  minimumFormats,
  minimumMet,
  preferredFormats,
  preferredMet,
  qualityProfile,
  spectralVerdict,
  verificationRequired,
  verifiedLossless,
}) {
  return [
    {
      label: 'Observed',
      tone: formats.length > 0 ? 'neutral' : 'warning',
      value: formats.length > 0 ? formatMissingMusicFormatsLabel(formats) : 'No format evidence',
    },
    {
      label: 'Preferred',
      tone: preferredMet ? 'success' : 'warning',
      value: preferredMet
        ? `Matches ${formatMissingMusicFormatsLabel(preferredFormats)}`
        : `Needs ${formatMissingMusicFormatsLabel(preferredFormats)}`,
    },
    {
      label: 'Minimum',
      tone: minimumMet ? 'success' : 'danger',
      value: minimumMet
        ? `Meets ${formatMissingMusicFormatsLabel(minimumFormats)}`
        : `Below ${formatMissingMusicFormatsLabel(minimumFormats)}`,
    },
    {
      label: 'Cutoff',
      tone: cutoffMet ? 'success' : 'info',
      value: cutoffMet
        ? `At cutoff ${formatMissingMusicFormatsLabel(cutoffFormats)}`
        : `Below cutoff ${formatMissingMusicFormatsLabel(cutoffFormats)}`,
    },
    {
      label: 'Fallback',
      tone: fallbackUsed && !qualityProfile?.fallbackAllowed ? 'warning' : 'neutral',
      value: fallbackUsed
        ? (qualityProfile?.fallbackAllowed ? 'Allowed by profile' : 'Needs approval')
        : 'Not using fallback',
    },
    {
      label: 'Audio check',
      tone: verificationRequired && !verifiedLossless ? 'warning' : 'success',
      value: verificationRequired
        ? (verifiedLossless ? 'Verified lossless' : 'Required before automatic progress')
        : 'Not required for this profile',
    },
    {
      label: 'Spectral check',
      tone: formatMissingMusicSpectralVerdictTone(spectralVerdict),
      value: formatMissingMusicSpectralVerdictLabel(spectralVerdict),
    },
  ];
}

function formatMissingMusicSpectralVerdictLabel(verdict) {
  switch (verdict) {
    case 'authentic':
      return 'Looks authentic';
    case 'inconclusive':
      return 'Inconclusive';
    case 'suspicious':
      return 'Suspicious lossless claim';
    case 'transcoded':
      return 'Likely transcoded';
    default:
      return 'No spectral evidence';
  }
}

function formatMissingMusicSpectralVerdictTone(verdict) {
  if (verdict === 'authentic') return 'success';
  if (verdict === 'suspicious' || verdict === 'transcoded') return 'danger';
  if (verdict === 'inconclusive') return 'warning';
  return 'neutral';
}

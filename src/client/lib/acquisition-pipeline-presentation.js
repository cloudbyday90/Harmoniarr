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

import { formatOperationTimestampShort } from './operation-run-presentation.js';
import {
  formatQualityBitrateLabel,
  formatQualityDecisionLabel,
  formatQualityFallbackLabel,
  formatQualityFormatList,
  formatQualityProfileLabel,
  formatQualityUpgradeLabel,
  formatQualityVerificationRequirement,
} from './acquisition-quality-presentation.js';
import { formatBytes } from './import-candidate-presentation.js';
import { buildMusicQueueRecoveryPresentation } from './music-queue-recovery-presentation.js';
import { buildMusicQueueReleaseProgressPresentation } from './music-queue-release-progress-presentation.js';

const DEFAULT_STATUS = Object.freeze({
  code: 'queued_for_search',
  label: 'Queued for search',
  message: 'This release is waiting for the next search pass.',
  tone: 'neutral',
});

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function firstPresent(values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;
}

function getReleaseYear(releaseDate) {
  if (!releaseDate) return null;
  const year = String(releaseDate).slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function formatReleaseType(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return 'Release';
  if (normalized === 'ep') return 'EP';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getLastActivityAt(release) {
  return firstPresent([
    release?.evidence?.match?.latestUpdatedAt,
    release?.evidence?.search?.lastSearchAt,
    release?.lastReconciledAt,
  ]);
}

function buildMatchSummary(release) {
  const match = release?.evidence?.match ?? {};
  const readiness = match.readiness ?? null;
  const totalCount = getCount(match.totalCount);
  const executionCounts = match.executionStatusCounts ?? {};
  const derivedPendingCount = getCount(match.statusCounts?.pending) + getCount(match.statusCounts?.held);
  return {
    bestCompositeScore: match.bestCompositeScore ?? readiness?.bestCompositeScore ?? null,
    blockedCount: getCount(match.statusCounts?.failed) + getCount(match.statusCounts?.rejected),
    confirmedTransferCount: getCount(match.confirmedTransferCount),
    confirmedTransferCandidateCount: getCount(match.confirmedTransferCandidateCount),
    completedTransferCount: getCount(executionCounts.completed) + getCount(executionCounts.complete),
    label: totalCount === 1 ? '1 match found' : `${totalCount} matches found`,
    matches: Array.isArray(match.matches) ? match.matches : [],
    latestConfirmedTransferAt: match.latestConfirmedTransferAt ?? null,
    message: readiness?.message ?? (totalCount > 0 ? 'Harmoniarr is evaluating the available matches.' : 'No matches have been found yet.'),
    pendingCount: match.pendingCount == null ? derivedPendingCount : getCount(match.pendingCount),
    readiness,
    scoreGap: readiness?.scoreGap ?? null,
    selectedCount: getCount(match.statusCounts?.selected) + getCount(match.statusCounts?.held),
    totalCount,
  };
}

function buildQualitySummary(release) {
  const quality = release?.quality ?? {};
  const profile = quality.profile ?? {};
  const formatsLabel = Array.isArray(quality.formats) && quality.formats.length > 0
    ? formatQualityFormatList(quality.formats)
    : 'No format evidence';
  const decisionLabel = formatQualityDecisionLabel(quality.code);
  const profileLabel = formatQualityProfileLabel(profile.code);
  const reviewGuidance = buildQualityReviewGuidance(quality);

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

function buildQualityReviewGuidance(quality = {}) {
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

function formatMatchStatusLabel(status) {
  switch (status) {
    case 'applied':
      return 'In library';
    case 'downloading':
      return 'Downloading';
    case 'failed':
      return 'Blocked';
    case 'held':
      return 'Needs review';
    case 'import_pending':
      return 'Ready to add';
    case 'rejected':
      return 'Rejected';
    case 'selected':
      return 'Selected';
    default:
      return 'Available';
  }
}

function formatMatchStatusTone(status) {
  if (status === 'applied') return 'success';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'downloading' || status === 'import_pending' || status === 'selected') return 'info';
  if (status === 'held') return 'warning';
  return 'neutral';
}

function formatScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : 'Not scored';
}

function formatSpeed(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Speed unknown';

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let speed = parsed;
  let unitIndex = 0;
  while (speed >= 1024 && unitIndex < units.length - 1) {
    speed /= 1024;
    unitIndex += 1;
  }

  return `${speed.toFixed(speed >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function normalizeFormats(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(normalizeToken).filter(Boolean))]
    : [];
}

function formatFormatsLabel(formats) {
  return formats.length > 0 ? formats.join(', ').toUpperCase() : 'No format evidence';
}

function buildMatchQualityFit(match, qualityProfile) {
  const formats = normalizeFormats(match?.formats);
  const spectralVerdict = normalizeToken(
    match?.spectralVerdict
      ?? match?.mediaVerification?.spectralVerdict
      ?? match?.mediaVerification?.transcodeVerdict
      ?? match?.mediaVerification?.losslessVerdict,
  );
  const preferredFormats = normalizeFormats(qualityProfile?.preferredFormats);
  const minimumFormats = normalizeFormats(qualityProfile?.minimumFormats);
  const cutoffFormats = normalizeFormats(qualityProfile?.cutoffFormats);
  const effectiveCutoffFormats = cutoffFormats.length > 0 ? cutoffFormats : preferredFormats;
  const preferredMet = formats.some((format) => preferredFormats.includes(format));
  const minimumMet = formats.some((format) => minimumFormats.includes(format));
  const cutoffMet = formats.some((format) => effectiveCutoffFormats.includes(format));
  const fallbackUsed = minimumMet && !preferredMet;
  const verificationRequired = qualityProfile?.requiresVerification === true;
  const verifiedLossless = match?.verifiedLossless === true || match?.mediaVerification?.verifiedLossless === true;

  if (formats.length === 0) {
    return {
      cutoffMet,
      detailRows: buildMatchQualityRows({
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
      }),
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
      detailRows: buildMatchQualityRows({
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
      }),
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
      detailRows: buildMatchQualityRows({
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
      }),
      fallbackUsed,
      label: qualityProfile?.fallbackAllowed ? 'Fallback quality' : 'Needs quality choice',
      minimumMet,
      preferredMet,
      tone: qualityProfile?.fallbackAllowed ? 'info' : 'warning',
    };
  }

  return {
    cutoffMet,
    detailRows: buildMatchQualityRows({
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
    }),
    fallbackUsed,
    label: 'Below profile',
    minimumMet,
    preferredMet,
    tone: 'danger',
  };
}

function buildMatchQualityRows({
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
      value: formats.length > 0 ? formatFormatsLabel(formats) : 'No format evidence',
    },
    {
      label: 'Preferred',
      tone: preferredMet ? 'success' : 'warning',
      value: preferredMet
        ? `Matches ${formatFormatsLabel(preferredFormats)}`
        : `Needs ${formatFormatsLabel(preferredFormats)}`,
    },
    {
      label: 'Minimum',
      tone: minimumMet ? 'success' : 'danger',
      value: minimumMet
        ? `Meets ${formatFormatsLabel(minimumFormats)}`
        : `Below ${formatFormatsLabel(minimumFormats)}`,
    },
    {
      label: 'Cutoff',
      tone: cutoffMet ? 'success' : 'info',
      value: cutoffMet
        ? `At cutoff ${formatFormatsLabel(cutoffFormats)}`
        : `Below cutoff ${formatFormatsLabel(cutoffFormats)}`,
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
      tone: formatSpectralVerdictTone(spectralVerdict),
      value: formatSpectralVerdictLabel(spectralVerdict),
    },
  ];
}

function formatSpectralVerdictLabel(verdict) {
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

function formatSpectralVerdictTone(verdict) {
  if (verdict === 'authentic') return 'success';
  if (verdict === 'suspicious' || verdict === 'transcoded') return 'danger';
  if (verdict === 'inconclusive') return 'warning';
  return 'neutral';
}

function buildTrackCoverageLabel(trackMatchSummary, fileCount) {
  const matched = getCount(trackMatchSummary?.matchedTrackCount);
  const expected = getCount(trackMatchSummary?.expectedTrackCount);
  if (expected > 0) {
    return `${matched} of ${expected} tracks matched`;
  }

  const files = getCount(fileCount);
  return `${files} file${files === 1 ? '' : 's'}`;
}

function buildMatchReason({ index, match, qualityFit, readiness }) {
  if (match?.status === 'selected') return 'Harmoniarr selected this match for download handoff.';
  if (match?.status === 'downloading') return 'This match is currently downloading.';
  if (match?.status === 'import_pending') return 'This match downloaded and is waiting to be added to the library.';
  if (match?.status === 'applied') return 'This match has already been added to the library.';
  if (match?.status === 'failed') return 'This match failed and should not be retried before another option is considered.';
  if (match?.status === 'rejected') return 'This match was rejected and will stay out of automatic selection.';
  if (qualityFit.label === 'Below profile') return 'This match does not meet the selected quality profile.';
  if (index === 0 && readiness?.code === 'auto_selectable') return 'This is the highest-ranked match and meets automatic selection thresholds.';
  if (index === 0 && readiness?.code === 'ambiguous') return 'This is one of several close matches, so Harmoniarr needs a choice.';
  if (index === 0 && readiness?.code === 'low_confidence') return 'This is the best match found, but its score is below the automatic threshold.';
  if (match?.score == null) return 'This match needs review because no score is available yet.';
  return 'This match is available as another option for the release.';
}

function buildMatchHealthLabel(match) {
  if (match?.hasFreeUploadSlot) {
    return `Free slot - ${formatSpeed(match.uploadSpeed)}`;
  }

  if (match?.queueLength != null) {
    return `Queue ${match.queueLength} - ${formatSpeed(match.uploadSpeed)}`;
  }

  return formatSpeed(match?.uploadSpeed);
}

function buildMatchCards(release) {
  const matches = Array.isArray(release?.matchSummary?.matches) ? release.matchSummary.matches : [];
  const readiness = release?.matchSummary?.readiness ?? null;
  const qualityProfile = release?.qualityProfile ?? {};

  return matches.map((match, index) => {
    const qualityFit = buildMatchQualityFit(match, qualityProfile);
    const formats = normalizeFormats(match.formats);
    const fileCount = getCount(match.fileCount);
    const lockedFileCount = getCount(match.lockedFileCount);
    const matchId = match.matchId ?? null;

    return {
      canRejectMatch: Boolean(matchId) && ['held', 'pending', 'selected'].includes(match.status ?? 'pending'),
      canUseMatch: Boolean(matchId) && ['held', 'pending'].includes(match.status ?? 'pending'),
      fileLabel: `${fileCount} file${fileCount === 1 ? '' : 's'}${lockedFileCount > 0 ? `, ${lockedFileCount} locked` : ''}`,
      formatLabel: formatFormatsLabel(formats),
      healthLabel: buildMatchHealthLabel(match),
      id: matchId ?? `match-${index + 1}`,
      matchId,
      isBest: index === 0,
      label: `Match ${index + 1}`,
      qualityRows: qualityFit.detailRows,
      qualityFitLabel: qualityFit.label,
      qualityFitTone: qualityFit.tone,
      reason: buildMatchReason({ index, match, qualityFit, readiness }),
      scoreLabel: formatScore(match.score),
      sizeLabel: formatBytes(Number(match.totalSizeBytes)),
      statusLabel: formatMatchStatusLabel(match.status),
      statusTone: formatMatchStatusTone(match.status),
      trackCoverageLabel: buildTrackCoverageLabel(match.trackMatchSummary, match.fileCount),
    };
  });
}

export function buildMusicQueueAction(status, recovery = null) {
  if (recovery?.kind === 'automatic') {
    return { code: 'view_recovery', label: 'View recovery', type: 'review' };
  }

  if (recovery?.kind === 'action_required') {
    return { code: 'review_recovery', label: 'Review recovery', type: 'review' };
  }

  switch (status?.nextAction) {
    case 'add_to_library':
      return { code: 'add_to_library', label: 'View details', type: 'review' };
    case 'configure_provider':
      return { code: 'configure_provider', label: 'Test Soulseek', type: 'route', routeName: 'settings-connections' };
    case 'download_now':
      return { code: 'download_now', label: 'Review match', type: 'review' };
    case 'open_downloader':
      return { code: 'open_downloader', label: 'View download progress', type: 'route', routeName: 'downloader' };
    case 'open_in_library':
      return { code: 'open_in_library', label: 'Open Library', type: 'route', routeName: 'library' };
    case 'recheck_library_add':
      return { code: 'recheck_library_add', label: status?.repair?.actionLabel ?? 'Try audio check again', type: 'review' };
    case 'review_add_plan':
      return {
        code: 'review_add_plan',
        label: status?.repair?.actionLabel ?? 'Review add plan',
        type: 'review',
      };
    case 'review_matches':
      return { code: 'review_matches', label: 'Review matches', type: 'review' };
    case 'review_quality_choice':
      return {
        code: 'review_quality_choice',
        label: status?.repair?.actionLabel ?? 'Review quality choice',
        type: 'review',
      };
    case 'search_now':
      return { code: 'search_now', label: 'View details', type: 'review' };
    case 'set_up_folders':
      return { code: 'set_up_folders', label: 'Set up folders', type: 'route', routeName: 'settings-media-storage' };
    case 'show_advanced_diagnostics':
      return { code: 'show_advanced_diagnostics', label: 'Set up media tools', type: 'route', routeName: 'settings-media-storage' };
    case 'try_again':
      return { code: 'try_again', label: 'Review retry', type: 'review' };
    case 'view_recovery':
      return { code: 'view_recovery', label: 'View recovery', type: 'review' };
    default:
      return { code: 'show_details', label: 'View details', type: 'review' };
  }
}

export function getMusicQueueStatusClass(status) {
  const tone = status?.tone ?? 'neutral';
  if (tone === 'success') return 'review-status-held';
  if (tone === 'danger') return 'review-status-failed';
  if (tone === 'warning') return 'review-status-held';
  if (tone === 'info') return 'review-status-pending';
  return 'review-status-held';
}

export function normalizeMusicQueueRelease(release) {
  const status = release?.status ?? DEFAULT_STATUS;
  const operatorSelectionEvidence = release?.evidence?.operatorSelection ?? release?.evidence ?? {};
  const quality = release?.quality ?? {};
  const qualityProfile = quality.profile ?? {};
  const lastActivityAt = getLastActivityAt(release);
  const matchSummary = buildMatchSummary(release);
  const qualitySummary = buildQualitySummary(release);
  const releaseTypeLabel = formatReleaseType(release?.releaseGroupType);
  const releaseYear = getReleaseYear(release?.releaseDate);
  const recovery = buildMusicQueueRecoveryPresentation(status);
  const action = buildMusicQueueAction(status, recovery);

  return {
    artistName: release?.artistName ?? 'Unknown artist',
    action,
    coverageLabel: `${getCount(release?.matchedTrackCount)} of ${getCount(release?.expectedTrackCount)} tracks`,
    detailText: recovery?.detail ?? status.detail ?? matchSummary.readiness?.message ?? quality.explanation ?? status.message,
    expectedTrackCount: getCount(release?.expectedTrackCount),
    id: release?.id,
    lastActivityAt,
    lastActivityLabel: lastActivityAt ? formatOperationTimestampShort(lastActivityAt) : 'No activity yet',
    matchSummary,
    matchedTrackCount: getCount(release?.matchedTrackCount),
    metadataReleaseGroupId: release?.metadataReleaseGroupId ?? null,
    missingTrackCount: getCount(release?.missingTrackCount),
    nextAction: status.nextAction ?? null,
    progressChips: [
      `${getCount(release?.missingTrackCount)} missing`,
      matchSummary.label,
      qualitySummary.profileLabel,
    ],
    qualityDecisionLabel: formatQualityDecisionLabel(quality.code),
    qualityProfile,
    qualityProfileLabel: formatQualityProfileLabel(qualityProfile.code),
    qualitySummary,
    releaseGroupType: release?.releaseGroupType ?? null,
    releaseDate: release?.releaseDate ?? null,
    releaseTitle: release?.releaseTitle ?? release?.releaseGroupTitle ?? 'Unknown release',
    releaseTypeLabel,
    releaseYear,
    recovery,
    repair: status.repair ?? null,
    searchableText: [
      release?.artistName,
      release?.releaseTitle,
      release?.releaseGroupTitle,
      releaseTypeLabel,
      status.label,
      status.message,
      status.detail,
      recovery?.detail,
      matchSummary.message,
      qualitySummary.explanation,
    ].filter(Boolean).join(' ').toLowerCase(),
    status,
    statusClass: getMusicQueueStatusClass(status),
    statusCode: status.code,
    operatorSelection: {
      selectionOrigin: operatorSelectionEvidence.selectionOrigin ?? null,
      selectionSource: operatorSelectionEvidence.selectionSource ?? null,
      selectionState: operatorSelectionEvidence.selectionState ?? null,
    },
  };
}

export function buildMusicQueueSummaryCards(summary = {}) {
  const counts = summary.counts ?? {};
  return [
    {
      key: 'waiting',
      label: 'Waiting',
      value: getCount(counts.queued_for_search) + getCount(counts.retrying_search),
    },
    {
      key: 'searching',
      label: 'Searching',
      value: getCount(counts.searching) + getCount(counts.checking_matches) + getCount(counts.pick_match),
    },
    {
      key: 'downloading',
      label: 'Downloading',
      value: getCount(counts.downloading) + getCount(counts.trying_next_match),
    },
    {
      key: 'ready-to-add',
      label: 'Ready to add',
      value: getCount(counts.ready_to_add) + getCount(counts.adding_to_library),
    },
    {
      key: 'needs-help',
      label: 'Needs help',
      value: getCount(counts.quality_choice_needed)
        + getCount(counts.needs_help_adding)
        + getCount(counts.no_matches_left)
        + getCount(counts.failed),
    },
    {
      key: 'needs-setup',
      label: 'Needs setup',
      value: getCount(counts.needs_setup),
    },
  ];
}

export function buildMusicQueueMatchReview(release) {
  if (!release) return null;
  const matchSummary = release.matchSummary ?? {};
  const qualitySummary = release.qualitySummary ?? {};
  const canAllowFallbackQuality = release.statusCode === 'quality_choice_needed'
    && qualitySummary.canAllowFallbackQuality;
  const recovery = release.recovery ?? null;
  const canSearchAgain = recovery?.canSearchAgain
    ?? ['failed', 'no_matches_left', 'quality_choice_needed'].includes(release.statusCode);
  const canAddToLibrary = release.statusCode === 'ready_to_add'
    && release.action?.code === 'add_to_library';

  return {
    action: release.action,
    artistName: release.artistName,
    canAddToLibrary,
    canAllowFallbackQuality,
    canSearchAgain,
    fallbackQualityLabel: 'Allow fallback quality',
    heading: `${release.releaseTitle} by ${release.artistName}`,
    matchCards: buildMatchCards(release),
    matchChoiceCount: matchSummary.totalCount,
    matchRows: [
      { label: 'Matches found', value: String(matchSummary.totalCount ?? 0) },
      { label: 'Ready to review', value: String(matchSummary.pendingCount ?? 0) },
      { label: 'Selected', value: String(matchSummary.selectedCount ?? 0) },
      { label: 'Blocked or rejected', value: String(matchSummary.blockedCount ?? 0) },
      { label: 'Best score', value: matchSummary.bestCompositeScore == null ? 'Not scored' : String(matchSummary.bestCompositeScore) },
      { label: 'Score gap', value: matchSummary.scoreGap == null ? 'Not available' : String(matchSummary.scoreGap) },
    ],
    reason: release.detailText,
    releaseId: release.id,
    releaseTitle: release.releaseTitle,
    statusLabel: release.status?.label ?? 'Queued',
    statusTone: release.status?.tone ?? 'neutral',
    qualityRows: [
      { label: 'Profile', value: qualitySummary.profileLabel },
      { label: 'Decision', value: qualitySummary.decisionLabel },
      { label: 'Preferred', value: qualitySummary.preferredFormatsLabel },
      { label: 'Minimum', value: qualitySummary.minimumFormatsLabel },
      { label: 'Cutoff', value: qualitySummary.cutoffFormatsLabel },
      { label: 'Fallback', value: qualitySummary.fallbackLabel },
      { label: 'Release choice', value: qualitySummary.fallbackOverrideLabel },
      { label: 'Upgrade search', value: qualitySummary.upgradeLabel },
      { label: 'Formats', value: qualitySummary.formatsLabel },
      { label: 'Bitrate', value: qualitySummary.bitrateLabel },
      { label: 'Verification', value: qualitySummary.verifiedLabel },
      { label: 'Audio check', value: qualitySummary.verificationRequirementLabel },
      { label: 'Download gate', value: qualitySummary.autoDownloadLabel },
      { label: 'Library gate', value: qualitySummary.autoAddLabel },
    ],
    qualityGuidance: qualitySummary.reviewGuidance,
    progress: buildMusicQueueReleaseProgressPresentation(release),
    recovery,
    repair: release.repair,
    searchAgainLabel: recovery?.retryLabel ?? (release.statusCode === 'quality_choice_needed' ? 'Search again' : 'Try again'),
  };
}

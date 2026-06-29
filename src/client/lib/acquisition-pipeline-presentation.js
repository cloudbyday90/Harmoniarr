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
import { formatQualityDecisionLabel, formatQualityProfileLabel } from './acquisition-quality-presentation.js';
import { formatBytes } from './import-candidate-presentation.js';

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
    completedTransferCount: getCount(executionCounts.completed) + getCount(executionCounts.complete),
    label: totalCount === 1 ? '1 match found' : `${totalCount} matches found`,
    matches: Array.isArray(match.matches) ? match.matches : [],
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
  return {
    decisionLabel: formatQualityDecisionLabel(quality.code),
    explanation: quality.explanation ?? 'Quality evidence has not been evaluated yet.',
    formatsLabel: Array.isArray(quality.formats) && quality.formats.length > 0
      ? quality.formats.join(', ').toUpperCase()
      : 'No format evidence',
    profileLabel: formatQualityProfileLabel(quality.profile?.code),
    tone: quality.tone ?? 'warning',
    verifiedLabel: quality.verifiedLossless ? 'Verified lossless' : 'Needs verification',
  };
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
  const preferredFormats = normalizeFormats(qualityProfile?.preferredFormats);
  const minimumFormats = normalizeFormats(qualityProfile?.minimumFormats);
  const preferredMet = formats.some((format) => preferredFormats.includes(format));
  const minimumMet = formats.some((format) => minimumFormats.includes(format));

  if (formats.length === 0) {
    return { label: 'No format evidence', tone: 'warning' };
  }

  if (preferredMet) {
    return { label: 'Preferred quality', tone: 'success' };
  }

  if (minimumMet) {
    return { label: 'Meets minimum', tone: 'info' };
  }

  return { label: 'Below profile', tone: 'danger' };
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

    return {
      fileLabel: `${fileCount} file${fileCount === 1 ? '' : 's'}${lockedFileCount > 0 ? `, ${lockedFileCount} locked` : ''}`,
      formatLabel: formatFormatsLabel(formats),
      healthLabel: buildMatchHealthLabel(match),
      id: match.matchId ?? `match-${index + 1}`,
      isBest: index === 0,
      label: `Match ${index + 1}`,
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

export function buildMusicQueueAction(status) {
  switch (status?.nextAction) {
    case 'add_to_library':
      return { code: 'add_to_library', label: 'Review add plan', type: 'route', routeName: 'activity-imports' };
    case 'configure_provider':
      return { code: 'configure_provider', label: 'Test Soulseek', type: 'route', routeName: 'settings-connections' };
    case 'download_now':
      return { code: 'download_now', label: 'Review match', type: 'review' };
    case 'open_downloader':
      return { code: 'open_downloader', label: 'Open Downloader', type: 'route', routeName: 'downloader' };
    case 'open_in_library':
      return { code: 'open_in_library', label: 'Open Library', type: 'route', routeName: 'library' };
    case 'review_add_plan':
      return { code: 'review_add_plan', label: 'Review add plan', type: 'route', routeName: 'activity-imports' };
    case 'review_matches':
      return { code: 'review_matches', label: 'Review matches', type: 'review' };
    case 'review_quality_choice':
      return { code: 'review_quality_choice', label: 'Review quality choice', type: 'review' };
    case 'search_now':
      return { code: 'search_now', label: 'Open wanted releases', type: 'route', routeName: 'activity-wanted' };
    case 'set_up_folders':
      return { code: 'set_up_folders', label: 'Set up folders', type: 'route', routeName: 'settings-media-storage' };
    case 'show_advanced_diagnostics':
      return { code: 'show_advanced_diagnostics', label: 'Set up media tools', type: 'route', routeName: 'settings-media-storage' };
    case 'try_again':
      return { code: 'try_again', label: 'Review retry', type: 'route', routeName: 'activity-wanted' };
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
  const quality = release?.quality ?? {};
  const qualityProfile = quality.profile ?? {};
  const lastActivityAt = getLastActivityAt(release);
  const matchSummary = buildMatchSummary(release);
  const qualitySummary = buildQualitySummary(release);
  const releaseTypeLabel = formatReleaseType(release?.releaseGroupType);
  const releaseYear = getReleaseYear(release?.releaseDate);
  const action = buildMusicQueueAction(status);

  return {
    artistName: release?.artistName ?? 'Unknown artist',
    action,
    coverageLabel: `${getCount(release?.matchedTrackCount)} of ${getCount(release?.expectedTrackCount)} tracks`,
    detailText: status.detail ?? matchSummary.readiness?.message ?? quality.explanation ?? status.message,
    id: release?.id,
    lastActivityAt,
    lastActivityLabel: lastActivityAt ? formatOperationTimestampShort(lastActivityAt) : 'No activity yet',
    matchSummary,
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
    searchableText: [
      release?.artistName,
      release?.releaseTitle,
      release?.releaseGroupTitle,
      releaseTypeLabel,
      status.label,
      status.message,
      status.detail,
      matchSummary.message,
      qualitySummary.explanation,
    ].filter(Boolean).join(' ').toLowerCase(),
    status,
    statusClass: getMusicQueueStatusClass(status),
    statusCode: status.code,
  };
}

export function buildMusicQueueSummaryCards(summary = {}) {
  const counts = summary.counts ?? {};
  return [
    {
      key: 'waiting',
      label: 'Waiting',
      value: getCount(counts.queued_for_search),
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

export const MUSIC_QUEUE_STATE_FILTERS = Object.freeze([
  Object.freeze({ label: 'All', value: 'all' }),
  Object.freeze({ label: 'Waiting', value: 'waiting' }),
  Object.freeze({ label: 'Searching', value: 'searching' }),
  Object.freeze({ label: 'Downloading', value: 'downloading' }),
  Object.freeze({ label: 'Ready to add', value: 'ready_to_add' }),
  Object.freeze({ label: 'Needs help', value: 'needs_help' }),
  Object.freeze({ label: 'Needs setup', value: 'needs_setup' }),
  Object.freeze({ label: 'In library', value: 'in_library' }),
]);

export function getMusicQueueFilterState(statusCode) {
  if (statusCode === 'queued_for_search') return 'waiting';
  if (['searching', 'checking_matches', 'pick_match'].includes(statusCode)) return 'searching';
  if (['downloading', 'trying_next_match'].includes(statusCode)) return 'downloading';
  if (['ready_to_add', 'adding_to_library'].includes(statusCode)) return 'ready_to_add';
  if (statusCode === 'needs_setup') return 'needs_setup';
  if (statusCode === 'in_library') return 'in_library';
  if (['quality_choice_needed', 'needs_help_adding', 'no_matches_left', 'failed'].includes(statusCode)) return 'needs_help';
  return 'all';
}

export function filterMusicQueueReleases(releases, {
  query = '',
  releaseType = 'all',
  state = 'all',
} = {}) {
  const normalizedQuery = normalizeToken(query);
  const normalizedReleaseType = normalizeToken(releaseType);
  const normalizedState = normalizeToken(state);

  return releases.filter((release) => {
    if (normalizedQuery && !release.searchableText.includes(normalizedQuery)) {
      return false;
    }

    if (normalizedReleaseType && normalizedReleaseType !== 'all') {
      if (normalizeToken(release.releaseTypeLabel) !== normalizedReleaseType) return false;
    }

    if (normalizedState && normalizedState !== 'all') {
      if (getMusicQueueFilterState(release.statusCode) !== normalizedState) return false;
    }

    return true;
  });
}

export function buildMusicQueueReleaseTypeFilters(releases) {
  const types = [...new Set(releases.map((release) => release.releaseTypeLabel).filter(Boolean))].sort();
  return [
    { label: 'All types', value: 'all' },
    ...types.map((type) => ({ label: type, value: type.toLowerCase() })),
  ];
}

export function buildMusicQueueMatchReview(release) {
  if (!release) return null;
  const matchSummary = release.matchSummary ?? {};
  const qualitySummary = release.qualitySummary ?? {};

  return {
    action: release.action,
    heading: `${release.releaseTitle} by ${release.artistName}`,
    matchCards: buildMatchCards(release),
    matchRows: [
      { label: 'Matches found', value: String(matchSummary.totalCount ?? 0) },
      { label: 'Ready to review', value: String(matchSummary.pendingCount ?? 0) },
      { label: 'Selected', value: String(matchSummary.selectedCount ?? 0) },
      { label: 'Blocked or rejected', value: String(matchSummary.blockedCount ?? 0) },
      { label: 'Best score', value: matchSummary.bestCompositeScore == null ? 'Not scored' : String(matchSummary.bestCompositeScore) },
      { label: 'Score gap', value: matchSummary.scoreGap == null ? 'Not available' : String(matchSummary.scoreGap) },
    ],
    reason: release.detailText,
    statusLabel: release.status?.label ?? 'Queued',
    qualityRows: [
      { label: 'Profile', value: qualitySummary.profileLabel },
      { label: 'Decision', value: qualitySummary.decisionLabel },
      { label: 'Formats', value: qualitySummary.formatsLabel },
      { label: 'Verification', value: qualitySummary.verifiedLabel },
    ],
  };
}

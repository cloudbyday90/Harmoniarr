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

import { formatBytes } from './import-candidate-presentation.js';
import {
  buildMissingMusicMatchQualityFit,
  formatMissingMusicFormatsLabel,
  normalizeMissingMusicFormats,
} from './missing-music-release-quality-presentation.js';
import { getMissingMusicCount } from './missing-music-presentation-utils.js';

function formatMissingMusicMatchStatusLabel(status) {
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

function formatMissingMusicMatchStatusTone(status) {
  if (status === 'applied') return 'success';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'downloading' || status === 'import_pending' || status === 'selected') return 'info';
  if (status === 'held') return 'warning';
  return 'neutral';
}

function formatMissingMusicScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : 'Not scored';
}

function formatMissingMusicSpeed(value) {
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

function buildMissingMusicTrackCoverageLabel(trackMatchSummary, fileCount) {
  const matched = getMissingMusicCount(trackMatchSummary?.matchedTrackCount);
  const expected = getMissingMusicCount(trackMatchSummary?.expectedTrackCount);
  if (expected > 0) {
    return `${matched} of ${expected} tracks matched`;
  }

  const files = getMissingMusicCount(fileCount);
  return `${files} file${files === 1 ? '' : 's'}`;
}

function buildMissingMusicMatchReason({ index, match, qualityFit, readiness }) {
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

function buildMissingMusicMatchHealthLabel(match) {
  if (match?.hasFreeUploadSlot) {
    return `Free slot - ${formatMissingMusicSpeed(match.uploadSpeed)}`;
  }

  if (match?.queueLength != null) {
    return `Queue ${match.queueLength} - ${formatMissingMusicSpeed(match.uploadSpeed)}`;
  }

  return formatMissingMusicSpeed(match?.uploadSpeed);
}

export function buildMissingMusicMatchCards(release) {
  const matches = Array.isArray(release?.matchSummary?.matches) ? release.matchSummary.matches : [];
  const readiness = release?.matchSummary?.readiness ?? null;
  const qualityProfile = release?.qualityProfile ?? {};

  return matches.map((match, index) => {
    const qualityFit = buildMissingMusicMatchQualityFit(match, qualityProfile);
    const formats = normalizeMissingMusicFormats(match.formats);
    const fileCount = getMissingMusicCount(match.fileCount);
    const lockedFileCount = getMissingMusicCount(match.lockedFileCount);
    const matchId = match.matchId ?? null;

    return {
      canRejectMatch: Boolean(matchId) && ['held', 'pending', 'selected'].includes(match.status ?? 'pending'),
      canUseMatch: Boolean(matchId) && ['held', 'pending'].includes(match.status ?? 'pending'),
      fileLabel: `${fileCount} file${fileCount === 1 ? '' : 's'}${lockedFileCount > 0 ? `, ${lockedFileCount} locked` : ''}`,
      formatLabel: formatMissingMusicFormatsLabel(formats),
      healthLabel: buildMissingMusicMatchHealthLabel(match),
      id: matchId ?? `match-${index + 1}`,
      matchId,
      isBest: index === 0,
      label: `Match ${index + 1}`,
      qualityRows: qualityFit.detailRows,
      qualityFitLabel: qualityFit.label,
      qualityFitTone: qualityFit.tone,
      reason: buildMissingMusicMatchReason({ index, match, qualityFit, readiness }),
      scoreLabel: formatMissingMusicScore(match.score),
      sizeLabel: formatBytes(Number(match.totalSizeBytes)),
      statusLabel: formatMissingMusicMatchStatusLabel(match.status),
      statusTone: formatMissingMusicMatchStatusTone(match.status),
      trackCoverageLabel: buildMissingMusicTrackCoverageLabel(match.trackMatchSummary, match.fileCount),
    };
  });
}

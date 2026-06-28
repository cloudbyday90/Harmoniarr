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

import { formatQualityDecisionLabel, formatQualityProfileLabel } from './acquisition-quality-presentation.js';

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

  return {
    artistName: release?.artistName ?? 'Unknown artist',
    coverageLabel: `${getCount(release?.matchedTrackCount)} of ${getCount(release?.expectedTrackCount)} tracks`,
    id: release?.id,
    missingTrackCount: getCount(release?.missingTrackCount),
    nextAction: status.nextAction ?? null,
    qualityDecisionLabel: formatQualityDecisionLabel(quality.code),
    qualityProfileLabel: formatQualityProfileLabel(qualityProfile.code),
    releaseDate: release?.releaseDate ?? null,
    releaseTitle: release?.releaseTitle ?? release?.releaseGroupTitle ?? 'Unknown release',
    status,
    statusClass: getMusicQueueStatusClass(status),
  };
}

export function buildMusicQueueSummaryCards(summary = {}) {
  const counts = summary.counts ?? {};
  return [
    {
      key: 'waiting',
      label: 'Waiting',
      value: getCount(counts.queued_for_search) + getCount(counts.searching),
    },
    {
      key: 'working',
      label: 'Working',
      value: getCount(counts.checking_matches) + getCount(counts.downloading) + getCount(counts.adding_to_library),
    },
    {
      key: 'needs-help',
      label: 'Needs help',
      value: getCount(counts.needs_setup)
        + getCount(counts.pick_match)
        + getCount(counts.quality_choice_needed)
        + getCount(counts.needs_help_adding)
        + getCount(counts.failed),
    },
    {
      key: 'done',
      label: 'In library',
      value: getCount(counts.in_library),
    },
  ];
}

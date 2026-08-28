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
import { buildMissingMusicReleaseAction, getMissingMusicReleaseStatusClass } from './missing-music-release-action-presentation.js';
import { buildMissingMusicQualitySummary } from './missing-music-release-quality-presentation.js';
import {
  formatMissingMusicReleaseType,
  getMissingMusicCount,
  getMissingMusicLastActivityAt,
  getMissingMusicReleaseYear,
} from './missing-music-presentation-utils.js';
import { buildMissingMusicReleaseRecoveryPresentation } from './missing-music-release-recovery-presentation.js';
import { formatOperationTimestampShort } from './operation-run-presentation.js';

const DEFAULT_STATUS = Object.freeze({
  code: 'queued_for_search',
  label: 'Queued for search',
  message: 'This release is waiting for the next search pass.',
  tone: 'neutral',
});

function buildMissingMusicMatchSummary(release) {
  const match = release?.evidence?.match ?? {};
  const readiness = match.readiness ?? null;
  const totalCount = getMissingMusicCount(match.totalCount);
  const executionCounts = match.executionStatusCounts ?? {};
  const derivedPendingCount = getMissingMusicCount(match.statusCounts?.pending) + getMissingMusicCount(match.statusCounts?.held);
  return {
    bestCompositeScore: match.bestCompositeScore ?? readiness?.bestCompositeScore ?? null,
    blockedCount: getMissingMusicCount(match.statusCounts?.failed) + getMissingMusicCount(match.statusCounts?.rejected),
    confirmedTransferCount: getMissingMusicCount(match.confirmedTransferCount),
    confirmedTransferCandidateCount: getMissingMusicCount(match.confirmedTransferCandidateCount),
    completedTransferCount: getMissingMusicCount(executionCounts.completed) + getMissingMusicCount(executionCounts.complete),
    label: totalCount === 1 ? '1 match found' : `${totalCount} matches found`,
    matches: Array.isArray(match.matches) ? match.matches : [],
    latestConfirmedTransferAt: match.latestConfirmedTransferAt ?? null,
    message: readiness?.message ?? (totalCount > 0 ? 'Harmoniarr is evaluating the available matches.' : 'No matches have been found yet.'),
    pendingCount: match.pendingCount == null ? derivedPendingCount : getMissingMusicCount(match.pendingCount),
    readiness,
    scoreGap: readiness?.scoreGap ?? null,
    selectedCount: getMissingMusicCount(match.statusCounts?.selected) + getMissingMusicCount(match.statusCounts?.held),
    totalCount,
  };
}

export function normalizeMissingMusicRelease(release) {
  const status = release?.status ?? DEFAULT_STATUS;
  const operatorSelectionEvidence = release?.evidence?.operatorSelection ?? release?.evidence ?? {};
  const quality = release?.quality ?? {};
  const qualityProfile = quality.profile ?? {};
  const lastActivityAt = getMissingMusicLastActivityAt(release);
  const matchSummary = buildMissingMusicMatchSummary(release);
  const qualitySummary = buildMissingMusicQualitySummary(release);
  const releaseTypeLabel = formatMissingMusicReleaseType(release?.releaseGroupType);
  const releaseYear = getMissingMusicReleaseYear(release?.releaseDate);
  const recovery = buildMissingMusicReleaseRecoveryPresentation(status);
  const action = buildMissingMusicReleaseAction(status, recovery);

  return {
    artistName: release?.artistName ?? 'Unknown artist',
    action,
    coverageLabel: `${getMissingMusicCount(release?.matchedTrackCount)} of ${getMissingMusicCount(release?.expectedTrackCount)} tracks`,
    detailText: recovery?.detail ?? status.detail ?? matchSummary.readiness?.message ?? quality.explanation ?? status.message,
    expectedTrackCount: getMissingMusicCount(release?.expectedTrackCount),
    id: release?.id,
    lastActivityAt,
    lastActivityLabel: lastActivityAt ? formatOperationTimestampShort(lastActivityAt) : 'No activity yet',
    matchSummary,
    matchedTrackCount: getMissingMusicCount(release?.matchedTrackCount),
    metadataReleaseGroupId: release?.metadataReleaseGroupId ?? null,
    missingTrackCount: getMissingMusicCount(release?.missingTrackCount),
    nextAction: status.nextAction ?? null,
    progressChips: [
      `${getMissingMusicCount(release?.missingTrackCount)} missing`,
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
    statusClass: getMissingMusicReleaseStatusClass(status),
    statusCode: status.code,
    operatorSelection: {
      selectionOrigin: operatorSelectionEvidence.selectionOrigin ?? null,
      selectionSource: operatorSelectionEvidence.selectionSource ?? null,
      selectionState: operatorSelectionEvidence.selectionState ?? null,
    },
  };
}

export function buildMissingMusicSummaryCards(summary = {}) {
  const counts = summary.counts ?? {};
  return [
    {
      key: 'waiting',
      label: 'Waiting',
      value: getMissingMusicCount(counts.queued_for_search) + getMissingMusicCount(counts.retrying_search),
    },
    {
      key: 'searching',
      label: 'Searching',
      value: getMissingMusicCount(counts.searching) + getMissingMusicCount(counts.checking_matches) + getMissingMusicCount(counts.pick_match),
    },
    {
      key: 'downloading',
      label: 'Downloading',
      value: getMissingMusicCount(counts.downloading) + getMissingMusicCount(counts.trying_next_match),
    },
    {
      key: 'ready-to-add',
      label: 'Ready to add',
      value: getMissingMusicCount(counts.ready_to_add) + getMissingMusicCount(counts.adding_to_library),
    },
    {
      key: 'needs-help',
      label: 'Needs help',
      value: getMissingMusicCount(counts.quality_choice_needed)
        + getMissingMusicCount(counts.needs_help_adding)
        + getMissingMusicCount(counts.no_matches_left)
        + getMissingMusicCount(counts.failed),
    },
    {
      key: 'needs-setup',
      label: 'Needs setup',
      value: getMissingMusicCount(counts.needs_setup),
    },
  ];
}

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

import { buildMissingMusicMatchCards } from './missing-music-match-presentation.js';
import { buildMusicQueueReleaseProgressPresentation } from './music-queue-release-progress-presentation.js';

export function buildMissingMusicMatchReview(release) {
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
    matchCards: buildMissingMusicMatchCards(release),
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

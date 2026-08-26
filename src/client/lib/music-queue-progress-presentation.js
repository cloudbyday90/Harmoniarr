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

const STATUS_PRIORITY = Object.freeze({
  needs_setup: 0,
  quality_choice_needed: 1,
  pick_match: 2,
  needs_help_adding: 3,
  failed: 4,
  no_matches_left: 5,
  ready_to_add: 6,
  adding_to_library: 7,
  downloading: 8,
  trying_next_match: 9,
  searching: 10,
  checking_matches: 11,
  retrying_search: 12,
  queued_for_search: 13,
  in_library: 14,
});

import {
  isMusicQueueAttentionRelease,
  isMusicQueueHomeProgressRelease,
} from './music-queue-progress-state.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryHandoffLocation,
  createSettingsRecoveryContext,
} from './settings-recovery-handoff.js';

function getPriority(release) {
  return STATUS_PRIORITY[release?.statusCode] ?? Number.MAX_SAFE_INTEGER;
}

function compareProgressReleases(left, right) {
  const priorityDifference = getPriority(left) - getPriority(right);
  if (priorityDifference !== 0) return priorityDifference;

  const activityDifference = String(right?.lastActivityAt ?? '').localeCompare(
    String(left?.lastActivityAt ?? ''),
  );
  if (activityDifference !== 0) return activityDifference;

  return String(left?.releaseTitle ?? '').localeCompare(String(right?.releaseTitle ?? ''));
}

function buildRowAction(release, { releaseDetailsOnly, transferProgress }) {
  if (releaseDetailsOnly) {
    return {
      label: 'View details',
      to: {
        name: 'music-queue-release',
        params: { wantedReleaseId: release?.id },
      },
    };
  }

  if (transferProgress?.handoff) {
    return {
      accessibleLabel: transferProgress.handoff.accessibleLabel,
      label: transferProgress.handoff.label,
      to: transferProgress.handoff.location,
    };
  }

  if (release?.statusCode === 'needs_setup' && release?.action?.type === 'route') {
    return {
      label: release.action.label,
      to: buildSettingsRecoveryHandoffLocation({
        recoveryContext: createSettingsRecoveryContext({
          context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
          wantedReleaseId: release?.id,
        }),
        routeName: release.action.routeName,
      }),
    };
  }

  return {
    label: isMusicQueueAttentionRelease(release) ? 'Review' : 'Open Music Queue',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: release?.id },
    },
  };
}

function buildSummary({ activeCount, attentionCount, totalCount }) {
  if (totalCount === 0) {
    return 'Nothing is waiting in Music Queue right now.';
  }

  if (attentionCount > 0 && activeCount > 0) {
    return `${attentionCount} release${attentionCount === 1 ? ' needs' : 's need'} your attention. ${activeCount} ${activeCount === 1 ? 'is' : 'are'} still moving automatically.`;
  }

  if (attentionCount > 0) {
    return `${attentionCount} release${attentionCount === 1 ? ' needs' : 's need'} your attention.`;
  }

  return `${totalCount} release${totalCount === 1 ? ' is' : 's are'} moving through Music Queue automatically.`;
}

/**
 * Shapes the narrow, release-centered status surface used outside the full
 * Music Queue. It deliberately offers navigation only; workflow mutations
 * remain on the release detail where scope and confirmation are visible.
 */
export function buildMusicQueueProgressStrip(releases, {
  activeOrAttentionOnly = false,
  limit = 3,
  releaseDetailsOnly = false,
  transferProgressByRelease = {},
} = {}) {
  const normalizedReleases = Array.isArray(releases) ? releases.filter(Boolean) : [];
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 3, 6));
  const visibleReleases = activeOrAttentionOnly
    ? normalizedReleases.filter(isMusicQueueHomeProgressRelease)
    : normalizedReleases;
  const attentionCount = visibleReleases.filter(isMusicQueueAttentionRelease).length;
  const activeCount = visibleReleases.length - attentionCount;
  const rows = [...visibleReleases]
    .sort(compareProgressReleases)
    .slice(0, normalizedLimit)
    .map((release) => {
      const transferProgress = transferProgressByRelease?.[release.id] ?? null;

      return {
        action: buildRowAction(release, { releaseDetailsOnly, transferProgress }),
        detail: release.detailText || 'Harmoniarr is preparing the next step for this release.',
        id: release.id,
        statusLabel: release.status?.label ?? 'In progress',
        statusTone: release.status?.tone ?? 'neutral',
        title: `${release.releaseTitle} by ${release.artistName}`,
        transferProgress,
      };
    });

  return {
    activeCount,
    attentionCount,
    rows,
    summary: buildSummary({ activeCount, attentionCount, totalCount: visibleReleases.length }),
    totalCount: visibleReleases.length,
  };
}

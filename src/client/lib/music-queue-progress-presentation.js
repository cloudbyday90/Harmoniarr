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
  needs_help_adding: 2,
  failed: 3,
  no_matches_left: 4,
  ready_to_add: 5,
  adding_to_library: 6,
  downloading: 7,
  trying_next_match: 8,
  searching: 9,
  checking_matches: 10,
  pick_match: 11,
  queued_for_search: 12,
  in_library: 13,
});

const ATTENTION_STATUSES = new Set([
  'failed',
  'needs_help_adding',
  'needs_setup',
  'no_matches_left',
  'quality_choice_needed',
]);

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

function buildRowAction(release) {
  if (release?.statusCode === 'needs_setup' && release?.action?.type === 'route') {
    return {
      label: release.action.label,
      to: { name: release.action.routeName },
    };
  }

  return {
    label: ATTENTION_STATUSES.has(release?.statusCode) ? 'Review' : 'Open Music Queue',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: release?.id },
    },
  };
}

function buildSummary({ attentionCount, totalCount }) {
  if (totalCount === 0) {
    return 'Nothing is waiting in Music Queue right now.';
  }

  if (attentionCount > 0) {
    return `${attentionCount} release${attentionCount === 1 ? ' needs' : 's need'} your attention. Everything else continues automatically.`;
  }

  return `${totalCount} release${totalCount === 1 ? ' is' : 's are'} moving through Music Queue automatically.`;
}

/**
 * Shapes the narrow, release-centered status surface used outside the full
 * Music Queue. It deliberately offers navigation only; workflow mutations
 * remain on the release detail where scope and confirmation are visible.
 */
export function buildMusicQueueProgressStrip(releases, { limit = 3 } = {}) {
  const normalizedReleases = Array.isArray(releases) ? releases.filter(Boolean) : [];
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 3, 6));
  const attentionCount = normalizedReleases.filter((release) =>
    ATTENTION_STATUSES.has(release?.statusCode)).length;
  const rows = [...normalizedReleases]
    .sort(compareProgressReleases)
    .slice(0, normalizedLimit)
    .map((release) => ({
      action: buildRowAction(release),
      detail: release.detailText || 'Harmoniarr is preparing the next step for this release.',
      id: release.id,
      statusLabel: release.status?.label ?? 'In progress',
      statusTone: release.status?.tone ?? 'neutral',
      title: `${release.releaseTitle} by ${release.artistName}`,
    }));

  return {
    attentionCount,
    rows,
    summary: buildSummary({ attentionCount, totalCount: normalizedReleases.length }),
    totalCount: normalizedReleases.length,
  };
}

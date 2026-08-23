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

import { isMusicQueueReleaseInScope } from './music-queue-scope-presentation.js';

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

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getMusicQueueFilterState(statusCode) {
  if (['queued_for_search', 'retrying_search'].includes(statusCode)) return 'waiting';
  if (['searching', 'checking_matches', 'pick_match'].includes(statusCode)) return 'searching';
  if (['downloading', 'trying_next_match'].includes(statusCode)) return 'downloading';
  if (['ready_to_add', 'adding_to_library'].includes(statusCode)) return 'ready_to_add';
  if (statusCode === 'needs_setup') return 'needs_setup';
  if (statusCode === 'in_library') return 'in_library';
  if (['quality_choice_needed', 'needs_help_adding', 'no_matches_left', 'failed'].includes(statusCode)) return 'needs_help';
  return 'all';
}

/**
 * Applies deliberate query, type, state, and operator-scope filtering to the
 * normalized Music Queue read model. This is presentation-only and never
 * changes wanted state, provider state, or acquisition policy.
 *
 * @param {Array<object>} releases
 * @param {{query?: string, releaseType?: string, scope?: string, state?: string}} filters
 * @returns {Array<object>}
 */
export function filterMusicQueueReleases(releases, {
  query = '',
  releaseType = 'all',
  scope = 'all',
  state = 'all',
} = {}) {
  const normalizedQuery = normalizeToken(query);
  const normalizedReleaseType = normalizeToken(releaseType);
  const normalizedState = normalizeToken(state);
  const normalizedReleases = Array.isArray(releases) ? releases : [];

  return normalizedReleases.filter((release) => {
    if (!isMusicQueueReleaseInScope(release, scope)) return false;

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
  const normalizedReleases = Array.isArray(releases) ? releases : [];
  const types = [...new Set(normalizedReleases.map((release) => release.releaseTypeLabel).filter(Boolean))].sort();
  return [
    { label: 'All types', value: 'all' },
    ...types.map((type) => ({ label: type, value: type.toLowerCase() })),
  ];
}

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
  isMusicQueueActiveProgressRelease,
  isMusicQueueAttentionRelease,
} from './music-queue-progress-state.js';

export const MUSIC_QUEUE_DEFAULT_SCOPE = 'actions';

export const MUSIC_QUEUE_SCOPE_FILTERS = Object.freeze([
  Object.freeze({ label: 'Actions', value: MUSIC_QUEUE_DEFAULT_SCOPE }),
  Object.freeze({ label: 'In progress', value: 'in-progress' }),
  Object.freeze({ label: 'Scheduled', value: 'scheduled' }),
  Object.freeze({ label: 'All releases', value: 'all' }),
]);

const scheduledStatusCodes = new Set(['queued_for_search', 'retrying_search']);

function normalizeScope(scope) {
  return typeof scope === 'string' ? scope.trim().toLowerCase() : '';
}

function getReleaseStatusCode(release) {
  return release?.statusCode ?? release?.status?.code ?? '';
}

function pluralizeRelease(count) {
  return `${count} release${count === 1 ? '' : 's'}`;
}

/**
 * Returns the mutually exclusive operator-facing scope for a Music Queue
 * release. Stable records deliberately have no dedicated scope: they remain
 * available only through All releases and its deliberate secondary filters.
 *
 * @param {object} release
 * @returns {'actions'|'in-progress'|'scheduled'|'all'}
 */
export function getMusicQueueReleaseScope(release) {
  if (isMusicQueueAttentionRelease(release)) return 'actions';
  if (isMusicQueueActiveProgressRelease(release)) return 'in-progress';
  if (scheduledStatusCodes.has(getReleaseStatusCode(release))) return 'scheduled';
  return 'all';
}

/**
 * @param {object} release
 * @param {string} scope
 * @returns {boolean}
 */
export function isMusicQueueReleaseInScope(release, scope = 'all') {
  const normalizedScope = normalizeScope(scope);
  return normalizedScope === 'all' || getMusicQueueReleaseScope(release) === normalizedScope;
}

/**
 * @param {Array<object>} releases
 * @param {string} scope
 * @returns {Array<object>}
 */
export function filterMusicQueueReleasesByScope(releases, scope = 'all') {
  const normalizedReleases = Array.isArray(releases) ? releases : [];
  return normalizedReleases.filter((release) => isMusicQueueReleaseInScope(release, scope));
}

/**
 * Builds scope controls with their current counts. The controls remain plain
 * native form options in the view; this helper keeps status classification and
 * visible scope language out of the page component.
 *
 * @param {Array<object>} releases
 * @returns {Array<{count: number, label: string, value: string}>}
 */
export function buildMusicQueueScopeFilters(releases) {
  const normalizedReleases = Array.isArray(releases) ? releases : [];
  return MUSIC_QUEUE_SCOPE_FILTERS.map((filter) => ({
    ...filter,
    count: filterMusicQueueReleasesByScope(normalizedReleases, filter.value).length,
  }));
}

/**
 * @param {Array<object>} releases
 * @param {string} scope
 * @returns {{count: number, detail: string, emptyMessage: string, heading: string, status: string}}
 */
export function buildMusicQueueScopePresentation(releases, scope = MUSIC_QUEUE_DEFAULT_SCOPE) {
  const normalizedScope = normalizeScope(scope) || MUSIC_QUEUE_DEFAULT_SCOPE;
  const scopeFilter = MUSIC_QUEUE_SCOPE_FILTERS.find((filter) => filter.value === normalizedScope)
    ?? MUSIC_QUEUE_SCOPE_FILTERS.at(-1);
  const count = filterMusicQueueReleasesByScope(releases, scopeFilter.value).length;
  const progressCount = filterMusicQueueReleasesByScope(releases, 'in-progress').length;
  const actionCount = filterMusicQueueReleasesByScope(releases, 'actions').length;

  if (scopeFilter.value === 'actions') {
    return {
      count,
      detail: progressCount > 0
        ? `Harmoniarr is working automatically on ${pluralizeRelease(progressCount)}.`
        : '',
      emptyMessage: 'No release actions are available right now.',
      heading: scopeFilter.label,
      status: `${pluralizeRelease(count)} ${count === 1 ? 'has an action' : 'have actions'} available`,
    };
  }

  if (scopeFilter.value === 'in-progress') {
    return {
      count,
      detail: actionCount > 0
        ? `${pluralizeRelease(actionCount)} also ${actionCount === 1 ? 'has' : 'have'} an available action.`
        : 'No action is needed while this work continues automatically.',
      emptyMessage: 'No releases are progressing automatically right now.',
      heading: scopeFilter.label,
      status: `${pluralizeRelease(count)} progressing automatically`,
    };
  }

  if (scopeFilter.value === 'scheduled') {
    return {
      count,
      detail: 'Harmoniarr will search automatically when each release is due.',
      emptyMessage: 'No releases are scheduled for automatic search right now.',
      heading: scopeFilter.label,
      status: `${pluralizeRelease(count)} scheduled for automatic search`,
    };
  }

  return {
    count,
    detail: '',
    emptyMessage: 'No releases are being tracked yet.',
    heading: scopeFilter.label,
    status: `${pluralizeRelease(count)} being tracked`,
  };
}

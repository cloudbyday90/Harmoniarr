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

/**
 * Default filter values used when resetting or initialising the import review queue.
 * These match the server-side defaults and are exposed so that UI code and
 * tests share a single canonical source.
 */
export const defaultImportReviewFilters = Object.freeze({
  folderPath: '',
  limit: 25,
  offset: 0,
  sourceSearchId: '',
  status: 'pending',
  username: '',
});

/**
 * Returns a fresh empty queue structure.
 * Used when the server returns no data or when a load fails.
 *
 * @returns {{ candidates: [], filters: object, pagination: object }}
 */
export function createEmptyQueue() {
  return {
    candidates: [],
    filters: {
      folderPath: null,
      sourceSearchId: null,
      status: null,
      username: null,
    },
    pagination: {
      limit: defaultImportReviewFilters.limit,
      offset: defaultImportReviewFilters.offset,
      total: 0,
    },
  };
}

/**
 * Normalises a raw filter field value.
 * Trims whitespace from strings; coerces anything else to an empty string
 * so that filter fields are always sent to the server as clean strings.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeFilterValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalises the payload returned by the list-candidates API call.
 *
 * The server may wrap the array in `{ importCandidates: [...] }` or return
 * a pre-shaped queue object directly. Falls back to an empty queue when the
 * payload is absent.
 *
 * @param {unknown} payload
 * @returns {{ candidates: unknown[], filters: object, pagination: object }}
 */
export function normalizeQueuePayload(payload) {
  return payload?.importCandidates ?? payload ?? createEmptyQueue();
}

/**
 * Normalises the payload returned by the fetch-single-candidate API call.
 *
 * The server may wrap the candidate in `{ importCandidate: {...} }` or return
 * the candidate object directly. Returns null when the payload is absent.
 *
 * @param {unknown} payload
 * @returns {object|null}
 */
export function normalizeCandidatePayload(payload) {
  return payload?.importCandidate ?? payload ?? null;
}

/**
 * Normalises the payload returned by transition API calls (select / hold /
 * reject / reopen).
 *
 * The server may wrap the review in `{ review: {...} }` or return the review
 * object directly. Returns null when the payload is absent.
 *
 * @param {unknown} payload
 * @returns {object|null}
 */
export function normalizeReviewPayload(payload) {
  return payload?.review ?? payload ?? null;
}

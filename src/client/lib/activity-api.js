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

import { apiRequest, buildQueryString } from './api.js';

/**
 * Fetches the household activity feed from `GET /api/v1/activity/feed`.
 *
 * @param {object} [options]
 * @param {number} [options.limit] - Max events to return (default 50).
 * @param {string|null} [options.eventType] - Optional event-type filter.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ ok: boolean, checkedAt: string, events: object[], total: number }>}
 */
export function fetchActivityFeed({ limit, eventType, signal } = {}) {
  return apiRequest(
    `/api/v1/activity/feed${buildQueryString({ limit, eventType })}`,
    { signal },
  );
}

export function fetchActivityBlocklist({ query, signal } = {}) {
  return apiRequest(
    `/api/v1/activity/blocklist${buildQueryString({ q: query })}`,
    { signal },
  );
}

export function fetchActivitySourceUsers({ query, signal, trustState } = {}) {
  return apiRequest(
    `/api/v1/activity/source-users${buildQueryString({ q: query, trustState })}`,
    { signal },
  );
}

export function blockActivitySourceUser({ username, reason, operatorNotes } = {}) {
  return apiRequest('/api/v1/activity/blocklist', {
    body: { operatorNotes, reason, username },
    includeCsrf: true,
    method: 'POST',
  });
}

export function unblockActivitySourceUser(username) {
  return apiRequest(`/api/v1/activity/blocklist/${encodeURIComponent(username)}`, {
    includeCsrf: true,
    method: 'DELETE',
  });
}

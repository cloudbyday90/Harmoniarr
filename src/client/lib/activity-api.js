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

export function fetchActivitySourceUserDetail(username, { historyLimit, historyOffset, signal } = {}) {
  return apiRequest(
    `/api/v1/activity/source-users/${encodeURIComponent(username)}${buildQueryString({ historyLimit, historyOffset })}`,
    { signal },
  );
}

export function exportSourceUserTrustHistory(username, { format = 'json', signal } = {}) {
  return apiRequest(
    `/api/v1/activity/source-users/${encodeURIComponent(username)}/export${buildQueryString({ format })}`,
    { signal },
  );
}

export function updateActivitySourceUserTrust(username, { operatorNotes, reason, trustState } = {}) {
  return apiRequest(`/api/v1/activity/source-users/${encodeURIComponent(username)}`, {
    body: { operatorNotes, reason, trustState },
    includeCsrf: true,
    method: 'PATCH',
  });
}

export function blockActivitySourceUser({ username, reason, operatorNotes } = {}) {
  return apiRequest('/api/v1/activity/blocklist', {
    body: { operatorNotes, reason, username },
    includeCsrf: true,
    method: 'POST',
  });
}

export function bulkBlockActivitySourceUsers({ usernames, reason, operatorNotes } = {}) {
  return apiRequest('/api/v1/activity/blocklist/bulk', {
    body: { operatorNotes, reason, usernames },
    includeCsrf: true,
    method: 'POST',
  });
}

export function bulkUpdateActivitySourceUserTrust({ usernames, reason, operatorNotes, trustState } = {}) {
  return apiRequest('/api/v1/activity/source-users/bulk-trust', {
    body: { operatorNotes, reason, trustState, usernames },
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

export function fetchIgnoredSourceUsers({ signal } = {}) {
  return apiRequest('/api/v1/activity/ignored-source-users', { signal });
}

export function fetchSourceUserIgnoreSuggestions({ signal } = {}) {
  return apiRequest('/api/v1/activity/source-user-ignore-suggestions', { signal });
}

export function applyIgnoredSourceUser({ username, reason, suggestionSignals } = {}) {
  return apiRequest('/api/v1/activity/ignored-source-users', {
    body: { reason, suggestionSignals, username },
    includeCsrf: true,
    method: 'POST',
  });
}

export function removeIgnoredSourceUser(username) {
  return apiRequest(`/api/v1/activity/ignored-source-users/${encodeURIComponent(username)}`, {
    includeCsrf: true,
    method: 'DELETE',
  });
}

export function fetchSourceUserCollusionReport({ minDistinctUsers, signal } = {}) {
  return apiRequest(
    `/api/v1/activity/source-user-collusion${buildQueryString({ minDistinctUsers })}`,
    { signal },
  );
}

export function simulateSourceUserTrustPolicy({ thresholds } = {}) {
  return apiRequest('/api/v1/activity/source-user-trust-policy-simulation', {
    body: { thresholds },
    includeCsrf: true,
    method: 'POST',
  });
}

export function simulateSourceUserSpectralPolicy({ thresholds } = {}) {
  return apiRequest('/api/v1/activity/source-user-spectral-policy-simulation', {
    body: { thresholds },
    includeCsrf: true,
    method: 'POST',
  });
}

export function fetchLibraryFidelityDashboard({ trendDays, worstOffenderLimit, signal } = {}) {
  return apiRequest(
    `/api/v1/activity/library-fidelity-dashboard${buildQueryString({ trendDays, worstOffenderLimit })}`,
    { signal },
  );
}

export function rescanLibrarySpectral({ limit } = {}) {
  return apiRequest('/api/v1/activity/source-user-spectral-rescan', {
    body: { limit },
    includeCsrf: true,
    method: 'POST',
  });
}

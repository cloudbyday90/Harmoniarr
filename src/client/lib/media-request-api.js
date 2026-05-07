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
 * Fetch the current authenticated user's own media requests.
 *
 * Uses the existing scope=mine filter on the shared media-requests endpoint so
 * only the caller's requests are returned. Does not expose other users' data.
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - Maximum number of requests to return.
 * @param {AbortSignal} [options.signal] - Optional abort signal.
 * @returns {Promise<{ mediaRequests: object[], ok: boolean, scope: string }>}
 */
export function fetchMyMediaRequests({ limit = 50, signal } = {}) {
  const query = buildQueryString({ scope: 'mine', limit: limit !== 50 ? limit : undefined });
  return apiRequest(`/api/v1/library/media-requests${query}`, { signal });
}

/**
 * Fetch a notification-bearing summary of the current user's media requests.
 *
 * Returns counts, fulfillment status breakdown, and a notification feed covering
 * delegated-request receipts, fulfillment progress updates, and failures. Always
 * scoped to the current session user — no scope parameter is accepted.
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Optional abort signal.
 * @returns {Promise<{ ok: boolean, scope: string, notificationFeed: object, fulfillmentCounts: object, counts: object }>}
 */
export function fetchMyRequestSummary({ signal } = {}) {
  return apiRequest('/api/v1/library/media-request-summary?scope=mine', { signal });
}

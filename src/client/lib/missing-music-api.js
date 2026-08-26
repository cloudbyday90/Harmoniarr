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
 * Reads only the server-authorized Missing Music decision projection. The
 * server derives household scope from the authenticated session; these filters
 * are never treated as a client authorization assertion.
 */
export function fetchMissingMusicDecisions({
  accountStatus = 'active',
  limit = 50,
  offset = 0,
  q = null,
  requestedForUserId = null,
  scope = 'all',
  state = 'action',
} = {}) {
  return apiRequest(`/api/v1/missing-music/decisions${buildQueryString({
    accountStatus,
    limit,
    offset,
    q,
    requestedForUserId,
    scope,
    state,
 })}`);
}

export function fetchMissingMusicDecisionDetail(decisionId) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('fetchMissingMusicDecisionDetail requires a decisionId');
  }

  return apiRequest(`/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}`);
}

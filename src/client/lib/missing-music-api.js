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
import { createControlPlaneIdempotencyHeaders } from './control-plane-idempotency.js';

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

export function selectMissingMusicDecisionMatch({ decisionId, idempotencyKey = null, matchId } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  const normalizedMatchId = typeof matchId === 'string' ? matchId.trim() : '';
  if (!normalizedDecisionId || !normalizedMatchId) {
    throw new TypeError('selectMissingMusicDecisionMatch requires a decisionId and matchId');
  }

  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/matches/${encodeURIComponent(normalizedMatchId)}/select`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.matches.select'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function startMissingMusicDecisionDownload({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('startMissingMusicDecisionDownload requires a decisionId');
  }

  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/start-download`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.download.start'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

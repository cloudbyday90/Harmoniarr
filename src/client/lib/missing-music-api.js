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
  cursor = null,
  limit = 50,
  offset = 0,
  q = null,
  requestedForUserId = null,
  scope = 'all',
  state = 'action',
} = {}, { signal } = {}) {
  return apiRequest(`/api/v1/missing-music/decisions${buildQueryString({
    accountStatus,
    cursor,
    limit,
    offset,
    q,
    requestedForUserId,
    scope,
    state,
 })}`, { signal });
}

export function fetchMissingMusicDecisionDetail(decisionId, { signal } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('fetchMissingMusicDecisionDetail requires a decisionId');
  }

  return apiRequest(`/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}`, { signal });
}

export function fetchMissingMusicDownloaderHandoff(decisionId) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('fetchMissingMusicDownloaderHandoff requires a decisionId');
  }

  return apiRequest(`/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/downloader-handoff`);
}

export function fetchMissingMusicDownloadReviewHandoff(decisionId, { signal } = {}) {
  return apiRequest(`/api/v1/missing-music/decisions/${encodeURIComponent(decisionId)}/download-review-handoff`, { signal });
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

export function searchMissingMusicDecisionAgain({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('searchMissingMusicDecisionAgain requires a decisionId');
  }

  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/search-again`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.search-again'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function findMissingMusicDecisionMatches({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('findMissingMusicDecisionMatches requires a decisionId');
  }
  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/find-matches`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.find-matches'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function recheckMissingMusicDecisionLibraryAdd({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('recheckMissingMusicDecisionLibraryAdd requires a decisionId');
  }
  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/recheck-library-add`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.recheck-library-add'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function addMissingMusicDecisionToLibrary({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) throw new TypeError('addMissingMusicDecisionToLibrary requires a decisionId');
  return apiRequest(`/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/add-to-library`, {
    body: {},
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey }
      : createControlPlaneIdempotencyHeaders('missing-music.decisions.add-to-library'),
    includeCsrf: true,
    method: 'POST',
  });
}

export function allowMissingMusicDecisionFallbackQuality({ decisionId, idempotencyKey = null } = {}) {
  const normalizedDecisionId = typeof decisionId === 'string' ? decisionId.trim() : '';
  if (!normalizedDecisionId) {
    throw new TypeError('allowMissingMusicDecisionFallbackQuality requires a decisionId');
  }
  return apiRequest(
    `/api/v1/missing-music/decisions/${encodeURIComponent(normalizedDecisionId)}/allow-fallback-quality`,
    {
      body: {},
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('missing-music.decisions.allow-fallback-quality'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

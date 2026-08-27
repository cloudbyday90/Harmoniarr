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

export function fetchMissingMusicReleases({ limit = 100, metadataArtistId = null, offset = 0 } = {}) {
  return apiRequest(`/api/v1/acquisition/releases${buildQueryString({ limit, metadataArtistId, offset })}`);
}

export function fetchMissingMusicRelease(wantedReleaseId) {
  return apiRequest(`/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}`);
}

export function selectMissingMusicMatch({ idempotencyKey = null, wantedReleaseId, matchId, reason } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/matches/${encodeURIComponent(matchId)}/use`,
    {
      body: { reason },
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : createControlPlaneIdempotencyHeaders('acquisition.music-queue.matches.use'),
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function rejectMissingMusicMatch({ wantedReleaseId, matchId, reason } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/matches/${encodeURIComponent(matchId)}/reject`,
    {
      body: { reason },
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function searchMissingMusicReleaseAgain({ wantedReleaseId } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/search-again`,
    {
      body: {},
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function allowMissingMusicFallbackQuality({ wantedReleaseId } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/allow-fallback-quality`,
    {
      body: {},
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function recheckMissingMusicReleaseSafeAdd({ wantedReleaseId } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/recheck-library-add`,
    {
      body: {},
      includeCsrf: true,
      method: 'POST',
    },
  );
}

export function addMissingMusicReleaseToLibrary({ wantedReleaseId } = {}) {
  return apiRequest(
    `/api/v1/acquisition/releases/${encodeURIComponent(wantedReleaseId)}/add-to-library`,
    {
      body: {},
      includeCsrf: true,
      method: 'POST',
    },
  );
}

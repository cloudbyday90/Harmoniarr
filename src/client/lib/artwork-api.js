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

export function fetchArtworkSummary() {
  return apiRequest('/api/v1/artwork/summary');
}

export function fetchArtworkCleanupHistory({ limit } = {}) {
  return apiRequest(`/api/v1/artwork/cleanup-runs${buildQueryString({ limit })}`);
}

export function fetchArtworkCleanupRunDetail(runId) {
  return apiRequest(`/api/v1/artwork/cleanup-runs/${encodeURIComponent(runId)}`);
}

export function startArtworkCleanupRun() {
  return apiRequest('/api/v1/artwork/cleanup-runs', {
    includeCsrf: true,
    method: 'POST',
  });
}

export function patchArtworkDominantColor(assetId, { hue, chroma, lightness }) {
  return apiRequest(`/api/v1/artwork/assets/${encodeURIComponent(assetId)}/dominant-color`, {
    body: JSON.stringify({ hue, chroma, lightness }),
    includeCsrf: true,
    method: 'PATCH',
  });
}

export function resolveArtwork({ ownerType, ownerId, artworkRole, refresh = false }) {
  return apiRequest(`/api/v1/artwork/resolve${buildQueryString({ owner_type: ownerType, owner_id: ownerId, artwork_role: artworkRole, refresh: refresh || undefined })}`);
}

export function batchResolveArtwork(requests) {
  return apiRequest('/api/v1/artwork/resolve-batch', {
    body: { requests },
    method: 'POST',
  });
}

export function fetchArtworkQuota() {
  return apiRequest('/api/v1/artwork/quota');
}

export function fetchArtworkQuotaHistory({ days = 30 } = {}) {
  return apiRequest(`/api/v1/artwork/quota/history${buildQueryString({ days })}`);
}
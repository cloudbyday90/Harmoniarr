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

export function fetchLibraryDiscoverySummary() {
  return apiRequest('/api/v1/library/discovery-summary');
}

export function fetchMediaRequestSummary({ scope } = {}) {
  return apiRequest(`/api/v1/library/media-request-summary${buildQueryString({ scope })}`);
}

export function fetchMediaRequests({ scope, requestState, requestKind, search, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (requestState) params.set('requestState', requestState);
  if (requestKind) params.set('requestKind', requestKind);
  if (search) params.set('search', search);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const query = params.toString();
  return apiRequest(query ? `/api/v1/library/media-requests?${query}` : '/api/v1/library/media-requests');
}

export function fetchMediaRequestDetail({ mediaRequestId }) {
  return apiRequest(`/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}`);
}

export function createMediaRequest(payload) {
  return apiRequest('/api/v1/library/media-requests', {
    body: payload,
    includeCsrf: true,
    method: 'POST',
  });
}

export function fetchLibraryDiscoveryRunDetail(runId) {
  return apiRequest(`/api/v1/library/discovery-runs/${encodeURIComponent(runId)}`);
}

export function startLibraryDiscoveryRun() {
  return apiRequest('/api/v1/library/discovery-runs', {
    method: 'POST',
  });
}

export function fetchLibraryReconciliationSummary() {
  return apiRequest('/api/v1/library/reconciliation-summary');
}

export function fetchLibraryOrganizePreview() {
  return apiRequest('/api/v1/library/organize-preview');
}

export function fetchLibraryWantedSummary() {
  return apiRequest('/api/v1/library/wanted-summary');
}

export function fetchLibraryWantedReleases({ wantedStatus = null, limit = 500 } = {}) {
  const params = new URLSearchParams();
  if (wantedStatus === 'missing' || wantedStatus === 'partial') {
    params.set('status', wantedStatus);
  }
  if (limit && limit !== 500) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  return apiRequest(query ? `/api/v1/library/wanted-releases?${query}` : '/api/v1/library/wanted-releases');
}

export function fetchLibraryReleases({
  reconciliationStatus = null,
  format = null,
  sort = null,
  order = null,
  limit = 500,
  signal = null,
} = {}) {
  const params = new URLSearchParams();
  if (['complete', 'partial', 'duplicate'].includes(reconciliationStatus)) {
    params.set('status', reconciliationStatus);
  }
  if (format) params.set('format', String(format));
  if (sort) params.set('sort', String(sort));
  if (order === 'asc' || order === 'desc') params.set('order', order);
  if (limit && limit !== 500) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  return apiRequest(
    query ? `/api/v1/library/releases?${query}` : '/api/v1/library/releases',
    signal ? { signal } : {},
  );
}

export function fetchLibraryFilterOptions() {
  return apiRequest('/api/v1/library/filter-options');
}

export function fetchReleaseRadar({ recentDays, upcomingDays, limit, signal } = {}) {
  const params = new URLSearchParams();
  if (recentDays != null) params.set('recentDays', String(recentDays));
  if (upcomingDays != null) params.set('upcomingDays', String(upcomingDays));
  if (limit != null) params.set('limit', String(limit));
  const query = params.toString();
  return apiRequest(
    query ? `/api/v1/library/release-radar?${query}` : '/api/v1/library/release-radar',
    signal ? { signal } : {},
  );
}

export function fetchLibraryScanRunDetail(runId) {
  return apiRequest(`/api/v1/library/scan-runs/${encodeURIComponent(runId)}`);
}

export function startLibraryScanRun() {
  return apiRequest('/api/v1/library/scan-runs', {
    method: 'POST',
  });
}

export function cancelMediaRequest({ mediaRequestId, reason }) {
  return apiRequest(`/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/cancel`, {
    body: { reason },
    includeCsrf: true,
    method: 'POST',
  });
}

export function reassignMediaRequest({ mediaRequestId, newRequestedForUserId, reason }) {
  return apiRequest(`/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/reassign`, {
    body: { newRequestedForUserId, reason },
    includeCsrf: true,
    method: 'POST',
  });
}

export function fetchMediaRequestReassignmentHistory({ mediaRequestId }) {
  return apiRequest(`/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/reassignment-history`);
}

export function fetchMediaRequestEvents({ mediaRequestId, cursor, limit } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit != null) params.set('limit', String(limit));
  const query = params.toString();
  return apiRequest(
    query
      ? `/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/events?${query}`
      : `/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/events`,
  );
}

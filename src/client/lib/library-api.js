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

export function fetchMediaRequests({ scope } = {}) {
  return apiRequest(`/api/v1/library/media-requests${buildQueryString({ scope })}`);
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

export function fetchLibraryScanRunDetail(runId) {
  return apiRequest(`/api/v1/library/scan-runs/${encodeURIComponent(runId)}`);
}

export function startLibraryScanRun() {
  return apiRequest('/api/v1/library/scan-runs', {
    method: 'POST',
  });
}

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

import { apiRequest } from './api.js';

export function fetchOperationHistory({ limit } = {}) {
  const searchParams = new URLSearchParams();

  if (limit) {
    searchParams.set('limit', String(limit));
  }

  const query = searchParams.toString();
  return apiRequest(`/api/v1/operations/history${query ? `?${query}` : ''}`);
}

export function fetchOperationRunDetail(runId, { auditLimit } = {}) {
  const searchParams = new URLSearchParams();

  if (auditLimit) {
    searchParams.set('auditLimit', String(auditLimit));
  }

  const query = searchParams.toString();
  return apiRequest(`/api/v1/operations/runs/${encodeURIComponent(runId)}${query ? `?${query}` : ''}`);
}

export function requestOperationRunCancellation(runId) {
  return apiRequest(`/api/v1/operations/runs/${encodeURIComponent(runId)}/cancel`, {
    includeCsrf: true,
    method: 'POST',
  });
}

export function requestOperationRunRetry(runId) {
  return apiRequest(`/api/v1/operations/runs/${encodeURIComponent(runId)}/retry`, {
    includeCsrf: true,
    method: 'POST',
  });
}

export function triggerArtworkCleanup() {
  return apiRequest('/api/v1/artwork/cleanup-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerImportApply() {
  return apiRequest('/api/v1/import-candidates/apply-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerImportExecution() {
  return apiRequest('/api/v1/import-candidates/execution-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerImportMediaInspection() {
  return apiRequest('/api/v1/import-candidates/media-inspection-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerImportTranscode() {
  return apiRequest('/api/v1/import-candidates/transcode-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerLibraryDiscovery() {
  return apiRequest('/api/v1/library/discovery-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerLibraryOrganize() {
  return apiRequest('/api/v1/library/organize-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerLibraryScan() {
  return apiRequest('/api/v1/library/scan-runs', { includeCsrf: true, method: 'POST' });
}

export function triggerNotificationFanout() {
  return apiRequest('/api/v1/system/operator-notification-fanout-runs', { includeCsrf: true, method: 'POST' });
}
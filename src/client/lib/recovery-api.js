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

export function fetchRecoveryStatus({ signal } = {}) {
  return apiRequest('/api/v1/recovery/bootstrap-admin/status', { signal });
}

export function completeRecovery(form) {
  return apiRequest('/api/v1/recovery/bootstrap-admin/complete', {
    method: 'POST',
    body: form,
  });
}

export function fetchBackupExports({ limit, signal } = {}) {
  return apiRequest(`/api/v1/recovery/backups${buildQueryString({ limit })}`, { signal });
}

export function fetchBackupExportById(backupArtifactId, { signal } = {}) {
  return apiRequest(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}`, { signal });
}

export function fetchBackupRestorePreview(backupArtifactId, { signal } = {}) {
  return apiRequest(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}/restore-preview`, { signal });
}

export function startBackupExport() {
  return apiRequest('/api/v1/recovery/backups', {
    headers: createControlPlaneIdempotencyHeaders('recovery.backups.create'),
    includeCsrf: true,
    method: 'POST',
  });
}

export function deleteBackupExport(backupArtifactId) {
  return apiRequest(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}`, {
    headers: createControlPlaneIdempotencyHeaders('recovery.backups.delete'),
    includeCsrf: true,
    method: 'DELETE',
  });
}

export function startBackupRestoreApply(backupArtifactId, { expectedPayloadSha256 } = {}) {
  return apiRequest(`/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}/restore-apply`, {
    body: {
      expectedPayloadSha256,
    },
    headers: createControlPlaneIdempotencyHeaders('recovery.backups.restore-apply'),
    includeCsrf: true,
    method: 'POST',
  });
}

export function buildBackupExportDownloadUrl(backupArtifactId) {
  return `/api/v1/recovery/backups/${encodeURIComponent(backupArtifactId)}/download`;
}

export function fetchQueueDiagnostics({ runLimit, signal } = {}) {
  return apiRequest(`/api/v1/system/diagnostics/queue-state${buildQueryString({ runLimit })}`, { signal });
}

export function fetchRecoveryDiagnostics({ auditLimit, runLimit, signal } = {}) {
  return apiRequest(`/api/v1/system/diagnostics/recovery-state${buildQueryString({ auditLimit, runLimit })}`, { signal });
}



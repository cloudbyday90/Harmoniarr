/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function enterMaintenanceLock(client, {
  idempotencyKey = 'integration-maintenance-lock-enter',
  lockType = 'maintenance',
  reason = 'Integration test maintenance window',
} = {}) {
  return client.requestJson('/api/v1/recovery/maintenance-locks', {
    csrf: true,
    headers: {
      'idempotency-key': idempotencyKey,
    },
    json: {
      lockType,
      reason,
    },
    method: 'POST',
  });
}

export async function releaseMaintenanceLock(client, lockId, {
  idempotencyKey = 'integration-maintenance-lock-release',
} = {}) {
  return client.requestJson(`/api/v1/recovery/maintenance-locks/${lockId}/release`, {
    csrf: true,
    headers: {
      'idempotency-key': idempotencyKey,
    },
    method: 'POST',
  });
}

export async function createBackupExport(client, {
  idempotencyKey = 'integration-backup-export-create',
} = {}) {
  return client.requestJson('/api/v1/recovery/backups', {
    csrf: true,
    headers: {
      'idempotency-key': idempotencyKey,
    },
    method: 'POST',
  });
}

export async function listBackupExports(client, {
  limit,
} = {}) {
  const searchParams = new URLSearchParams();

  if (limit !== undefined && limit !== null) {
    searchParams.set('limit', String(limit));
  }

  const path = searchParams.size > 0
    ? `/api/v1/recovery/backups?${searchParams.toString()}`
    : '/api/v1/recovery/backups';

  return client.requestJson(path);
}

export async function getBackupExportById(client, backupArtifactId) {
  return client.requestJson(`/api/v1/recovery/backups/${backupArtifactId}`);
}

export async function getBackupRestorePreview(client, backupArtifactId) {
  return client.requestJson(`/api/v1/recovery/backups/${backupArtifactId}/restore-preview`);
}

export async function startBackupRestoreApply(client, backupArtifactId, {
  expectedPayloadSha256,
  idempotencyKey = 'integration-backup-restore-apply',
} = {}) {
  return client.requestJson(`/api/v1/recovery/backups/${backupArtifactId}/restore-apply`, {
    csrf: true,
    headers: {
      'idempotency-key': idempotencyKey,
    },
    json: {
      expectedPayloadSha256,
    },
    method: 'POST',
  });
}

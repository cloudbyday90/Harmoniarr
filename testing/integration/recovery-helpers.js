/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function acquireIntegrationLock(pool, {
  lockType = 'restore',
  reason = 'Integration test lock',
  acquiredByUserId = null,
  ownerInstanceId = null,
  expiresAt = null,
} = {}) {
  const result = await pool.query(
    `
      INSERT INTO maintenance_locks (
        lock_type, status, owner_instance_id, reason,
        acquired_by_user_id, acquired_at, expires_at, released_at
      )
      VALUES ($1, 'active', $2, $3, $4, NOW(), $5::timestamptz, NULL)
      RETURNING id, lock_type, status, reason, acquired_by_user_id, acquired_at, expires_at, released_at, created_at
    `,
    [lockType, ownerInstanceId, reason, acquiredByUserId, expiresAt ?? null],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    lockType: row.lock_type,
    status: row.status,
    reason: row.reason,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
  };
}

export async function releaseIntegrationLock(pool, lockId) {
  await pool.query(
    `UPDATE maintenance_locks SET status = 'released', released_at = NOW() WHERE id = $1`,
    [lockId],
  );
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

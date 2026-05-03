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

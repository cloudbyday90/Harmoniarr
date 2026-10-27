/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startSessionWriteTransaction } from '../../session-write-transaction-service.js';
import { createMaintenanceLockService } from '../../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../recovery/maintenance-lock-write-guard-service.js';
import { recordAuditEvent } from '../../audit.js';
import { classifyPlexCallbackRetention, plexCallbackRetentionBatchSize } from './plex-callback-retention-policy.js';
import { claimPlexCallbackRetention, lockPlexCallbackRetentionBatch, deletePlexCallbackRetentionBatch } from './plex-callback-retention-store.js';

export function createPlexCallbackRetentionService({ startTransactionFn = startSessionWriteTransaction,
  encryptedSecretService = createEncryptedSecretService(), recordAuditEventFn = recordAuditEvent,
  maintenanceGuard = createMaintenanceLockWriteGuardService(createMaintenanceLockService()), batchSize = plexCallbackRetentionBatchSize } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > plexCallbackRetentionBatchSize) throw new TypeError('A bounded callback retention batch is required');
  let cursor = null;
  return { startPrune() {
    const acceptedCursor = cursor;
    const task = startTransactionFn(async (client, check) => {
      await maintenanceGuard.assertNoActiveWriteLocks({ operationLabel: 'Plex callback retention', queryable: client }); check();
      const claim = await claimPlexCallbackRetention(client); check();
      if (claim?.acquired !== true) return { skipped: true, reason: 'busy' };
      const rows = await lockPlexCallbackRetentionBatch(client, { cursor: acceptedCursor, batchSize }); check();
      const selected = [], counts = { expired: 0, legacy: 0, active: 0, recent: 0, unknown: 0, unreadable: 0 };
      for (const row of rows) {
        check(); let plaintext = null;
        if (Buffer.isBuffer(row.encrypted_value)) {
          try { plaintext = encryptedSecretService.decryptSecretRecord(row); } catch { /* Retain unreadable records. */ }
        }
        const classification = classifyPlexCallbackRetention({ plaintext, observedAt: claim.observed_at, createdAt: row.created_at, updatedAt: row.updated_at });
        counts[classification.reason]++;
        if (classification.deleteAfter) selected.push({ id: row.id, deleteAfter: classification.deleteAfter });
      }
      await deletePlexCallbackRetentionBatch(client, selected); check();
      if (selected.length) {
        await recordAuditEventFn({ actorType: 'system', eventType: 'plex_callback_state_pruned', required: true,
          summary: 'Expired provider callback state removed', details: { inspectedCount: rows.length, deletedCount: selected.length,
            expiredCount: counts.expired, legacyCount: counts.legacy } }, client); check();
      }
      const last = rows.at(-1);
      return { skipped: false, inspectedCount: rows.length, deletedCount: selected.length, counts,
        nextCursor: rows.length === batchSize ? { name: last.name, id: last.id } : null };
    }, { errorCode: 'plex_callback_retention_unavailable' });
    return { drained: task.drained, result: task.result.then(result => {
      if (result.skipped) return result;
      const { nextCursor, ...summary } = result; cursor = nextCursor; return summary;
    }) };
  } };
}

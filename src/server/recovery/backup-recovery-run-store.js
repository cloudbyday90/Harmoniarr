/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createOperationRunStore } from '../operation-run-store.js';
import { createJobLeaseStore } from '../job-lease-store.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

export function createBackupRecoveryRunStore({ getPoolFn = getPool, withTransaction = createDatabaseTransactionRunner({ getPoolFn }) } = {}) {
  const descriptor = operationRunRegistry.backupArtifactRecovery, store = createOperationRunStore({
    getPoolFn, ...descriptor,
    createJobLeaseStoreFn: options => createJobLeaseStore({ ...options, leaseDurationMs: 30_000 })
  });
  async function queueStartupRecovery() {
    return withTransaction(async queryable => {
      await queryable.query("SET LOCAL lock_timeout='2s'"); await queryable.query("SET LOCAL statement_timeout='5s'");
      await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.backup-startup-recovery',0))");
      const through = (await queryable.query('SELECT clock_timestamp()::text AS through')).rows[0].through;
      const pending = await queryable.query(`SELECT id FROM operation_runs WHERE operation_type=$1 AND status='pending' AND attempt_count=0 AND claimed_at IS NULL
        AND NOT (summary ? 'backupRecoveryAfter') ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [descriptor.operationType]);
      if (pending.rows[0]) {
        await queryable.query("UPDATE operation_runs SET summary=summary||jsonb_build_object('backupRecoveryThrough',$2::text) WHERE id=$1", [pending.rows[0].id, through]);
        return { runId: pending.rows[0].id, coalesced: true };
      }
      const run = await store.createOperationRun({ queryable, maxAttempts: 3, summary: { triggerSource: 'startup', backupRecoveryThrough: through, currentStep: 'Backup recovery queued' } });
      return { runId: run.id, coalesced: false };
    });
  }
  async function getJournalCounts() {
    const result = await getPoolFn().query(`SELECT count(*)::int AS unfinished_count,
      count(*) FILTER(WHERE status='awaiting_confirmation')::int AS confirmation_count FROM backup_artifact_file_operations
      WHERE status IN ('prepared','temporary_ready','finalized','awaiting_confirmation')`);
    return { unfinishedCount: result.rows[0].unfinished_count, confirmationCount: result.rows[0].confirmation_count };
  }
  return { ...store, queueStartupRecovery, getJournalCounts };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from './database.js';
import { createDatabaseTransactionRunner } from './database-transaction-service.js';
import { normalizeJobLease } from './job-lease-store.js';
import { normalizeExpectedJobLease, isCurrentJobLeaseAcquisition } from './job-lease-policy.js';
import { lockJobLeaseKey } from './job-lease-lock-store.js';
import { writableExecutionRunSql } from './import-candidates/import-execution-origin-sql.js';

/** Every leased lifecycle mutation observes the parent and its exact acquisition under ordered locks. */
export function createOperationRunOwnedLifecycleStore({ getPoolFn = getPool, operationType, leaseJobType = operationType,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }) } = {}) {
  async function withOwnedRun({ runId, expectedLease }, work) {
    const leaseKey = `${leaseJobType}:${runId}`;
    const expected = normalizeExpectedJobLease(expectedLease, { leaseKey });
    if (!expected) return false;
    return withTransaction(async (queryable) => {
      const parent = await queryable.query(`SELECT * FROM operation_runs WHERE id=$1::uuid AND operation_type=$2
        AND ${writableExecutionRunSql('operation_runs')} FOR UPDATE`, [runId, operationType]);
      const run = parent.rows[0];
      if (!run) return false;
      const leaseRow = await lockJobLeaseKey({ leaseKey, queryable });
      const clock = await queryable.query('SELECT clock_timestamp() AS observed_at');
      const lease = normalizeJobLease(leaseRow);
      const observedAt = clock.rows[0].observed_at;
      const now = observedAt instanceof Date ? observedAt.getTime() : Date.parse(observedAt);
      if (!isCurrentJobLeaseAcquisition(lease, expected, { leaseKey, now })) return false;
      return work({ run, lease, expectedLease: expected, queryable });
    });
  }
  async function writeLifecycle({ runId, action, summary, expectedLease, errorMessage = null, nextAttemptAt = null, queryable }) {
    const expected = normalizeExpectedJobLease(expectedLease, { leaseKey: `${leaseJobType}:${runId}` });
    if (!expected) return false;
    const sets = {
      started: `status='running',summary=COALESCE(summary,'{}'::jsonb)||$2::jsonb,
        attempt_count=GREATEST(attempt_count,1),error_message=NULL`,
      completed: `status='completed',finished_at=clock_timestamp(),error_message=NULL`,
      failed: `status='failed',finished_at=clock_timestamp(),error_message=$3::text`,
      cancelled: `status='cancelled',finished_at=clock_timestamp(),cancelled_at=clock_timestamp(),error_message=NULL`,
      retry: `status='pending',finished_at=NULL,error_message=NULL,next_attempt_at=$4::timestamptz,
        summary=COALESCE(summary,'{}'::jsonb)||$2::jsonb`,
      paused: `status='pending',finished_at=NULL,error_message=NULL,next_attempt_at=COALESCE($4::timestamptz,clock_timestamp()),
        attempt_count=GREATEST(attempt_count-1,0),summary=COALESCE(summary,'{}'::jsonb)||$2::jsonb`,
    };
    if (!Object.hasOwn(sets, action)) throw new TypeError('Unknown leased lifecycle action');
    const preserves = ['started', 'retry', 'paused'].includes(action);
    const result = await queryable.query(`WITH lifecycle_inputs AS (SELECT $3::text AS error_message,$4::timestamptz AS next_attempt_at)
      UPDATE operation_runs SET ${sets[action]},
      claimed_at=NULL,claimed_by_instance_id=NULL${preserves ? '' : `,
        summary=CASE WHEN summary ? 'musicQueueRecovery' OR summary ? 'downloadPreparationProtocol' OR summary->>'triggerSource'='missing_music_manual'
          THEN COALESCE(summary,'{}'::jsonb)||$2::jsonb ELSE $2::jsonb END`}
      WHERE id=$1::uuid AND ${writableExecutionRunSql('operation_runs')}
        ${action === 'paused' ? "AND status IN ('pending','running')" : ''}
        AND EXISTS(SELECT 1 FROM job_leases WHERE lease_key=$7::text AND owner_instance_id=$6::text
          AND acquisition_id=$5::uuid AND released_at IS NULL AND expires_at>clock_timestamp()) RETURNING id`,
    [runId, JSON.stringify(summary), errorMessage, nextAttemptAt, expected.acquisitionId, expected.ownerInstanceId, expected.leaseKey]);
    return result.rowCount === 1;
  }
  return { withOwnedRun, writeLifecycle };
}

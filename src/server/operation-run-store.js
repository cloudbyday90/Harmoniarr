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

import { getPool } from './database.js';
import { buildJobLeaseKey, createJobLeaseStore } from './job-lease-store.js';
import { createOperationRetryPolicyService } from './operation-retry-policy-service.js';

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeRunSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }

  return summary;
}

function clampRetainCountPerType(retainCountPerType) {
  return Math.max(1, Math.min(Number.isInteger(retainCountPerType) ? retainCountPerType : 50, 1000));
}

/**
 * Global, cross-operation-type retention sweep for the operation-run ledger.
 *
 * Honors both an age ceiling (delete terminal runs older than `olderThanIso`)
 * and a per-type minimum-retention floor (always keep the newest
 * `retainCountPerType` terminal runs of each operation type, oldest deleted
 * first). This is the explicit, policy-driven replacement for the legacy
 * inline pruning that ran as part of normal operation completion.
 */
export async function pruneOperationRunsLedger({
  getPoolFn = getPool,
  olderThanIso,
  retainCountPerType,
} = {}) {
  if (!olderThanIso) {
    return { prunedCount: 0 };
  }

  const clampedRetainCount = clampRetainCountPerType(retainCountPerType);
  const result = await getPoolFn().query(
    `
      DELETE FROM operation_runs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND COALESCE(finished_at, cancelled_at, started_at, created_at) < $1
        AND id NOT IN (
          SELECT id
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY operation_type
                     ORDER BY COALESCE(started_at, created_at) DESC
                   ) AS rn
            FROM operation_runs
            WHERE status IN ('completed', 'failed', 'cancelled')
          ) ranked
          WHERE ranked.rn <= $2
        )
    `,
    [olderThanIso, clampedRetainCount],
  );

  return { prunedCount: result.rowCount ?? 0 };
}

/**
 * Counts the operation runs that {@link pruneOperationRunsLedger} would delete
 * for the same inputs, without mutating the ledger (dry-run / preview).
 */
export async function countPrunableOperationRuns({
  getPoolFn = getPool,
  olderThanIso,
  retainCountPerType,
} = {}) {
  if (!olderThanIso) {
    return { prunableCount: 0 };
  }

  const clampedRetainCount = clampRetainCountPerType(retainCountPerType);
  const result = await getPoolFn().query(
    `
      SELECT COUNT(*)::int AS prunable_count
      FROM operation_runs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND COALESCE(finished_at, cancelled_at, started_at, created_at) < $1
        AND id NOT IN (
          SELECT id
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY operation_type
                     ORDER BY COALESCE(started_at, created_at) DESC
                   ) AS rn
            FROM operation_runs
            WHERE status IN ('completed', 'failed', 'cancelled')
          ) ranked
          WHERE ranked.rn <= $2
        )
    `,
    [olderThanIso, clampedRetainCount],
  );

  return { prunableCount: result.rows[0]?.prunable_count ?? 0 };
}

function normalizeOperationRun(row) {
  if (!row) {
    return null;
  }

  return {
    attemptCount: toNumberOrNull(row.attempt_count),
    cancelRequestedAt: row.cancel_requested_at?.toISOString?.() ?? row.cancel_requested_at ?? null,
    cancelRequestedByUserId: row.cancel_requested_by_user_id ?? null,
    cancelledAt: row.cancelled_at?.toISOString?.() ?? row.cancelled_at ?? null,
    claimedAt: row.claimed_at?.toISOString?.() ?? row.claimed_at ?? null,
    claimedByInstanceId: row.claimed_by_instance_id ?? null,
    errorMessage: row.error_message ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    id: row.id,
    maxAttempts: toNumberOrNull(row.max_attempts),
    nextAttemptAt: row.next_attempt_at?.toISOString?.() ?? row.next_attempt_at ?? null,
    operationType: row.operation_type ?? null,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    summary: normalizeRunSummary(row.summary),
  };
}

function createOperationRunLeaseUnavailableError({ runId }) {
  const error = new Error('Operation run lease is currently held by another worker');
  error.code = 'operation_run_lease_unavailable';
  error.runId = runId;
  return error;
}

export function createOperationRunStore({
  createJobLeaseStoreFn = createJobLeaseStore,
  getPoolFn = getPool,
  leaseJobType = null,
  operationType,
  retryPolicyService = createOperationRetryPolicyService(),
} = {}) {
  if (!operationType) {
    throw new Error('operationType is required');
  }

  const resolvedLeaseJobType = leaseJobType ?? operationType;
  const jobLeaseStore = createJobLeaseStoreFn({ getPoolFn });

  function buildLeaseKey(runId) {
    return buildJobLeaseKey({
      jobType: resolvedLeaseJobType,
      runId,
    });
  }

  function normalizeRecentRunLimit(limit) {
    const parsed = Number.parseInt(limit, 10);

    if (!Number.isInteger(parsed) || parsed < 1) {
      return 10;
    }

    return Math.min(parsed, 25);
  }

  async function createOperationRun({ maxAttempts = 1, nextAttemptAt = null, status = 'pending', summary = {}, triggeredByUserId = null }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO operation_runs (
          operation_type,
          status,
          started_at,
          triggered_by_user_id,
          summary,
          next_attempt_at,
          max_attempts
        )
        VALUES ($1, $2, NOW(), $3, $4::jsonb, COALESCE($5::timestamptz, NOW()), $6)
        RETURNING id, operation_type, status, started_at, finished_at, summary, error_message, cancel_requested_at, cancel_requested_by_user_id, cancelled_at, next_attempt_at, attempt_count, max_attempts, claimed_at, claimed_by_instance_id
      `,
      [operationType, status, triggeredByUserId, JSON.stringify(normalizeRunSummary(summary)), nextAttemptAt, maxAttempts],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function getActiveRun() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message, cancel_requested_at, cancel_requested_by_user_id, cancelled_at, next_attempt_at, attempt_count, max_attempts, claimed_at, claimed_by_instance_id
        FROM operation_runs
        WHERE operation_type = $1
          AND status IN ('pending', 'running')
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationType],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function getLatestRun() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message, cancel_requested_at, cancel_requested_by_user_id, cancelled_at, next_attempt_at, attempt_count, max_attempts, claimed_at, claimed_by_instance_id
        FROM operation_runs
        WHERE operation_type = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationType],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function getRunById(runId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message, cancel_requested_at, cancel_requested_by_user_id, cancelled_at, next_attempt_at, attempt_count, max_attempts, claimed_at, claimed_by_instance_id
        FROM operation_runs
        WHERE operation_type = $1
          AND id = $2
        LIMIT 1
      `,
      [operationType, runId],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function listRecentRuns({ limit = 10 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message, cancel_requested_at, cancel_requested_by_user_id, cancelled_at, next_attempt_at, attempt_count, max_attempts, claimed_at, claimed_by_instance_id
        FROM operation_runs
        WHERE operation_type = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT $2
      `,
      [operationType, normalizeRecentRunLimit(limit)],
    );

    return result.rows.map(normalizeOperationRun);
  }

  async function markRunStarted({ runId, summary = {} }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'running',
            summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb,
          attempt_count = GREATEST(attempt_count, 1),
          claimed_at = NULL,
          claimed_by_instance_id = NULL,
            error_message = NULL
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary))],
    );
  }

  async function markRunCompleted({ runId, summary = {} }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'completed',
            finished_at = NOW(),
            summary = $2::jsonb,
          claimed_at = NULL,
          claimed_by_instance_id = NULL,
            error_message = NULL
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary))],
    );
  }

  async function markRunFailed({ runId, summary = {}, errorMessage }) {
    const pool = getPoolFn();

    const existingRun = await getRunById(runId);
    const retrySchedule = retryPolicyService.buildRetrySchedule({
      attemptCount: existingRun?.attemptCount,
      maxAttempts: existingRun?.maxAttempts,
    });

    if (retrySchedule) {
      await pool.query(
        `
          UPDATE operation_runs
          SET status = 'pending',
              finished_at = NULL,
              summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb,
              claimed_at = NULL,
              claimed_by_instance_id = NULL,
              error_message = NULL,
              next_attempt_at = $3::timestamptz
          WHERE id = $1
        `,
        [
          runId,
          JSON.stringify({
            ...normalizeRunSummary(summary),
            currentStep: 'Automatic retry scheduled after failed attempt',
            lastFailureMessage: errorMessage,
            retryScheduledAt: retrySchedule.nextAttemptAt,
          }),
          retrySchedule.nextAttemptAt,
        ],
      );
      return;
    }

    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'failed',
            finished_at = NOW(),
            summary = $2::jsonb,
          claimed_at = NULL,
          claimed_by_instance_id = NULL,
            error_message = $3
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary)), errorMessage],
    );
  }

  async function pruneOldRuns({ retainCount = 20 } = {}) {
    const clampedRetainCount = Math.max(1, Math.min(Number.isInteger(retainCount) ? retainCount : 20, 1000));
    const pool = getPoolFn();
    await pool.query(
      `
        DELETE FROM operation_runs
        WHERE operation_type = $1
          AND status IN ('completed', 'failed', 'cancelled')
          AND id NOT IN (
            SELECT id
            FROM operation_runs
            WHERE operation_type = $1
              AND status IN ('completed', 'failed', 'cancelled')
            ORDER BY COALESCE(started_at, created_at) DESC
            LIMIT $2
          )
      `,
      [operationType, clampedRetainCount],
    );
  }

  async function isCancellationRequested({ runId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT cancel_requested_at
        FROM operation_runs
        WHERE id = $1
          AND operation_type = $2
          AND cancelled_at IS NULL
        LIMIT 1
      `,
      [runId, operationType],
    );

    return Boolean(result.rows[0]?.cancel_requested_at);
  }

  async function markRunCancelled({ runId, summary = {} }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'cancelled',
            finished_at = NOW(),
            cancelled_at = NOW(),
            summary = $2::jsonb,
          claimed_at = NULL,
          claimed_by_instance_id = NULL,
            error_message = NULL
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary))],
    );
  }

  async function markRunPaused({ nextAttemptAt = null, runId, summary = {} }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'pending',
            finished_at = NULL,
            summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb,
            claimed_at = NULL,
            claimed_by_instance_id = NULL,
            error_message = NULL,
            next_attempt_at = COALESCE($3::timestamptz, NOW()),
            attempt_count = GREATEST(attempt_count - 1, 0)
        WHERE id = $1
          AND status IN ('pending', 'running')
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary)), nextAttemptAt],
    );
  }

  async function acquireLease({ runId }) {
    const lease = await jobLeaseStore.acquireLease({
      jobType: resolvedLeaseJobType,
      leaseKey: buildLeaseKey(runId),
    });

    if (!lease) {
      throw createOperationRunLeaseUnavailableError({ runId });
    }

    return lease;
  }

  async function getLease({ runId }) {
    return jobLeaseStore.getLease({
      leaseKey: buildLeaseKey(runId),
    });
  }

  async function renewLease({ runId, status = 'active' } = {}) {
    return jobLeaseStore.renewLease({
      leaseKey: buildLeaseKey(runId),
      status,
    });
  }

  async function releaseLease({ runId, status }) {
    return jobLeaseStore.releaseLease({
      leaseKey: buildLeaseKey(runId),
      status,
    });
  }

  return {
    acquireLease,
    createOperationRun,
    getActiveRun,
    getLease,
    getLatestRun,
    getRunById,
    isCancellationRequested,
    markRunPaused,
    listRecentRuns,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    pruneOldRuns,
    releaseLease,
    renewLease,
  };
}

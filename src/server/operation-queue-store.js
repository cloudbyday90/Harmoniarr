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
import { createDatabaseTransactionRunner } from './database-transaction-service.js';
import { createJobLeaseStore, normalizeJobLease } from './job-lease-store.js';
import { normalizeExpectedJobLease, isCurrentJobLeaseAcquisition } from './job-lease-policy.js';
import { lockJobLeaseKey } from './job-lease-lock-store.js';
import { writableExecutionRunSql } from './import-candidates/import-execution-origin-sql.js';

const defaultClaimTimeoutMs = 60 * 1000;

function buildDefaultClaimOwnerInstanceId() {
  return process.env.HARMONIARR_INSTANCE_ID ?? `pid:${process.pid}`;
}

function normalizeClaimTimeoutMs(claimTimeoutMs) {
  const parsed = Number.parseInt(claimTimeoutMs, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultClaimTimeoutMs;
  }

  return Math.min(parsed, 60 * 60 * 1000);
}

function normalizeOperationTypes(operationTypes) {
  if (!Array.isArray(operationTypes)) {
    return [];
  }

  return operationTypes
    .filter((operationType) => typeof operationType === 'string')
    .map((operationType) => operationType.trim())
    .filter(Boolean);
}

function normalizeRecoveryLimit(limit) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, 100);
}

function normalizeRunSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }

  const normalized = { ...summary };
  delete normalized.downloadPreparationProtocol;
  delete normalized.downloadPreparationClosure;
  return normalized;
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toIsoString(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function toOperationRun(row) {
  if (!row) {
    return null;
  }

  return {
    attemptCount: toNumberOrNull(row.attempt_count),
    cancelRequestedAt: toIsoString(row.cancel_requested_at),
    cancelRequestedByUserId: row.cancel_requested_by_user_id ?? null,
    cancelledAt: toIsoString(row.cancelled_at),
    claimedAt: toIsoString(row.claimed_at),
    claimedByInstanceId: row.claimed_by_instance_id ?? null,
    errorMessage: row.error_message ?? null,
    finishedAt: toIsoString(row.finished_at),
    id: row.id,
    maxAttempts: toNumberOrNull(row.max_attempts),
    nextAttemptAt: toIsoString(row.next_attempt_at),
    operationType: row.operation_type,
    startedAt: toIsoString(row.started_at),
    status: row.status,
    summary: normalizeRunSummary(row.summary),
    triggeredByUserId: row.triggered_by_user_id ?? null,
  };
}

export function createOperationQueueStore({
  claimOwnerInstanceId = buildDefaultClaimOwnerInstanceId(),
  claimTimeoutMs = defaultClaimTimeoutMs,
  getPoolFn = getPool,
} = {}) {
  const resolvedClaimTimeoutMs = normalizeClaimTimeoutMs(claimTimeoutMs);

  async function claimNextRunnableRun({ operationTypes } = {}) {
    const result = await getPoolFn().query(
      `
        WITH candidate AS (
          SELECT id
          FROM operation_runs
          WHERE status = 'pending'
            AND ${writableExecutionRunSql('operation_runs')}
            AND next_attempt_at <= NOW()
            AND attempt_count < max_attempts
            AND (
              COALESCE(array_length($1::text[], 1), 0) = 0
              OR operation_type = ANY($1::text[])
            )
            AND (
              claimed_at IS NULL
              OR claimed_at <= NOW() - ($3 * INTERVAL '1 millisecond')
            )
            AND NOT EXISTS (
              SELECT 1
              FROM operation_runs AS active_runs
              WHERE active_runs.id <> operation_runs.id
                AND active_runs.operation_type = operation_runs.operation_type
                AND (
                  active_runs.status = 'running'
                  OR (
                    active_runs.status = 'pending'
                    AND active_runs.claimed_at IS NOT NULL
                    AND active_runs.claimed_at > NOW() - ($3 * INTERVAL '1 millisecond')
                  )
                )
            )
          ORDER BY next_attempt_at ASC, started_at ASC, created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE operation_runs AS runs
        SET claimed_at = NOW(),
            claimed_by_instance_id = $2,
            attempt_count = attempt_count + 1
        FROM candidate
        WHERE runs.id = candidate.id
        RETURNING runs.*
      `,
      [normalizeOperationTypes(operationTypes), claimOwnerInstanceId, resolvedClaimTimeoutMs],
    );

    return toOperationRun(result.rows[0]);
  }

  async function scheduleRetry({ maxAttempts = null, nextAttemptAt = null, runId }) {
    const result = await getPoolFn().query(
      `
        UPDATE operation_runs
        SET status = 'pending',
            finished_at = NULL,
            error_message = NULL,
            cancel_requested_at = NULL,
            cancel_requested_by_user_id = NULL,
            cancelled_at = NULL,
            next_attempt_at = COALESCE($2::timestamptz, NOW()),
            max_attempts = COALESCE($3, GREATEST(max_attempts, attempt_count + 1)),
            claimed_at = NULL,
            claimed_by_instance_id = NULL
        WHERE id = $1
          AND ${writableExecutionRunSql('operation_runs')}
        RETURNING
          id,
          operation_type,
          status,
          started_at,
          finished_at,
          triggered_by_user_id,
          summary,
          error_message,
          cancel_requested_at,
          cancel_requested_by_user_id,
          cancelled_at,
          next_attempt_at,
          attempt_count,
          max_attempts,
          claimed_at,
          claimed_by_instance_id
      `,
      [runId, nextAttemptAt, maxAttempts],
    );

    return toOperationRun(result.rows[0]);
  }

  async function listRecoverableRuns({ limit = 25, operationTypes } = {}) {
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          operation_type,
          status,
          started_at,
          finished_at,
          triggered_by_user_id,
          summary,
          error_message,
          cancel_requested_at,
          cancel_requested_by_user_id,
          cancelled_at,
          next_attempt_at,
          attempt_count,
          max_attempts,
          claimed_at,
          claimed_by_instance_id
        FROM operation_runs
        WHERE status = 'running'
          AND (
            COALESCE(array_length($1::text[], 1), 0) = 0
            OR operation_type = ANY($1::text[])
          )
        ORDER BY started_at ASC, created_at ASC
        LIMIT $2
      `,
      [normalizeOperationTypes(operationTypes), normalizeRecoveryLimit(limit)],
    );

    return result.rows.map(toOperationRun);
  }

  async function recoverRunForRetry({ maxAttempts = null, nextAttemptAt, runId, summary = {}, queryable }) {
    const result = await queryable.query(
      `
        UPDATE operation_runs
        SET status = CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' ELSE 'pending' END,
            finished_at = CASE WHEN cancel_requested_at IS NOT NULL THEN NOW() ELSE NULL END,
            summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb ||
              CASE WHEN cancel_requested_at IS NOT NULL THEN jsonb_build_object(
                'currentStep', 'Cancellation completed after stranded run recovery',
                'retryScheduledAt', NULL
              ) ELSE '{}'::jsonb END,
            error_message = NULL,
            cancelled_at = CASE WHEN cancel_requested_at IS NOT NULL THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
            next_attempt_at = CASE WHEN cancel_requested_at IS NOT NULL THEN next_attempt_at ELSE $3::timestamptz END,
            max_attempts = COALESCE($4, max_attempts),
            claimed_at = NULL,
            claimed_by_instance_id = NULL
        WHERE id = $1
          AND status = 'running'
          AND ${writableExecutionRunSql('operation_runs')}
        RETURNING
          id,
          operation_type,
          status,
          started_at,
          finished_at,
          triggered_by_user_id,
          summary,
          error_message,
          cancel_requested_at,
          cancel_requested_by_user_id,
          cancelled_at,
          next_attempt_at,
          attempt_count,
          max_attempts,
          claimed_at,
          claimed_by_instance_id
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary)), nextAttemptAt, maxAttempts],
    );

    return toOperationRun(result.rows[0]);
  }

  async function markStrandedRunFailed({ errorMessage, runId, summary = {}, queryable }) {
    const result = await queryable.query(
      `
        UPDATE operation_runs
        SET status = CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' ELSE 'failed' END,
            finished_at = NOW(),
            summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb ||
              CASE WHEN cancel_requested_at IS NOT NULL THEN jsonb_build_object(
                'currentStep', 'Cancellation completed after stranded run recovery',
                'retryScheduledAt', NULL
              ) ELSE '{}'::jsonb END,
            cancelled_at = CASE WHEN cancel_requested_at IS NOT NULL THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
            claimed_at = NULL,
            claimed_by_instance_id = NULL,
            error_message = CASE WHEN cancel_requested_at IS NOT NULL THEN NULL ELSE $3 END
        WHERE id = $1
          AND status = 'running'
          AND ${writableExecutionRunSql('operation_runs')}
        RETURNING
          id,
          operation_type,
          status,
          started_at,
          finished_at,
          triggered_by_user_id,
          summary,
          error_message,
          cancel_requested_at,
          cancel_requested_by_user_id,
          cancelled_at,
          next_attempt_at,
          attempt_count,
          max_attempts,
          claimed_at,
          claimed_by_instance_id
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary)), errorMessage],
    );

    return toOperationRun(result.rows[0]);
  }

  async function recoverStrandedRun({ observedRun, expectedLease, recoverySummary, errorMessage, buildRetrySchedule }) {
    const key = `${observedRun.operationType}:${observedRun.id}`;
    const expected = expectedLease === null ? null : normalizeExpectedJobLease(expectedLease, { leaseKey: key });
    if (expectedLease !== null && !expected) return null;
    return createDatabaseTransactionRunner({ getPoolFn })(async (queryable) => {
      const parent = await queryable.query(`SELECT * FROM operation_runs WHERE id=$1::uuid AND status='running'
        AND ${writableExecutionRunSql('operation_runs')} FOR UPDATE`, [observedRun.id]);
      const row = parent.rows[0];
      if (!row || row.operation_type !== observedRun.operationType || row.attempt_count !== observedRun.attemptCount
        || row.max_attempts !== observedRun.maxAttempts || toIsoString(row.claimed_at) !== observedRun.claimedAt
        || (row.claimed_by_instance_id ?? null) !== observedRun.claimedByInstanceId) return null;
      const leaseRow = await lockJobLeaseKey({ leaseKey: key, queryable });
      const current = normalizeJobLease(leaseRow);
      const observedAt = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
      const time = observedAt instanceof Date ? observedAt.getTime() : Date.parse(observedAt);
      if (!Number.isFinite(time)) return null;
      if (expected === null) {
        if (current !== null) return null;
      } else {
        const actual = normalizeExpectedJobLease(current, { leaseKey: key });
        if (!actual || actual.acquisitionId !== expected.acquisitionId || actual.ownerInstanceId !== expected.ownerInstanceId
          || !Number.isFinite(Date.parse(current.expiresAt))
          || (current.releasedAt == null && !isCurrentJobLeaseAcquisition(current, expected, { leaseKey: key, now: time, allowExpired: true }))
          || (current.releasedAt == null && Date.parse(current.expiresAt) > Number(time))) return null;
        if (current.releasedAt == null && !await createJobLeaseStore({ getPoolFn }).releaseLease({
          leaseKey: key, expectedLease: expected, status: 'expired', queryable })) return null;
      }
      const schedule = buildRetrySchedule({ attemptCount: row.attempt_count, maxAttempts: row.max_attempts });
      return schedule ? recoverRunForRetry({ runId: row.id, maxAttempts: row.max_attempts, nextAttemptAt: schedule.nextAttemptAt,
        summary: { ...recoverySummary, currentStep: 'Automatic retry scheduled after stranded run recovery',
          lastFailureMessage: errorMessage, retryScheduledAt: schedule.nextAttemptAt }, queryable })
        : markStrandedRunFailed({ runId: row.id, errorMessage,
          summary: { ...recoverySummary, currentStep: 'Stranded run recovery marked the run as failed' }, queryable });
    });
  }

  return {
    recoverStrandedRun,
    claimNextRunnableRun,
    listRecoverableRuns,

    scheduleRetry,
  };
}

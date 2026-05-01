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

function normalizeRunSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }

  return summary;
}

function normalizeOperationRun(row) {
  if (!row) {
    return null;
  }

  return {
    errorMessage: row.error_message ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    id: row.id,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    summary: normalizeRunSummary(row.summary),
  };
}

export function createOperationRunStore({
  getPoolFn = getPool,
  leaseJobType = null,
  operationType,
} = {}) {
  if (!operationType) {
    throw new Error('operationType is required');
  }

  const resolvedLeaseJobType = leaseJobType ?? operationType;

  async function createOperationRun({ status = 'pending', summary = {}, triggeredByUserId = null }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO operation_runs (
          operation_type,
          status,
          started_at,
          triggered_by_user_id,
          summary
        )
        VALUES ($1, $2, NOW(), $3, $4::jsonb)
        RETURNING id, status, started_at, finished_at, summary, error_message
      `,
      [operationType, status, triggeredByUserId, JSON.stringify(normalizeRunSummary(summary))],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function getActiveRun() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, status, started_at, finished_at, summary, error_message
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
        SELECT id, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationType],
    );

    return normalizeOperationRun(result.rows[0]);
  }

  async function markRunStarted({ runId, summary = {} }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'running',
            summary = COALESCE(summary, '{}'::jsonb) || $2::jsonb,
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
            error_message = NULL
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary))],
    );
  }

  async function markRunFailed({ runId, summary = {}, errorMessage }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE operation_runs
        SET status = 'failed',
            finished_at = NOW(),
            summary = $2::jsonb,
            error_message = $3
        WHERE id = $1
      `,
      [runId, JSON.stringify(normalizeRunSummary(summary)), errorMessage],
    );
  }

  async function acquireLease({ runId }) {
    const pool = getPoolFn();
    await pool.query(
      `
        INSERT INTO job_leases (
          job_type,
          lease_key,
          owner_instance_id,
          acquired_at,
          heartbeat_at,
          expires_at,
          status
        )
        VALUES ($1, $2, $3, NOW(), NOW(), NOW() + INTERVAL '30 minutes', 'active')
      `,
      [
        resolvedLeaseJobType,
        `${resolvedLeaseJobType}:${runId}`,
        process.env.HARMONIARR_INSTANCE_ID ?? `pid:${process.pid}`,
      ],
    );
  }

  async function releaseLease({ runId, status }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE job_leases
        SET released_at = NOW(),
            heartbeat_at = NOW(),
            status = $2
        WHERE lease_key = $1
          AND released_at IS NULL
      `,
      [`${resolvedLeaseJobType}:${runId}`, status],
    );
  }

  return {
    acquireLease,
    createOperationRun,
    getActiveRun,
    getLatestRun,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    releaseLease,
  };
}
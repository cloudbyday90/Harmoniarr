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

import { createApiError } from './auth.js';
import { createAuditReadService } from './audit-read-service.js';
import { getPool } from './database.js';
import { buildJobLeaseKey, createJobLeaseStore } from './job-lease-store.js';
import {
  decodeTimelineCursor,
  normalizeTimelinePageLimit,
  resolveTimelineCursorOccurredAt,
} from './timeline-pagination.js';

function normalizeLimit(limit, { defaultLimit = 20, maximum = 25 } = {}) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maximum);
}

function normalizeRunSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }

  return summary;
}

function toOperationRun(row) {
  if (!row) {
    return null;
  }

  return {
    attemptCount: Number.isFinite(row.attempt_count) ? row.attempt_count : null,
    cancelRequestedAt: row.cancel_requested_at?.toISOString?.() ?? row.cancel_requested_at ?? null,
    cancelRequestedByUserId: row.cancel_requested_by_user_id ?? null,
    cancelledAt: row.cancelled_at?.toISOString?.() ?? row.cancelled_at ?? null,
    claimedAt: row.claimed_at?.toISOString?.() ?? row.claimed_at ?? null,
    claimedByInstanceId: row.claimed_by_instance_id ?? null,
    errorMessage: row.error_message ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    id: row.id,
    maxAttempts: Number.isFinite(row.max_attempts) ? row.max_attempts : null,
    nextAttemptAt: row.next_attempt_at?.toISOString?.() ?? row.next_attempt_at ?? null,
    operationType: row.operation_type,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    summary: normalizeRunSummary(row.summary),
    triggeredByUserId: row.triggered_by_user_id ?? null,
  };
}

export function createOperationHistoryService({
  auditReadService = createAuditReadService(),
  getPoolFn = getPool,
  jobLeaseStore = createJobLeaseStore(),
  nowFn = () => new Date(),
} = {}) {
  function buildOperationRunLeaseKey(run) {
    if (!run?.id || !run?.operationType) {
      return null;
    }

    return buildJobLeaseKey({
      jobType: run.operationType,
      runId: run.id,
    });
  }

  async function attachLeasesToRuns(runs) {
    if (!Array.isArray(runs) || runs.length === 0) {
      return [];
    }

    const leaseKeys = runs
      .map(buildOperationRunLeaseKey)
      .filter(Boolean);
    const leaseMap = new Map(
      (await jobLeaseStore.listLeases({ leaseKeys }))
        .map((lease) => [lease.leaseKey, lease]),
    );

    return runs.map((run) => ({
      ...run,
      lease: leaseMap.get(buildOperationRunLeaseKey(run)) ?? null,
    }));
  }

  async function listRecentOperationRuns({ limit } = {}) {
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
        ORDER BY started_at DESC, created_at DESC
        LIMIT $1
      `,
      [normalizeLimit(limit)],
    );

    return attachLeasesToRuns(result.rows.map(toOperationRun));
  }

  async function listRecentActivityRuns({ before = null, limit } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 10, maxLimit: 25 });
    const beforeCursor = decodeTimelineCursor(before);
    const values = [];
    const whereClauses = [];

    if (beforeCursor) {
      values.push(resolveTimelineCursorOccurredAt(beforeCursor));
      whereClauses.push(`COALESCE(finished_at, cancelled_at, started_at) < $${values.length}::timestamptz`);
    }

    values.push(normalizedLimit);

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
          claimed_by_instance_id,
          COALESCE(finished_at, cancelled_at, started_at) AS activity_occurred_at
        FROM operation_runs
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY activity_occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map(toOperationRun);
  }

  async function getOperationRunById(runId) {
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
        WHERE id = $1
        LIMIT 1
      `,
      [runId],
    );

    const run = toOperationRun(result.rows[0]);

    if (!run) {
      return null;
    }

    return (await attachLeasesToRuns([run]))[0] ?? null;
  }

  async function buildOperationHistory({ limit } = {}) {
    return {
      checkedAt: nowFn().toISOString(),
      runs: await listRecentOperationRuns({ limit }),
    };
  }

  async function buildOperationRunDetail({ runId, auditLimit } = {}) {
    const run = await getOperationRunById(runId);

    if (!run) {
      throw createApiError(404, 'operation_run_not_found', 'Operation run not found');
    }

    return {
      auditEvents: await auditReadService.listAuditEventsForEntity({
        entityId: runId,
        entityType: 'operation_run',
        limit: normalizeLimit(auditLimit, { defaultLimit: 20, maximum: 25 }),
      }),
      checkedAt: nowFn().toISOString(),
      run,
    };
  }

  return {
    buildOperationHistory,
    buildOperationRunDetail,
    getOperationRunById,
    listRecentActivityRuns,
    listRecentOperationRuns,
  };
}
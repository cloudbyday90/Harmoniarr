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
import { getPool } from './database.js';
import { createOperationQueueStore } from './operation-queue-store.js';
import {
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
} from '../shared/operation-run-descriptors.js';

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toOperationRun(row) {
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
    operationType: row.operation_type,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    summary: row.summary ?? {},
    triggeredByUserId: row.triggered_by_user_id ?? null,
  };
}

export function createOperationRunControlService({
  getPoolFn = getPool,
  operationQueueStore = createOperationQueueStore({ getPoolFn }),
} = {}) {
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

    return toOperationRun(result.rows[0]);
  }

  async function requestOperationRunCancellation({ requestedByUserId, runId }) {
    const existingRun = await getOperationRunById(runId);

    if (!existingRun) {
      throw createApiError(404, 'operation_run_not_found', 'Operation run not found');
    }

    if (!canRequestOperationRunCancellation(existingRun)) {
      throw createApiError(409, 'operation_run_not_cancellable', 'Operation run is not cancellable');
    }

    const result = await getPoolFn().query(
      `
        UPDATE operation_runs
        SET cancel_requested_at = COALESCE(cancel_requested_at, NOW()),
            cancel_requested_by_user_id = COALESCE(cancel_requested_by_user_id, $2)
        WHERE id = $1
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
      [runId, requestedByUserId],
    );

    return toOperationRun(result.rows[0]);
  }

  async function requestOperationRunRetry({ runId }) {
    const existingRun = await getOperationRunById(runId);

    if (!existingRun) {
      throw createApiError(404, 'operation_run_not_found', 'Operation run not found');
    }

    if (!canRequestOperationRunRetry(existingRun)) {
      throw createApiError(409, 'operation_run_not_retryable', 'Operation run is not retryable');
    }

    return operationQueueStore.scheduleRetry({
      maxAttempts: Math.max(existingRun.maxAttempts ?? 1, (existingRun.attemptCount ?? 0) + 1),
      runId,
    });
  }

  return {
    getOperationRunById,
    requestOperationRunCancellation,
    requestOperationRunRetry,
  };
}
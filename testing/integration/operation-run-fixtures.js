/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';

function normalizeSummary(summary) {
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
    summary: normalizeSummary(row.summary),
    triggeredByUserId: row.triggered_by_user_id ?? null,
  };
}

export async function seedOperationRunFixture({
  queryable,
  runOverrides = {},
} = {}) {
  if (!queryable?.query) {
    throw new Error('queryable with query(sql, values) is required');
  }

  const result = await queryable.query(
    `
      INSERT INTO operation_runs (
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
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::timestamptz, NOW()),
        $4::timestamptz,
        $5,
        $6::jsonb,
        $7,
        $8::timestamptz,
        $9,
        $10::timestamptz,
        COALESCE($11::timestamptz, NOW()),
        $12,
        $13,
        $14::timestamptz,
        $15
      )
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
    [
      runOverrides.operationType ?? operationRunRegistry.libraryScan.operationType,
      runOverrides.status ?? 'pending',
      runOverrides.startedAt ?? null,
      runOverrides.finishedAt ?? null,
      runOverrides.triggeredByUserId ?? null,
      JSON.stringify(normalizeSummary(runOverrides.summary)),
      runOverrides.errorMessage ?? null,
      runOverrides.cancelRequestedAt ?? null,
      runOverrides.cancelRequestedByUserId ?? null,
      runOverrides.cancelledAt ?? null,
      runOverrides.nextAttemptAt ?? null,
      runOverrides.attemptCount ?? 0,
      runOverrides.maxAttempts ?? 1,
      runOverrides.claimedAt ?? null,
      runOverrides.claimedByInstanceId ?? null,
    ],
  );

  return toOperationRun(result.rows[0]);
}

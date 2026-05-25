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

import { getPool } from '../database.js';
import { createOperationRunStore } from '../operation-run-store.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeRunSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }

  return summary;
}

function normalizeRun(row) {
  if (!row) {
    return null;
  }

  const summary = normalizeRunSummary(row.summary);

  return {
    appUserId: summary.appUserId ?? null,
    artistName: summary.artistName ?? null,
    errorMessage: row.error_message ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    id: row.id,
    metadataArtistId: summary.metadataArtistId ?? null,
    snapshotId: summary.snapshotId ?? null,
    snapshotRevision: toNumberOrNull(summary.snapshotRevision),
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    triggerSource: summary.triggerSource ?? 'save',
  };
}

function buildRunSummary({
  appUserId,
  artistName,
  metadataArtistId,
  snapshotId,
  snapshotRevision,
  triggerSource = 'save',
}) {
  return {
    appUserId,
    artistName,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    triggerSource,
  };
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

export function createOperatorArtistReconciliationRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorArtistReconciliation;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function selectRunForStatus({
    appUserId,
    client,
    metadataArtistId,
    status,
  }) {
    const result = await client.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND status = $2
          AND summary->>'appUserId' = $3
          AND summary->>'metadataArtistId' = $4
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [operationDescriptor.operationType, status, appUserId, metadataArtistId],
    );

    return result.rows[0] ?? null;
  }

  async function insertPendingRun({
    appUserId,
    artistName,
    client,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    triggerSource = 'save',
    triggeredByUserId = null,
  }) {
    const result = await client.query(
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
        VALUES ($1, 'pending', NOW(), $2, $3::jsonb, NOW(), 1)
        RETURNING id, operation_type, status, started_at, finished_at, summary, error_message
      `,
      [
        operationDescriptor.operationType,
        triggeredByUserId,
        JSON.stringify(buildRunSummary({
          appUserId,
          artistName,
          metadataArtistId,
          snapshotId,
          snapshotRevision,
          triggerSource,
        })),
      ],
    );

    return result.rows[0] ?? null;
  }

  async function replacePendingRunSummary({
    appUserId,
    artistName,
    client,
    metadataArtistId,
    pendingRunId,
    snapshotId,
    snapshotRevision,
    triggerSource = 'save',
    triggeredByUserId = null,
  }) {
    const result = await client.query(
      `
        UPDATE operation_runs
        SET status = 'pending',
            started_at = NOW(),
            finished_at = NULL,
            triggered_by_user_id = $2,
            summary = $3::jsonb,
            error_message = NULL,
            cancel_requested_at = NULL,
            cancel_requested_by_user_id = NULL,
            cancelled_at = NULL,
            next_attempt_at = NOW(),
            attempt_count = 0,
            claimed_at = NULL,
            claimed_by_instance_id = NULL
        WHERE id = $1
        RETURNING id, operation_type, status, started_at, finished_at, summary, error_message
      `,
      [
        pendingRunId,
        triggeredByUserId,
        JSON.stringify(buildRunSummary({
          appUserId,
          artistName,
          metadataArtistId,
          snapshotId,
          snapshotRevision,
          triggerSource,
        })),
      ],
    );

    return result.rows[0] ?? null;
  }

  async function createOperationRun({
    appUserId,
    artistName,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    status = 'pending',
    triggerSource = 'save',
    triggeredByUserId = null,
  }) {
    const run = await operationRunStore.createOperationRun({
      maxAttempts: 1,
      status,
      summary: buildRunSummary({
        appUserId,
        artistName,
        metadataArtistId,
        snapshotId,
        snapshotRevision,
        triggerSource,
      }),
      triggeredByUserId,
    });

    return normalizeRun(run);
  }

  async function getActiveRunByOperatorArtist({ appUserId, metadataArtistId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND status IN ('pending', 'running')
          AND summary->>'appUserId' = $2
          AND summary->>'metadataArtistId' = $3
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, appUserId, metadataArtistId],
    );

    return normalizeRun(result.rows[0]);
  }

  async function getLatestRunByOperatorArtist({ appUserId, metadataArtistId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND summary->>'appUserId' = $2
          AND summary->>'metadataArtistId' = $3
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, appUserId, metadataArtistId],
    );

    return normalizeRun(result.rows[0]);
  }

  async function getPendingRunByOperatorArtist({ appUserId, metadataArtistId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND status = 'pending'
          AND summary->>'appUserId' = $2
          AND summary->>'metadataArtistId' = $3
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, appUserId, metadataArtistId],
    );

    return normalizeRun(result.rows[0]);
  }

  async function getRunningRunByOperatorArtist({ appUserId, metadataArtistId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, operation_type, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND status = 'running'
          AND summary->>'appUserId' = $2
          AND summary->>'metadataArtistId' = $3
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, appUserId, metadataArtistId],
    );

    return normalizeRun(result.rows[0]);
  }

  async function queueLatestSnapshotRun({
    appUserId,
    artistName,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    triggerSource = 'save',
    triggeredByUserId = null,
  }) {
    const pool = getPoolFn();

    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const runningRow = await selectRunForStatus({
          appUserId,
          client,
          metadataArtistId,
          status: 'running',
        });
        const pendingRow = await selectRunForStatus({
          appUserId,
          client,
          metadataArtistId,
          status: 'pending',
        });

        if (pendingRow) {
          const updatedPendingRow = await replacePendingRunSummary({
            appUserId,
            artistName,
            client,
            metadataArtistId,
            pendingRunId: pendingRow.id,
            snapshotId,
            snapshotRevision,
            triggerSource,
            triggeredByUserId,
          });

          await client.query('COMMIT');

          return {
            action: runningRow ? 'replaced_pending_follow_up' : 'replaced_pending',
            run: normalizeRun(updatedPendingRow),
            runningRun: normalizeRun(runningRow),
          };
        }

        const insertedPendingRow = await insertPendingRun({
          appUserId,
          artistName,
          client,
          metadataArtistId,
          snapshotId,
          snapshotRevision,
          triggerSource,
          triggeredByUserId,
        });

        await client.query('COMMIT');

        return {
          action: runningRow ? 'queued_follow_up' : 'created',
          run: normalizeRun(insertedPendingRow),
          runningRun: normalizeRun(runningRow),
        };
      } catch (error) {
        await client.query('ROLLBACK');

        if (isUniqueViolation(error) && attemptIndex === 0) {
          continue;
        }

        throw error;
      } finally {
        client.release();
      }
    }

    throw new Error('queueLatestSnapshotRun exhausted retry attempts');
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRunByOperatorArtist,
    getPendingRunByOperatorArtist,
    getLatestRunByOperatorArtist,
    getRunningRunByOperatorArtist,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunPaused: operationRunStore.markRunPaused,
    markRunStarted: operationRunStore.markRunStarted,
    queueLatestSnapshotRun,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}

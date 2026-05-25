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

export function createOperatorArtistReconciliationRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorArtistReconciliation;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

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
      summary: {
        appUserId,
        artistName,
        metadataArtistId,
        snapshotId,
        snapshotRevision,
        triggerSource,
      },
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

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRunByOperatorArtist,
    getLatestRunByOperatorArtist,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunPaused: operationRunStore.markRunPaused,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}

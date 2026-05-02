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
    artistName: summary.artistName ?? null,
    errorMessage: row.error_message ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    id: row.id,
    metadataArtistId: summary.metadataArtistId ?? null,
    musicBrainzArtistId: summary.musicBrainzArtistId ?? null,
    refreshedAt: summary.refreshedAt ?? null,
    releaseGroupCount: toNumberOrNull(summary.releaseGroupCount),
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    status: row.status,
    triggerSource: summary.triggerSource ?? 'manual',
    wantedReconciliationCompleted: Boolean(summary.wantedReconciliationCompleted),
  };
}

export function createMetadataArtistRefreshRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.metadataArtistRefresh;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({
    artistName,
    metadataArtistId,
    musicBrainzArtistId,
    status = 'pending',
    triggerSource = 'manual',
    triggeredByUserId = null,
  }) {
    const run = await operationRunStore.createOperationRun({
      maxAttempts: 3,
      status,
      summary: {
        artistName,
        metadataArtistId,
        musicBrainzArtistId,
        triggerSource,
      },
      triggeredByUserId,
    });

    return normalizeRun(run);
  }

  async function getActiveRunByMetadataArtistId(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, status, started_at, finished_at, summary, error_message
        FROM operation_runs
        WHERE operation_type = $1
          AND status IN ('pending', 'running')
          AND summary->>'metadataArtistId' = $2
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, metadataArtistId],
    );

    return normalizeRun(result.rows[0]);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRunByMetadataArtistId,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}
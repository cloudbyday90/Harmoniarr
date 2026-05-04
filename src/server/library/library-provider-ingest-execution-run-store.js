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

function normalizeRun(row) {
  if (!row) {
    return null;
  }

  const summary = row.summary ?? {};
  return {
    canonicalUrl: summary.canonicalUrl ?? null,
    id: row.id,
    mediaRequestId: summary.mediaRequestId ?? null,
    resourceType: summary.resourceType ?? null,
    sourceIdentifier: summary.sourceIdentifier ?? null,
    sourceProvider: summary.sourceProvider ?? null,
    status: row.status,
    triggerSource: summary.triggerSource ?? 'planning_complete',
  };
}

export function createLibraryProviderIngestExecutionRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryExternalIntakeExecution;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({
    canonicalUrl,
    mediaRequestId,
    resourceType,
    sourceIdentifier,
    sourceProvider,
    status = 'pending',
    triggerSource = 'planning_complete',
    triggeredByUserId = null,
  }) {
    const run = await operationRunStore.createOperationRun({
      maxAttempts: 3,
      status,
      summary: {
        canonicalUrl,
        mediaRequestId,
        resourceType,
        sourceIdentifier,
        sourceProvider,
        triggerSource,
      },
      triggeredByUserId,
    });

    return normalizeRun(run);
  }

  async function getActiveRunByMediaRequestId(mediaRequestId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, status, summary
        FROM operation_runs
        WHERE operation_type = $1
          AND status IN ('pending', 'running')
          AND summary->>'mediaRequestId' = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [operationDescriptor.operationType, mediaRequestId],
    );

    return normalizeRun(result.rows[0] ?? null);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRunByMediaRequestId,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunPaused: operationRunStore.markRunPaused,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}

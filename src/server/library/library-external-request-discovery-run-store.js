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

function normalizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    intentId: run.summary?.intentId ?? null,
    mediaRequestId: run.summary?.mediaRequestId ?? null,
    status: run.status,
    triggerSource: run.summary?.triggerSource ?? 'operator_review',
  };
}

export function createLibraryExternalRequestDiscoveryRunStore({ getPoolFn = getPool } = {}) {
  const descriptor = operationRunRegistry.libraryExternalRequestDiscovery;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: descriptor.leaseJobType,
    operationType: descriptor.operationType,
  });

  async function createOperationRun({
    intentId,
    mediaRequestId,
    queryable = null,
    triggerSource = 'operator_review',
    triggeredByUserId = null,
  }) {
    return normalizeRun(await operationRunStore.createOperationRun({
      maxAttempts: 1,
      queryable,
      status: 'pending',
      summary: { intentId, mediaRequestId, triggerSource },
      triggeredByUserId,
    }));
  }

  async function getActiveRunByIntentId(intentId, queryable = null) {
    const result = await (queryable ?? getPoolFn()).query(`
      SELECT id, status, summary
      FROM operation_runs
      WHERE operation_type = $1
        AND status IN ('pending', 'running')
        AND summary->>'intentId' = $2
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [descriptor.operationType, intentId]);
    return normalizeRun(result.rows[0]);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRunByIntentId,
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

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

import { createOperationRunStore } from '../operation-run-store.js';
import { getPool } from '../database.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeRun(run) {
  if (!run) {
    return null;
  }

  return {
    attemptedCount: toNumberOrNull(run.summary.attemptedCount),
    candidateCount: toNumberOrNull(run.summary.candidateCount),
    dispatchedCount: toNumberOrNull(run.summary.dispatchedCount),
    errorMessage: run.errorMessage,
    failedCount: toNumberOrNull(run.summary.failedCount),
    fileCount: toNumberOrNull(run.summary.fileCount),
    finishedAt: run.finishedAt,
    id: run.id,
    nextAttemptAt: run.nextAttemptAt ?? null,
    startedAt: run.startedAt,
    status: run.status,
    triggerSource: run.summary.triggerSource ?? null,
  };
}

export function createLibraryDiscoveryRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryDiscoveryDispatch;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({
    nextAttemptAt = null,
    status = 'pending',
    summary = {},
    triggerSource = 'manual',
    triggeredByUserId = null,
  }) {
    const run = await operationRunStore.createOperationRun({
      nextAttemptAt,
      status,
      summary: {
        ...summary,
        triggerSource,
      },
      triggeredByUserId,
    });

    return normalizeRun(run);
  }

  async function getActiveRun() {
    return normalizeRun(await operationRunStore.getActiveRun());
  }

  async function getLatestRun() {
    return normalizeRun(await operationRunStore.getLatestRun());
  }

  async function getRunById(runId) {
    return normalizeRun(await operationRunStore.getRunById(runId));
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRun,
    getRunById,
    getLatestRun,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    markRunPaused: operationRunStore.markRunPaused,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    pruneOldRuns: operationRunStore.pruneOldRuns,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}

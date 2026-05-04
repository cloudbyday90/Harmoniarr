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
    blockedCandidateCount: toNumberOrNull(run.summary.blockedCandidateCount),
    currentStep: run.summary.currentStep ?? null,
    errorMessage: run.errorMessage,
    id: run.id,
    inspectedCandidateCount: toNumberOrNull(run.summary.inspectedCandidateCount),
    inspectedFileCount: toNumberOrNull(run.summary.inspectedFileCount),
    inspectionUnavailableCount: toNumberOrNull(run.summary.inspectionUnavailableCount),
    requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
    startedAt: run.startedAt,
    status: run.status,
    warningCount: toNumberOrNull(run.summary.warningCount),
    finishedAt: run.finishedAt,
  };
}

export function createImportCandidateMediaInspectionRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateMediaInspection;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({ requestedCandidateCount, status = 'pending', triggeredByUserId = null }) {
    const run = await operationRunStore.createOperationRun({
      status,
      summary: {
        currentStep: 'queued',
        requestedCandidateCount,
      },
      triggeredByUserId,
    });

    return normalizeRun(run);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRun: async () => normalizeRun(await operationRunStore.getActiveRun()),
    getRunById: async (runId) => normalizeRun(await operationRunStore.getRunById(runId)),
    getLatestRun: async () => normalizeRun(await operationRunStore.getLatestRun()),
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

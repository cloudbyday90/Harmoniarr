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
    blockedCount: toNumberOrNull(run.summary.blockedCount),
    currentStep: run.summary.currentStep ?? null,
    errorMessage: run.errorMessage,
    executionMode: run.summary.executionMode ?? 'planning_only',
    finishedAt: run.finishedAt,
    id: run.id,
    processedCandidateCount: toNumberOrNull(run.summary.processedCandidateCount),
    queueFailedCount: toNumberOrNull(run.summary.queueFailedCount),
    queuedCount: toNumberOrNull(run.summary.queuedCount),
    queuedWithWarningsCount: toNumberOrNull(run.summary.queuedWithWarningsCount),
    readyCount: toNumberOrNull(run.summary.readyCount),
    readyWithWarningsCount: toNumberOrNull(run.summary.readyWithWarningsCount),
    requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
    startedAt: run.startedAt,
    status: run.status,
    totalSelected: toNumberOrNull(run.summary.totalSelected),
  };
}

export function createImportCandidateExecutionRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateExecutionPlanning;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({
    executionMode = 'download_enqueue',
    requestedCandidateCount,
    status = 'pending',
    summary = null,
    triggeredByUserId = null,
  }) {
    const run = await operationRunStore.createOperationRun({
      status,
      summary: summary ?? {
        currentStep: 'queued',
        executionMode,
        requestedCandidateCount,
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

  async function listRecentRuns({ limit } = {}) {
    return (await operationRunStore.listRecentRuns({ limit })).map(normalizeRun);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRun,
    getRunById,
    getLatestRun,
    listRecentRuns,
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

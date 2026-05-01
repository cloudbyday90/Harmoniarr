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

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeRun(run) {
  if (!run) {
    return null;
  }

  return {
    appliedCount: toNumberOrNull(run.summary.appliedCount),
    appliedWithWarningsCount: toNumberOrNull(run.summary.appliedWithWarningsCount),
    applyFailedCount: toNumberOrNull(run.summary.applyFailedCount),
    blockedCount: toNumberOrNull(run.summary.blockedCount),
    currentStep: run.summary.currentStep ?? null,
    errorMessage: run.errorMessage,
    executionMode: run.summary.executionMode ?? 'move',
    finishedAt: run.finishedAt,
    id: run.id,
    processedCandidateCount: toNumberOrNull(run.summary.processedCandidateCount),
    readyCount: toNumberOrNull(run.summary.readyCount),
    readyWithWarningsCount: toNumberOrNull(run.summary.readyWithWarningsCount),
    requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
    startedAt: run.startedAt,
    status: run.status,
    totalImportPending: toNumberOrNull(run.summary.totalImportPending),
  };
}

export function createImportCandidateApplyRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: 'import_candidate_apply',
    operationType: 'import_candidate_apply',
  });

  async function createOperationRun({ executionMode = 'move', requestedCandidateCount, status = 'pending', triggeredByUserId = null }) {
    const run = await operationRunStore.createOperationRun({
      status,
      summary: {
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

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRun,
    getLatestRun,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
  };
}
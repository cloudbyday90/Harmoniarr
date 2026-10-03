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
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockImportCandidateApplyCreation } from './import-candidate-apply-queue-store.js';

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
    applySafetyMode: run.summary.applySafetyMode ?? 'manual',
    ...(Array.isArray(run.summary.importCandidateIds) ? { importCandidateIds: run.summary.importCandidateIds } : {}),
    awaitingConfirmationCount: toNumberOrNull(run.summary.awaitingConfirmationCount),
    blockedCount: toNumberOrNull(run.summary.blockedCount),
    currentStep: run.summary.currentStep ?? null,
    errorMessage: run.errorMessage,
    executableCandidateCount: toNumberOrNull(run.summary.executableCandidateCount),
    executionMode: run.summary.executionMode ?? 'move',
    finishedAt: run.finishedAt,
    id: run.id,
    processedCandidateCount: toNumberOrNull(run.summary.processedCandidateCount),
    qualityBlockedCount: toNumberOrNull(run.summary.qualityBlockedCount),
    qualityRecoveryExhaustedCount: toNumberOrNull(run.summary.qualityRecoveryExhaustedCount),
    qualityRecoveryRediscoveryCount: toNumberOrNull(run.summary.qualityRecoveryRediscoveryCount),
    qualityRecoveryStartedCount: toNumberOrNull(run.summary.qualityRecoveryStartedCount),
    readyCount: toNumberOrNull(run.summary.readyCount),
    readyWithWarningsCount: toNumberOrNull(run.summary.readyWithWarningsCount),
    requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
    scopedCandidateCount: toNumberOrNull(run.summary.scopedCandidateCount),
    startedAt: run.startedAt,
    status: run.status,
    totalImportPending: toNumberOrNull(run.summary.totalImportPending),
    triggerSource: run.summary.triggerSource ?? 'manual',
  };
}

export function createImportCandidateApplyRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateApply;
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({
    queryable = null,
    applySafetyMode = 'manual',
    executableCandidateCount = null,
    executionMode = 'move',
    importCandidateIds = null,
    requestedCandidateCount,
    status = 'pending',
    triggeredByUserId = null,
    triggerSource = 'manual',
  }) {
    const createRun = async (client) => {
      await lockImportCandidateApplyCreation({ queryable: client });
      const run = await operationRunStore.createOperationRun({
        queryable: client,
        status,
        summary: {
          applySafetyMode,
          currentStep: 'queued',
          executableCandidateCount,
          executionMode,
          ...(Array.isArray(importCandidateIds) ? { importCandidateIds } : {}),
          requestedCandidateCount,
          ...(Array.isArray(importCandidateIds) ? { scopedCandidateCount: importCandidateIds.length } : {}),
          triggerSource,
        },
        triggeredByUserId,
      });

      return normalizeRun(run);
    };
    return queryable ? createRun(queryable) : withTransaction(createRun);
  }

  async function getActiveRun({ queryable = null } = {}) {
    return normalizeRun(await operationRunStore.getActiveRun({ queryable }));
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

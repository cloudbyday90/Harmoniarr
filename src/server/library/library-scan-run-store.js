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
    id: row.id,
    status: row.status,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? null,
    finishedAt: row.finished_at?.toISOString?.() ?? row.finished_at ?? null,
    filesSeen: toNumberOrNull(summary.filesSeen),
    filesMatched: toNumberOrNull(summary.filesMatched),
    filesUnmatched: toNumberOrNull(summary.filesUnmatched),
    libraryRoot: summary.libraryRoot ?? null,
    errorMessage: row.error_message ?? null,
  };
}

export function createLibraryScanRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryScan;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({ libraryRoot, status = 'pending', triggeredByUserId = null }) {
    const run = await operationRunStore.createOperationRun({
      status,
      summary: { libraryRoot },
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
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunPaused: operationRunStore.markRunPaused,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}
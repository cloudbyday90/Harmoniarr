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

import { getPool } from './database.js';
import { createOperationRunStore } from './operation-run-store.js';
import { operationRunRegistry } from '../shared/operation-run-descriptors.js';

function normalizeRun(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    errorMessage: row.errorMessage ?? null,
    summary: row.summary ?? {},
  };
}

export function createOperatorNotificationFanoutRunStore({
  getPoolFn = getPool,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorNotificationFanout;
  const operationRunStore = createOperationRunStore({
    getPoolFn,
    leaseJobType: operationDescriptor.leaseJobType,
    operationType: operationDescriptor.operationType,
  });

  async function createOperationRun({ status = 'pending', summary = {}, triggeredByUserId = null } = {}) {
    const run = await operationRunStore.createOperationRun({
      status,
      summary,
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

  async function listRecentRuns({ limit } = {}) {
    return (await operationRunStore.listRecentRuns({ limit })).map(normalizeRun);
  }

  return {
    acquireLease: operationRunStore.acquireLease,
    createOperationRun,
    getActiveRun,
    getLatestRun,
    isCancellationRequested: operationRunStore.isCancellationRequested,
    listRecentRuns,
    markRunCancelled: operationRunStore.markRunCancelled,
    markRunPaused: operationRunStore.markRunPaused,
    markRunCompleted: operationRunStore.markRunCompleted,
    markRunFailed: operationRunStore.markRunFailed,
    markRunStarted: operationRunStore.markRunStarted,
    releaseLease: operationRunStore.releaseLease,
    renewLease: operationRunStore.renewLease,
  };
}

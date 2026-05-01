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

import { createImportCandidateRunItemRepository } from './import-candidate-run-item-repository.js';

const importExecutionRunItemRepository = createImportCandidateRunItemRepository({
  snapshotColumn: 'planning_snapshot',
  tableName: 'import_execution_run_items',
});

export async function listImportExecutionRunItems(operationRunId, queryable) {
  const items = await importExecutionRunItemRepository.listRunItems(operationRunId, queryable);
  return items.map((item) => ({
    ...item,
    planningSnapshot: item.snapshot,
  }));
}

export async function replaceImportExecutionRunItems(operationRunId, items, queryable) {
  const storedItems = await importExecutionRunItemRepository.replaceRunItems(operationRunId, items.map((item) => ({
    ...item,
    snapshot: item.planningSnapshot,
  })), queryable);
  return storedItems.map((item) => ({
    ...item,
    planningSnapshot: item.snapshot,
  }));
}

export async function updateImportExecutionRunItem({
  importCandidateId,
  itemStatus,
  operationRunId,
  planningSnapshot,
  statusMessage,
}, queryable) {
  const item = await importExecutionRunItemRepository.updateRunItem({
    importCandidateId,
    itemStatus,
    operationRunId,
    snapshot: planningSnapshot,
    statusMessage,
  }, queryable);

  return item ? {
    ...item,
    planningSnapshot: item.snapshot,
  } : null;
}
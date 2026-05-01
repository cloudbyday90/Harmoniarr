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

const importApplyRunItemRepository = createImportCandidateRunItemRepository({
  snapshotColumn: 'apply_snapshot',
  tableName: 'import_apply_run_items',
});

export async function listImportApplyRunItems(operationRunId, queryable) {
  const items = await importApplyRunItemRepository.listRunItems(operationRunId, queryable);
  return items.map((item) => ({
    ...item,
    applySnapshot: item.snapshot,
  }));
}

export async function replaceImportApplyRunItems(operationRunId, items, queryable) {
  const storedItems = await importApplyRunItemRepository.replaceRunItems(operationRunId, items.map((item) => ({
    ...item,
    snapshot: item.applySnapshot,
  })), queryable);
  return storedItems.map((item) => ({
    ...item,
    applySnapshot: item.snapshot,
  }));
}

export async function updateImportApplyRunItem({
  applySnapshot,
  importCandidateId,
  itemStatus,
  operationRunId,
  statusMessage,
}, queryable) {
  const item = await importApplyRunItemRepository.updateRunItem({
    importCandidateId,
    itemStatus,
    operationRunId,
    snapshot: applySnapshot,
    statusMessage,
  }, queryable);

  return item ? {
    ...item,
    applySnapshot: item.snapshot,
  } : null;
}
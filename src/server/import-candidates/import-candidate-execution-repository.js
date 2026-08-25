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
import { getPool } from '../database.js';

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

/**
 * Finds the latest selected candidate whose prior slskd enqueue POST reached
 * the durable handoff checkpoint but never reached a durable confirmation.
 * A new run must not send that POST again because the provider does not offer
 * an idempotency key contract.
 */
export async function findUnconfirmedImportExecutionHandoff(queryable) {
  const db = queryable ?? getPool();
  const result = await db.query(
    `
      SELECT
        items.import_candidate_id,
        items.operation_run_id,
        items.updated_at
      FROM import_execution_run_items AS items
      INNER JOIN import_candidates AS candidates
        ON candidates.id = items.import_candidate_id
      WHERE candidates.status = 'selected'
        AND items.item_status = 'awaiting_confirmation'
      ORDER BY items.updated_at DESC, items.id DESC
      LIMIT 1
    `,
  );

  const row = result.rows[0] ?? null;
  return row ? {
    importCandidateId: row.import_candidate_id,
    operationRunId: row.operation_run_id,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
  } : null;
}

export async function upsertImportExecutionRunItem({
  importCandidateId,
  itemStatus,
  operationRunId,
  planningSnapshot,
  position,
  statusMessage,
}, queryable) {
  const item = await importExecutionRunItemRepository.upsertRunItem({
    importCandidateId,
    itemStatus,
    operationRunId,
    position,
    snapshot: planningSnapshot,
    statusMessage,
  }, queryable);

  return {
    ...item,
    planningSnapshot: item.snapshot,
  };
}

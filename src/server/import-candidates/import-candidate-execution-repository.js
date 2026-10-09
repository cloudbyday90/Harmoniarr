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
import { writableExecutionRunSql } from './import-execution-origin-sql.js';

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
    expectedAttemptId: planningSnapshot?.execution?.handoff?.attempt?.attemptId ?? null,
    expectedAdoptionId: planningSnapshot?.execution?.handoff?.adoption?.adoptionId ?? null,
    expectedOriginResolutionId: planningSnapshot?.execution?.handoff?.originResolution?.resolutionId ?? null,
  }, queryable);

  return item ? {
    ...item,
    planningSnapshot: item.snapshot,
  } : null;
}

export async function recordImportExecutionAcceptedObservation({ importCandidateId, operationRunId, observation }, queryable) {
  await (queryable ?? getPool()).query(`UPDATE import_execution_run_items SET planning_snapshot=jsonb_set(planning_snapshot,
    '{execution,acceptedCandidateObservation}',$3::jsonb),updated_at=NOW() WHERE operation_run_id=$1::uuid AND import_candidate_id=$2::uuid
    AND EXISTS(SELECT 1 FROM operation_runs parent WHERE parent.id=operation_run_id AND ${writableExecutionRunSql('parent')})`,
  [operationRunId, importCandidateId, JSON.stringify(observation)]);
}

/**
 * Finds the latest selected candidate whose prior slskd enqueue POST reached
 * the durable handoff checkpoint but never reached a durable confirmation.
 * A new run must not resend an uncertain POST. The pinned legacy endpoint has
 * no caller ID; newer provider batch APIs require separate capability controls.
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
        AND ((items.item_status = 'awaiting_confirmation'
          AND items.planning_snapshot #>> '{execution,handoff,state}' IS DISTINCT FROM 'not_dispatched')
          OR items.planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation')
          OR items.planning_snapshot #> '{execution,handoff,adoption,originalUncertainty}'='true'::jsonb)
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
    preserveExisting: true,
  }, queryable);

  return item ? {
    ...item,
    planningSnapshot: item.snapshot,
  } : null;
}

/** Initializers preserve any checkpoint another worker already committed. */
export async function initializeImportExecutionRunItems(operationRunId, items, queryable) {
  const stored = [];
  for (const item of items) {
    const inserted = await upsertImportExecutionRunItem({ ...item, operationRunId }, queryable);
    if (inserted) stored.push(inserted);
  }
  return stored;
}

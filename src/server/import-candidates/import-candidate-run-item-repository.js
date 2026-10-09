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
import { writableExecutionRunSql } from './import-execution-origin-sql.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createApiError } from '../auth.js';

function resolveQueryable(queryable) {
  return queryable ?? getPool();
}

function createRowMapper({ snapshotColumn }) {
  return function mapRunItem(row) {
    return {
      createdAt: row.created_at,
      id: row.id,
      importCandidateId: row.import_candidate_id,
      itemStatus: row.item_status,
      operationRunId: row.operation_run_id,
      position: row.position,
      snapshot: row[snapshotColumn],
      statusMessage: row.status_message,
      updatedAt: row.updated_at,
    };
  };
}

export function createImportCandidateRunItemRepository({
  snapshotColumn = 'planning_snapshot',
  tableName,
} = {}) {
  if (!tableName) {
    throw new Error('tableName is required');
  }

  const mapRunItem = createRowMapper({ snapshotColumn });

  async function listRunItems(operationRunId, queryable) {
    const db = resolveQueryable(queryable);
    const result = await db.query(
      `
        SELECT *
        FROM ${tableName}
        WHERE operation_run_id = $1
        ORDER BY position ASC
      `,
      [operationRunId],
    );

    return result.rows.map(mapRunItem);
  }

  async function replaceRunItems(operationRunId, items, queryable) {
    if (tableName === 'import_execution_run_items' && (!queryable || typeof queryable.release !== 'function')) {
      return createDatabaseTransactionRunner({ getPoolFn: () => queryable ?? getPool() })(
        (client) => replaceRunItems(operationRunId, items, client));
    }
    const db = resolveQueryable(queryable);
    if (tableName === 'import_execution_run_items') {
      const existing = await db.query('SELECT import_candidate_id FROM import_execution_run_items WHERE operation_run_id=$1::uuid', [operationRunId]);
      const ids = [...new Set([...items.map((item) => item.importCandidateId), ...existing.rows.map((row) => row.import_candidate_id)])].sort();
      await db.query('SELECT id FROM import_candidates WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
      const guard = await db.query(`SELECT id FROM operation_runs WHERE id=$1::uuid AND ${writableExecutionRunSql('operation_runs')}
        AND NOT EXISTS(SELECT 1 FROM import_execution_run_items source_item WHERE source_item.operation_run_id=$1::uuid
          AND COALESCE(source_item.planning_snapshot #> '{execution,handoff}','{}'::jsonb) ? 'originResolution') FOR UPDATE`, [operationRunId]);
      if (!guard.rowCount) throw createApiError(409, 'import_execution_origin_resolution_stale', 'The execution history is protected');
    }
    await db.query(
      `DELETE FROM ${tableName} WHERE operation_run_id = $1`,
      [operationRunId],
    );

    const storedItems = [];
    for (const item of items) {
      const result = await db.query(
        `
          INSERT INTO ${tableName} (
            operation_run_id,
            import_candidate_id,
            position,
            item_status,
            status_message,
            ${snapshotColumn},
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
          RETURNING *
        `,
        [
          operationRunId,
          item.importCandidateId,
          item.position,
          item.itemStatus,
          item.statusMessage,
          JSON.stringify(item.snapshot ?? {}),
        ],
      );

      storedItems.push(mapRunItem(result.rows[0]));
    }

    return storedItems;
  }

  async function updateRunItem({
    importCandidateId,
    itemStatus,
    operationRunId,
    snapshot,
    statusMessage,
    expectedAttemptId = undefined,
    expectedAdoptionId = undefined,
    expectedOriginResolutionId = undefined,
  }, queryable) {
    const db = resolveQueryable(queryable);
    const result = await db.query(
      `${tableName === 'import_execution_run_items' ? `WITH candidate_guard AS MATERIALIZED (
        SELECT id FROM import_candidates WHERE id=$2::uuid FOR UPDATE),
        run_guard AS MATERIALIZED (SELECT parent.id FROM operation_runs parent JOIN candidate_guard ON TRUE
          WHERE parent.id=$1::uuid AND ${writableExecutionRunSql('parent')} FOR SHARE OF parent)` : ''}
        UPDATE ${tableName}
        SET item_status = $3,
            status_message = $4,
            ${snapshotColumn} = $5::jsonb,
            updated_at = NOW()
        WHERE operation_run_id = $1
          AND import_candidate_id = $2
          ${expectedAttemptId !== undefined ? `AND ${snapshotColumn} #>> '{execution,handoff,attempt,attemptId}' IS NOT DISTINCT FROM $6::text` : ''}
          ${expectedAdoptionId !== undefined ? `AND ${snapshotColumn} #>> '{execution,handoff,adoption,adoptionId}' IS NOT DISTINCT FROM $7::text` : ''}
          ${expectedOriginResolutionId !== undefined ? `AND ${snapshotColumn} #>> '{execution,handoff,originResolution,resolutionId}' IS NOT DISTINCT FROM $8::text` : ''}
          ${tableName === 'import_execution_run_items' ? 'AND EXISTS(SELECT 1 FROM run_guard)' : ''}
        RETURNING *
      `,
      [
        operationRunId,
        importCandidateId,
        itemStatus,
        statusMessage,
        JSON.stringify(snapshot ?? {}),
        ...(expectedAttemptId !== undefined ? [expectedAttemptId] : []),
        ...(expectedAdoptionId !== undefined ? [expectedAdoptionId] : []),
        ...(expectedOriginResolutionId !== undefined ? [expectedOriginResolutionId] : []),
      ],
    );

    return result.rows[0] ? mapRunItem(result.rows[0]) : null;
  }

  async function upsertRunItem({
    importCandidateId,
    itemStatus,
    operationRunId,
    position,
    snapshot,
    statusMessage,
    preserveExisting = false,
  }, queryable) {
    const db = resolveQueryable(queryable);
    const result = await db.query(
      `${tableName === 'import_execution_run_items' ? `WITH candidate_guard AS MATERIALIZED (
        SELECT id,status FROM import_candidates WHERE id=$2::uuid FOR UPDATE),
        run_guard AS MATERIALIZED (SELECT parent.id FROM operation_runs parent JOIN candidate_guard ON TRUE
          WHERE parent.id=$1::uuid AND ${writableExecutionRunSql('parent')} FOR SHARE OF parent)` : ''}
        INSERT INTO ${tableName} (
          operation_run_id,
          import_candidate_id,
          position,
          item_status,
          status_message,
          ${snapshotColumn},
          updated_at
        )
        ${tableName === 'import_execution_run_items' ? `SELECT $1,$2,$3,$4,$5,$6::jsonb,NOW()
          FROM candidate_guard candidate_parent JOIN run_guard parent ON TRUE
          WHERE TRUE
            AND (candidate_parent.status='selected' OR EXISTS(SELECT 1 FROM import_execution_run_items existing
              WHERE existing.operation_run_id=$1::uuid AND existing.import_candidate_id=$2::uuid))` : 'VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())'}
        ON CONFLICT (operation_run_id, import_candidate_id) DO UPDATE
        ${preserveExisting ? `SET operation_run_id = ${tableName}.operation_run_id` : `SET position = EXCLUDED.position,
            item_status = EXCLUDED.item_status,
            status_message = EXCLUDED.status_message,
            ${snapshotColumn} = EXCLUDED.${snapshotColumn},
            updated_at = NOW()`}
        RETURNING *
      `,
      [
        operationRunId,
        importCandidateId,
        position,
        itemStatus,
        statusMessage,
        JSON.stringify(snapshot ?? {}),
      ],
    );

    return result.rows[0] ? mapRunItem(result.rows[0]) : null;
  }

  return {
    listRunItems,
    replaceRunItems,
    updateRunItem,
    upsertRunItem,
  };
}

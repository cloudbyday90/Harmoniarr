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
    const db = resolveQueryable(queryable);
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
  }, queryable) {
    const db = resolveQueryable(queryable);
    const result = await db.query(
      `
        UPDATE ${tableName}
        SET item_status = $3,
            status_message = $4,
            ${snapshotColumn} = $5::jsonb,
            updated_at = NOW()
        WHERE operation_run_id = $1
          AND import_candidate_id = $2
        RETURNING *
      `,
      [
        operationRunId,
        importCandidateId,
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
  };
}
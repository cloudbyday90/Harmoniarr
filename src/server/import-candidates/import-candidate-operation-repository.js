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

function mapImportOperation(row) {
  if (!row) {
    return null;
  }

  return {
    createdAt: row.created_at,
    destinationPath: row.destination_path,
    errorMessage: row.error_message,
    finishedAt: row.finished_at,
    id: row.id,
    importCandidateFileId: row.import_candidate_file_id,
    importCandidateId: row.import_candidate_id,
    operationRunId: row.operation_run_id,
    operationType: row.operation_type,
    position: row.position,
    sourcePath: row.source_path,
    startedAt: row.started_at,
    status: row.status,
    stepType: row.step_type,
    transport: row.transport,
    updatedAt: row.updated_at,
  };
}

export async function recordImportOperation({
  destinationPath,
  errorMessage = null,
  finishedAt = null,
  importCandidateFileId,
  importCandidateId,
  operationRunId,
  operationType,
  position,
  sourcePath,
  startedAt = null,
  status,
  stepType,
  transport = null,
}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO import_operations (
        operation_run_id,
        import_candidate_id,
        import_candidate_file_id,
        position,
        step_type,
        operation_type,
        transport,
        source_path,
        destination_path,
        status,
        error_message,
        started_at,
        finished_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        COALESCE($12::timestamptz, NOW()),
        COALESCE($13::timestamptz, COALESCE($12::timestamptz, NOW())),
        NOW()
      )
      RETURNING *
    `,
    [
      operationRunId,
      importCandidateId,
      importCandidateFileId,
      position,
      stepType,
      operationType,
      transport,
      sourcePath,
      destinationPath,
      status,
      errorMessage,
      startedAt,
      finishedAt,
    ],
  );

  return mapImportOperation(result.rows[0]);
}

export async function listImportOperations({
  importCandidateId = null,
  operationRunId = null,
} = {}, queryable) {
  const db = resolveQueryable(queryable);
  const clauses = [];
  const values = [];

  if (operationRunId) {
    values.push(operationRunId);
    clauses.push(`operation_run_id = $${values.length}`);
  }

  if (importCandidateId) {
    values.push(importCandidateId);
    clauses.push(`import_candidate_id = $${values.length}`);
  }

  const whereClause = clauses.length > 0
    ? `WHERE ${clauses.join(' AND ')}`
    : '';
  const result = await db.query(
    `
      SELECT *
      FROM import_operations
      ${whereClause}
      ORDER BY created_at ASC, position ASC
    `,
    values,
  );

  return result.rows.map(mapImportOperation);
}
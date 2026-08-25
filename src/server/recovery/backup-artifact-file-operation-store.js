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

function toIso(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function normalizeOperation(row) {
  if (!row) {
    return null;
  }

  return {
    artifactSnapshot: row.artifact_snapshot_json ?? {},
    backupArtifactId: row.backup_artifact_id ?? null,
    completedAt: toIso(row.completed_at),
    createdAt: toIso(row.created_at),
    createdByUserId: row.created_by_user_id ?? null,
    expectedFileSha256: row.expected_file_sha256,
    expectedFileSizeBytes: Number(row.expected_file_size_bytes),
    filename: row.filename,
    id: row.id,
    lastErrorCode: row.last_error_code ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    operationType: row.operation_type,
    status: row.status,
    storagePath: row.storage_path,
    temporaryPath: row.temporary_path ?? null,
    updatedAt: toIso(row.updated_at),
  };
}

const operationColumns = `
  id, operation_type, status, backup_artifact_id, filename, storage_path,
  temporary_path, artifact_snapshot_json, expected_file_sha256,
  expected_file_size_bytes, created_by_user_id, last_error_code,
  last_error_message, completed_at, created_at, updated_at
`;

export function createBackupArtifactFileOperationStore({
  getPoolFn = getPool,
} = {}) {
  async function createFileOperation({
    artifactSnapshot,
    backupArtifactId = null,
    createdByUserId = null,
    expectedFileSha256,
    expectedFileSizeBytes,
    filename,
    operationType,
    storagePath,
    temporaryPath = null,
  }) {
    const result = await getPoolFn().query(
      `
        INSERT INTO backup_artifact_file_operations (
          operation_type, backup_artifact_id, filename, storage_path,
          temporary_path, artifact_snapshot_json, expected_file_sha256,
          expected_file_size_bytes, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        RETURNING ${operationColumns}
      `,
      [
        operationType,
        backupArtifactId,
        filename,
        storagePath,
        temporaryPath,
        JSON.stringify(artifactSnapshot ?? {}),
        expectedFileSha256,
        expectedFileSizeBytes,
        createdByUserId,
      ],
    );

    return normalizeOperation(result.rows[0]);
  }

  async function listIncompleteFileOperations() {
    const result = await getPoolFn().query(
      `
        SELECT ${operationColumns}
        FROM backup_artifact_file_operations
        WHERE status IN ('prepared', 'temporary_ready', 'finalized', 'awaiting_confirmation')
        ORDER BY created_at ASC, id ASC
      `,
    );

    return result.rows.map(normalizeOperation);
  }

  async function updateFileOperation({
    backupArtifactId = undefined,
    fileOperationId,
    lastErrorCode = null,
    lastErrorMessage = null,
    status,
  }) {
    const shouldUpdateArtifactId = backupArtifactId !== undefined;
    const isTerminal = status === 'completed' || status === 'abandoned';
    const result = await getPoolFn().query(
      `
        UPDATE backup_artifact_file_operations
        SET status = $2,
            backup_artifact_id = CASE WHEN $3 THEN $4::uuid ELSE backup_artifact_id END,
            last_error_code = $5,
            last_error_message = $6,
            completed_at = CASE WHEN $7 THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${operationColumns}
      `,
      [
        fileOperationId,
        status,
        shouldUpdateArtifactId,
        backupArtifactId ?? null,
        lastErrorCode,
        lastErrorMessage,
        isTerminal,
      ],
    );

    return normalizeOperation(result.rows[0]);
  }

  return {
    createFileOperation,
    listIncompleteFileOperations,
    updateFileOperation,
  };
}

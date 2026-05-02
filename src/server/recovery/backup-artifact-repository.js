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

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, 50);
}

function normalizeArtifact(row) {
  if (!row) {
    return null;
  }

  return {
    appVersion: row.app_version ?? null,
    backupType: row.backup_type,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    encrypted: row.encrypted,
    fileSizeBytes: Number.isFinite(row.file_size_bytes) ? row.file_size_bytes : null,
    filename: row.filename,
    formatVersion: row.format_version,
    id: row.id,
    manifest: row.manifest_json ?? null,
    migrationLevel: row.migration_level ?? null,
    payloadSha256: row.payload_sha256,
    scope: Array.isArray(row.scope_json) ? row.scope_json : [],
    storagePath: row.storage_path,
  };
}

export function createBackupArtifactRepository({
  getPoolFn = getPool,
} = {}) {
  async function createBackupArtifact({
    appVersion = null,
    backupType = 'logical',
    createdByUserId = null,
    encrypted = false,
    fileSizeBytes,
    filename,
    formatVersion,
    manifest,
    migrationLevel = null,
    payloadSha256,
    scope,
    storagePath,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO backup_artifacts (
          filename,
          backup_type,
          encrypted,
          format_version,
          app_version,
          migration_level,
          scope_json,
          payload_sha256,
          file_size_bytes,
          created_by_user_id,
          storage_path,
          manifest_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb)
        RETURNING id, filename, backup_type, encrypted, format_version, app_version, migration_level, scope_json, payload_sha256, file_size_bytes, created_by_user_id, storage_path, manifest_json, created_at
      `,
      [
        filename,
        backupType,
        encrypted,
        formatVersion,
        appVersion,
        migrationLevel,
        JSON.stringify(scope ?? []),
        payloadSha256,
        fileSizeBytes,
        createdByUserId,
        storagePath,
        JSON.stringify(manifest ?? {}),
      ],
    );

    return normalizeArtifact(result.rows[0]);
  }

  async function listBackupArtifacts({ limit = 25 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, filename, backup_type, encrypted, format_version, app_version, migration_level, scope_json, payload_sha256, file_size_bytes, created_by_user_id, storage_path, manifest_json, created_at
        FROM backup_artifacts
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [normalizeLimit(limit)],
    );

    return result.rows.map(normalizeArtifact);
  }

  async function getBackupArtifactById({ backupArtifactId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, filename, backup_type, encrypted, format_version, app_version, migration_level, scope_json, payload_sha256, file_size_bytes, created_by_user_id, storage_path, manifest_json, created_at
        FROM backup_artifacts
        WHERE id = $1
        LIMIT 1
      `,
      [backupArtifactId],
    );

    return normalizeArtifact(result.rows[0]);
  }

  return {
    createBackupArtifact,
    getBackupArtifactById,
    listBackupArtifacts,
  };
}

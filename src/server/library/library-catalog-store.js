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

import { basename } from 'node:path';
import { getPool } from '../database.js';

function buildLibraryRootName(canonicalPath) {
  return basename(canonicalPath) || canonicalPath;
}

function normalizeObservedFile(file) {
  return {
    canonicalPath: file.canonicalPath,
    relativePath: file.relativePath,
    filename: file.filename,
    extension: file.extension ?? '',
    sizeBytes: Number(file.sizeBytes ?? 0),
    modifiedAt: file.modifiedAt ?? null,
    fileState: file.fileState ?? 'observed',
  };
}

export function createLibraryCatalogStore({
  getPoolFn = getPool,
} = {}) {
  async function recordLibraryFiles({ files, libraryRootPath }) {
    const normalizedFiles = files.map(normalizeObservedFile);
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const rootResult = await client.query(
        `
          INSERT INTO library_roots (
            name,
            path,
            canonical_path,
            updated_at
          )
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (canonical_path) DO UPDATE
          SET name = EXCLUDED.name,
              path = EXCLUDED.path,
              is_enabled = TRUE,
              updated_at = NOW()
          RETURNING id, canonical_path
        `,
        [buildLibraryRootName(libraryRootPath), libraryRootPath, libraryRootPath],
      );

      const libraryRootId = rootResult.rows[0].id;

      const persistedFiles = [];

      for (const file of normalizedFiles) {
        const result = await client.query(
          `
            INSERT INTO library_files (
              library_root_id,
              canonical_path,
              relative_path,
              filename,
              extension,
              size_bytes,
              modified_at,
              file_state,
              updated_at,
              deleted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NULL)
            ON CONFLICT (canonical_path) DO UPDATE
            SET library_root_id = EXCLUDED.library_root_id,
                relative_path = EXCLUDED.relative_path,
                filename = EXCLUDED.filename,
                extension = EXCLUDED.extension,
                size_bytes = EXCLUDED.size_bytes,
                modified_at = EXCLUDED.modified_at,
                file_state = EXCLUDED.file_state,
                updated_at = NOW(),
                deleted_at = NULL
            RETURNING id, canonical_path, relative_path, filename, extension, file_state, tag_payload
          `,
          [
            libraryRootId,
            file.canonicalPath,
            file.relativePath,
            file.filename,
            file.extension,
            file.sizeBytes,
            file.modifiedAt,
            file.fileState,
          ],
        );

        persistedFiles.push({
          canonicalPath: result.rows[0].canonical_path,
          extension: result.rows[0].extension,
          fileState: result.rows[0].file_state,
          filename: result.rows[0].filename,
          id: result.rows[0].id,
          relativePath: result.rows[0].relative_path,
          tagPayload: result.rows[0].tag_payload,
        });
      }

      await client.query(
        `
          UPDATE library_files
          SET deleted_at = NOW(),
              updated_at = NOW()
          WHERE library_root_id = $1
            AND deleted_at IS NULL
            AND NOT (canonical_path = ANY($2::text[]))
        `,
        [libraryRootId, normalizedFiles.map((file) => file.canonicalPath)],
      );

      await client.query('COMMIT');

      return {
        files: persistedFiles,
        libraryRootId,
        observedFileCount: persistedFiles.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    recordLibraryFiles,
  };
}
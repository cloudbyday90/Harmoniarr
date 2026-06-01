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

const libraryFileUpsertBatchSize = 5_000;

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

function toNullableNumber(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPersistedFile(row) {
  return {
    canonicalPath: row.canonical_path,
    extension: row.extension,
    fileState: row.file_state,
    filename: row.filename,
    id: row.id,
    modifiedAt: row.modified_at ?? null,
    relativePath: row.relative_path,
    sizeBytes: toNullableNumber(row.size_bytes),
    tagExtractedModifiedAt: row.tag_extracted_modified_at ?? null,
    tagExtractedSizeBytes: toNullableNumber(row.tag_extracted_size_bytes),
    tagPayload: row.tag_payload,
  };
}

function dedupeFilesByCanonicalPath(files) {
  const fileMap = new Map();

  for (const file of files) {
    if (fileMap.has(file.canonicalPath)) {
      fileMap.delete(file.canonicalPath);
    }

    fileMap.set(file.canonicalPath, file);
  }

  return [...fileMap.values()];
}

function buildFileBatchValues({ files, libraryRootId }) {
  return [
    libraryRootId,
    files.map((file) => file.canonicalPath),
    files.map((file) => file.relativePath),
    files.map((file) => file.filename),
    files.map((file) => file.extension),
    files.map((file) => file.sizeBytes),
    files.map((file) => file.modifiedAt),
    files.map((file) => file.fileState),
  ];
}

function chunkFiles(files, chunkSize = libraryFileUpsertBatchSize) {
  const chunks = [];

  for (let index = 0; index < files.length; index += chunkSize) {
    chunks.push(files.slice(index, index + chunkSize));
  }

  return chunks;
}

export function createLibraryCatalogStore({
  getPoolFn = getPool,
} = {}) {
  async function recordLibraryFiles({ files, libraryRootPath }) {
    const normalizedFiles = dedupeFilesByCanonicalPath(files.map(normalizeObservedFile));
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

      for (const fileBatch of chunkFiles(normalizedFiles)) {
        const batchResult = await client.query(
          `
            WITH input_rows AS (
              SELECT
                $1::uuid AS library_root_id,
                t.canonical_path,
                t.relative_path,
                t.filename,
                t.extension,
                t.size_bytes,
                t.modified_at,
                t.file_state,
                t.row_order
              FROM UNNEST(
                $2::text[],
                $3::text[],
                $4::text[],
                $5::text[],
                $6::bigint[],
                $7::timestamptz[],
                $8::text[]
              ) WITH ORDINALITY AS t(
                canonical_path,
                relative_path,
                filename,
                extension,
                size_bytes,
                modified_at,
                file_state,
                row_order
              )
            ),
            upserted AS (
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
              SELECT
                library_root_id,
                canonical_path,
                relative_path,
                filename,
                extension,
                size_bytes,
                modified_at,
                file_state,
                NOW(),
                NULL
              FROM input_rows
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
              RETURNING
                id,
                canonical_path,
                relative_path,
                filename,
                extension,
                size_bytes,
                modified_at,
                file_state,
                tag_payload,
                tag_extracted_size_bytes,
                tag_extracted_modified_at
            )
            SELECT
              upserted.id,
              upserted.canonical_path,
              upserted.relative_path,
              upserted.filename,
              upserted.extension,
              upserted.size_bytes,
              upserted.modified_at,
              upserted.file_state,
              upserted.tag_payload,
              upserted.tag_extracted_size_bytes,
              upserted.tag_extracted_modified_at
            FROM upserted
            INNER JOIN input_rows
              ON input_rows.canonical_path = upserted.canonical_path
            ORDER BY input_rows.row_order ASC
          `,
          buildFileBatchValues({ files: fileBatch, libraryRootId }),
        );

        persistedFiles.push(...batchResult.rows.map(mapPersistedFile));
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

  async function updateLibraryFileCanonicalPath({ canonicalPath, fileId, filename, relativePath }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        UPDATE library_files
        SET canonical_path = $2,
            relative_path = $3,
            filename = $4,
            updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, canonical_path, relative_path, filename
      `,
      [fileId, canonicalPath, relativePath, filename],
    );

    return result.rows[0] ?? null;
  }

  return {
    recordLibraryFiles,
    updateLibraryFileCanonicalPath,
  };
}

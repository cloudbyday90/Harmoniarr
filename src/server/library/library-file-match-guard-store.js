/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createLibraryScanCatalogueStore } from './library-scan-catalogue-store.js';

export function createLibraryFileMatchGuardStore({ scanAuthorityStore = createLibraryScanCatalogueStore() } = {}) {
  async function readFiles({ prepared, queryable, lock = false }) {
    const result = await queryable.query(`
      SELECT files.id, files.library_root_id, files.canonical_path, files.size_bytes,
        files.modified_at, files.file_state, files.deleted_at, files.tag_payload,
        roots.canonical_path AS root_path
      FROM library_files files
      JOIN library_roots roots ON roots.id = files.library_root_id
      WHERE files.id = ANY($1::uuid[]) AND files.library_root_id = $2::uuid
      ORDER BY files.id
      ${lock ? 'FOR UPDATE OF files' : ''}
    `, [prepared.files.map((file) => file.id), prepared.libraryRootId]);
    return result.rows.map((row) => ({
      id: row.id,
      libraryRootId: row.library_root_id,
      rootPath: row.root_path,
      canonicalPath: row.canonical_path,
      sizeBytes: Number(row.size_bytes),
      modifiedAt: row.modified_at,
      fileState: row.file_state,
      deletedAt: row.deleted_at,
      tagPayload: row.tag_payload,
    }));
  }

  async function lockContext({ prepared, queryable }) {
    const authority = await scanAuthorityStore.lockRunAndLease({ prepared, queryable });
    // Keep catalogue, tag and organize acquisition order: root, then sorted files.
    await queryable.query('SELECT id FROM library_roots WHERE id = $1::uuid FOR UPDATE', [prepared.libraryRootId]);
    return { ...authority, files: await readFiles({ prepared, queryable, lock: true }) };
  }

  async function readContext({ prepared, queryable }) {
    const authority = await scanAuthorityStore.readContext({ prepared, queryable });
    return { ...authority, files: await readFiles({ prepared, queryable }) };
  }

  return { lockContext, readContext, readClock: scanAuthorityStore.readClock };
}

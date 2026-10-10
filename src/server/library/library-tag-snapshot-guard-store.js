/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createLibraryScanCatalogueStore } from './library-scan-catalogue-store.js';

export function createLibraryTagSnapshotGuardStore({ scanAuthorityStore = createLibraryScanCatalogueStore() } = {}) {
  async function readFile({ prepared, queryable, lock = false }) {
    const row = (await queryable.query(`
      SELECT files.id, files.library_root_id, files.canonical_path, files.size_bytes,
        files.modified_at, files.file_state, files.deleted_at, roots.canonical_path AS root_path
      FROM library_files files
      JOIN library_roots roots ON roots.id = files.library_root_id
      WHERE files.id = $1::uuid AND files.library_root_id = $2::uuid
      ${lock ? 'FOR UPDATE OF files' : ''}
    `, [prepared.file.id, prepared.libraryRootId])).rows[0];
    return row ? {
      id: row.id,
      libraryRootId: row.library_root_id,
      rootPath: row.root_path,
      canonicalPath: row.canonical_path,
      sizeBytes: Number(row.size_bytes),
      modifiedAt: row.modified_at,
      fileState: row.file_state,
      deletedAt: row.deleted_at,
    } : null;
  }

  async function lockContext({ prepared, queryable }) {
    const authority = await scanAuthorityStore.lockRunAndLease({ prepared, queryable });
    // Catalogue and organize writers also acquire root before file.
    await queryable.query('SELECT id FROM library_roots WHERE id = $1::uuid FOR UPDATE', [prepared.libraryRootId]);
    return { ...authority, file: await readFile({ prepared, queryable, lock: true }) };
  }

  async function readContext({ prepared, queryable }) {
    const authority = await scanAuthorityStore.readContext({ prepared, queryable });
    return { ...authority, file: await readFile({ prepared, queryable }) };
  }

  return { lockContext, readContext, readClock: scanAuthorityStore.readClock };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createLibraryScanCatalogueStore } from './library-scan-catalogue-store.js';
import { lockLibraryReleaseReconciliation } from './library-release-reconciliation-lock-store.js';

export function createLibraryReleaseReconciliationGuardStore({ scanAuthorityStore = createLibraryScanCatalogueStore() } = {}) {
  async function readContext({ prepared, queryable }) {
    const authority = await scanAuthorityStore.readContext({ prepared, queryable });
    const row = (await queryable.query('SELECT id, canonical_path FROM library_roots WHERE id=$1::uuid',
      [prepared.libraryRootId])).rows[0];
    return { ...authority, root: row ? { id: row.id, canonicalPath: row.canonical_path } : null };
  }

  async function lockContext({ prepared, queryable }) {
    await scanAuthorityStore.lockRunAndLease({ prepared, queryable });
    await lockLibraryReleaseReconciliation({ queryable });
    // READ COMMITTED refreshes context after admission; dependencies are not row-locked.
    return readContext({ prepared, queryable });
  }

  return { lockContext, readContext, readClock: scanAuthorityStore.readClock };
}

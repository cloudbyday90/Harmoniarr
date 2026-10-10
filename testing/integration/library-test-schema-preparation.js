/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { applyPendingMigrations } from '../../src/server/migrations.js';

/** Time the real scenario-bound idempotent migration call without a global pool fallback. */
export async function prepareLibraryTestSchema({ getPoolFn, phaseObserver, signal,
  applyPendingMigrationsFn = applyPendingMigrations } = {}) {
  if (typeof getPoolFn !== 'function' || typeof phaseObserver?.measure !== 'function'
    || typeof applyPendingMigrationsFn !== 'function'
    || (signal != null && typeof signal.aborted !== 'boolean')) throw new TypeError('Library test schema preparation requires its pool and observer');
  return phaseObserver.measure('schema_prepare', async () => {
    if (signal?.aborted) throw signal.reason;
    const result = await applyPendingMigrationsFn({ getPoolFn });
    if (signal?.aborted) throw signal.reason;
    return result;
  });
}

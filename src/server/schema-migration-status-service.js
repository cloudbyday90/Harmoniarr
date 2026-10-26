/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { listMigrationFiles } from './migration-manifest.js';
import { getAppliedMigrationFilenames } from './schema-migration-store.js';

/** Observe prepared schema state without running bootstrap DDL from HTTP reads. */
export async function readMigrationStatus({ queryable = getPool(), listMigrationFilesFn = listMigrationFiles } = {}) {
  const files = await listMigrationFilesFn();
  const applied = await getAppliedMigrationFilenames(queryable);
  return {
    available: files.length,
    applied: applied.size,
    pending: files.filter(file => !applied.has(file.filename)).map(file => file.filename),
  };
}

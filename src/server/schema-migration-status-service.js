/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { listMigrationFiles } from './migration-manifest.js';
import { getAppliedMigrationFilenames } from './schema-migration-store.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Observe prepared schema state without running bootstrap DDL from diagnostic reads. */
export async function readMigrationStatus({ queryable = getPool(), listMigrationFilesFn = listMigrationFiles } = {}) {
  const files = await listMigrationFilesFn();
  const applied = await getAppliedMigrationFilenames(queryable);
  return {
    available: files.length,
    applied: applied.size,
    pending: files.filter(file => !applied.has(file.filename)).map(file => file.filename),
  };
}

/** Compatibility API for callers that provide a pool factory. Preparation is explicit. */
export async function getMigrationStatus({ getPoolFn = getPool } = {}) {
  const client = await getPoolFn().connect();
  return withWorkerTaskCleanup(() => readMigrationStatus({ queryable: client }), () => client.release());
}

export async function assertNoPendingMigrations(options = {}) {
  const status = await getMigrationStatus(options);
  if (status.pending.length > 0) throw new Error(`Pending migrations detected: ${status.pending.join(', ')}`);
  return status;
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { inspectDatabaseMigrationState } from './schema-migration-state-service.js';

/** Refuse inconsistent prepared state before HTTP composition or recovery workers. */
export async function assertStartupMigrationStateCurrent({
  getPoolFn = getPool,
  inspectDatabaseMigrationStateFn = inspectDatabaseMigrationState,
} = {}) {
  const report = await inspectDatabaseMigrationStateFn({ getPoolFn });
  if (report.current !== true || report.repoCount === 0) {
    const summary = [
      `${report.pending.length} pending`,
      `${report.unknownApplied.length} unknown applied`,
      `${report.checksumDrift.length} checksum drift`,
      `${report.migrationKeyDrift.length} migration key drift`,
      `${report.nonAppliedRows.length} non-applied row(s)`,
      `${report.repoCount} repo migration(s)`,
    ].join(', ');
    // Stored filenames, checksums and error messages are privileged diagnostic data.
    throw Object.assign(new Error([
      `Startup migration validation failed: ${summary}.`,
      'Stop application writers and inspect with npm run diagnose:migrations.',
      'Use matching application/migration files and a verified compatible database.',
      'Review pending or failed migrations before explicitly running npm run migrate; do not rewrite ledger checksums to bypass validation.',
    ].join(' ')), { code: 'startup_migration_lineage_invalid' });
  }
  return report;
}

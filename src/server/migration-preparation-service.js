/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { loadMigrationManifest } from './migration-manifest.js';
import { getDatabaseMigrationRows, getMigrationPreparationSchemaState } from './schema-migration-store.js';
import { buildDatabaseMigrationStateReport } from './schema-migration-state-service.js';

function refuse(reason) {
  return Object.assign(new Error([
    `Migration preparation refused: ${reason}.`,
    'Stop writers and inspect with npm run diagnose:migrations using a maintenance connection.',
    'Use matching migration files and a verified compatible database; do not rewrite history to bypass validation.',
    'Only reviewed, unchanged failed migrations may be retried with npm run migrate -- --retry-failed.',
  ].join(' ')), { code: 'migration_preparation_lineage_invalid' });
}

/** Observe on the writer's captured connection before extension, function or ledger DDL. */
export async function assertMigrationPreparationSafe({
  queryable,
  loadMigrationManifestFn = loadMigrationManifest,
  retryFailedMigrations = false,
} = {}) {
  if (typeof retryFailedMigrations !== 'boolean') throw new TypeError('retryFailedMigrations must be boolean');
  const repoMigrations = Object.freeze((await loadMigrationManifestFn()).map(row => Object.freeze({ ...row })));
  if (repoMigrations.length === 0) throw refuse('empty repository manifest');
  const schema = await getMigrationPreparationSchemaState(queryable);
  if (!schema.ledger_present) {
    if (schema.relation_count !== 0) throw refuse('nonempty public schema has no ordinary migration ledger');
    return { repoMigrations, pending: repoMigrations.map(row => row.filename), fresh: true };
  }
  const databaseRows = await getDatabaseMigrationRows(queryable);
  if (databaseRows.length === 0 && schema.relation_count > 1) throw refuse('nonempty public schema has an empty migration ledger');
  const report = buildDatabaseMigrationStateReport({ databaseRows, repoMigrations });
  const expected = new Map(repoMigrations.map(row => [row.filename, row]));
  const blockedRows = report.nonAppliedRows.filter(row => {
    const migration = expected.get(row.filename);
    return !(retryFailedMigrations && row.status === 'failed' && migration
      && row.checksum === migration.checksum && row.migrationKey === migration.migrationKey);
  });
  if (report.unknownApplied.length || report.checksumDrift.length || report.migrationKeyDrift.length || blockedRows.length) {
    throw refuse([
      `${report.unknownApplied.length} unknown applied`, `${report.checksumDrift.length} checksum drift`,
      `${report.migrationKeyDrift.length} migration key drift`, `${blockedRows.length} blocked non-applied row(s)`,
    ].join(', '));
  }
  return { repoMigrations, pending: report.pending, fresh: false };
}

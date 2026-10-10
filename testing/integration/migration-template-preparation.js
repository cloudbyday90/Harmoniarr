/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { applyPendingMigrations } from '../../src/server/migrations.js';
import { assertDatabaseMigrationStateCurrent } from '../../src/server/schema-migration-state-service.js';
import { captureMigrationTemplateInputs } from './migration-template-inputs.js';

const incomplete = () => Object.assign(new Error('Migration template preparation did not verify its complete lineage'),
  { code: 'migration_template_preparation_incomplete' });

function assertCompleteLedger(report, manifest) {
  if (report?.current !== true || report.repoCount !== manifest.length || report.appliedCount !== manifest.length
    || !Array.isArray(report.appliedRows) || report.appliedRows.length !== manifest.length
    || !['pending', 'unknownApplied', 'checksumDrift', 'nonAppliedRows'].every((key) => Array.isArray(report[key]) && report[key].length === 0)) {
    throw incomplete();
  }
  const expected = new Map(manifest.map((migration) => [migration.filename, migration]));
  for (const row of report.appliedRows) {
    const migration = expected.get(row?.filename);
    if (!migration || row.status !== 'applied' || row.checksum !== migration.checksum || row.migrationKey !== migration.migrationKey) {
      throw incomplete();
    }
    expected.delete(row.filename);
  }
  if (expected.size !== 0) throw incomplete();
}

export async function prepareMigrationTemplateDatabase(options = {}) {
  const allowed = ['getPoolFn', 'inputs', 'applyPendingMigrationsFn', 'assertDatabaseMigrationStateCurrentFn'];
  if (options === null || typeof options !== 'object' || Array.isArray(options)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
    || !Object.hasOwn(options, 'getPoolFn') || !Object.hasOwn(options, 'inputs')
    || Reflect.ownKeys(options).some((key) => !allowed.includes(key))) {
    throw new TypeError('Migration template preparation options are invalid');
  }
  const { getPoolFn, inputs, applyPendingMigrationsFn = applyPendingMigrations,
    assertDatabaseMigrationStateCurrentFn = assertDatabaseMigrationStateCurrent } = options;
  const captured = captureMigrationTemplateInputs(inputs);
  if (![getPoolFn, applyPendingMigrationsFn, assertDatabaseMigrationStateCurrentFn].every((fn) => typeof fn === 'function')) {
    throw new TypeError('Migration template preparation requires its pool and migration owners');
  }
  const appliedMigrations = await applyPendingMigrationsFn({ getPoolFn });
  if (!Array.isArray(appliedMigrations) || new Set(appliedMigrations).size !== appliedMigrations.length
    || !appliedMigrations.every((filename) => captured.manifest.some((migration) => migration.filename === filename))) {
    throw incomplete();
  }
  const databaseState = await assertDatabaseMigrationStateCurrentFn({ getPoolFn,
    loadMigrationManifestFn: async () => captured.manifest });
  assertCompleteLedger(databaseState, captured.manifest);
  return Object.freeze({ appliedMigrations: Object.freeze([...appliedMigrations]),
    migrationCount: captured.manifest.length, databaseState });
}

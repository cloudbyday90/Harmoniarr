/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as legacy from '../../src/server/migrations.js';
import { getMigrationStatus, assertNoPendingMigrations } from '../../src/server/schema-migration-status-service.js';
import { verifyAppliedMigrationChecksums, assertNoMigrationChecksumDrift } from '../../src/server/migration-checksum-service.js';
import { inspectDatabaseMigrationState } from '../../src/server/schema-migration-state-service.js';
import { readMigrationFile } from '../../src/server/migration-manifest.js';

const migration = await readMigrationFile('20260427_000001_bootstrap_core_tables.sql');
const readers = [getMigrationStatus, verifyAppliedMigrationChecksums, inspectDatabaseMigrationState];
function fixture({ queryFailure, releaseFailure, queryFails = false, releaseFails = false } = {}) {
  const calls = [];
  const client = {
    async query(sql) {
      assert.equal(this, client); calls.push(sql); assert.match(sql, /^\s*SELECT\b/u);
      if (queryFails) throw queryFailure;
      return { rows: [{ filename: migration.filename, checksum: migration.checksum, status: 'applied', migration_key: migration.migrationKey }] };
    },
    release() { assert.equal(this, client); calls.push('release'); if (releaseFails) throw releaseFailure; },
  };
  return { calls, options: { getPoolFn: () => ({ connect: async () => client }) } };
}

test('migration diagnostics perform one SELECT and release the captured client without schema preparation', async () => {
  for (const reader of readers) {
    const f = fixture(); const result = await reader(f.options);
    assert.equal(f.calls.length, 2); assert.equal(f.calls[1], 'release');
    if (reader === getMigrationStatus) assert.equal(result.applied, 1);
    else if (reader === verifyAppliedMigrationChecksums) assert.equal(result.clean, true);
    else assert.equal(result.appliedCount, 1);
  }
});
test('diagnostic query Error/null survives release failure while every captured client is released once', async () => {
  for (const reader of readers) for (const original of [new Error('original'), null]) {
    const f = fixture({ queryFails: true, queryFailure: original, releaseFails: true, releaseFailure: new Error('cleanup') });
    await assert.rejects(reader(f.options), error => error === original);
    assert.equal(f.calls.filter(value => value === 'release').length, 1);
  }
});
test('release failures remain visible after a successful diagnostic read', async () => {
  for (const reader of readers) for (const original of [new Error('cleanup'), null]) {
    const f = fixture({ releaseFails: true, releaseFailure: original });
    await assert.rejects(reader(f.options), error => error === original);
  }
});
test('legacy migration imports retain the exact read-only diagnostic APIs', () => {
  assert.equal(legacy.getMigrationStatus, getMigrationStatus); assert.equal(legacy.assertNoPendingMigrations, assertNoPendingMigrations);
  assert.equal(legacy.verifyAppliedMigrationChecksums, verifyAppliedMigrationChecksums); assert.equal(legacy.assertNoMigrationChecksumDrift, assertNoMigrationChecksumDrift);
});

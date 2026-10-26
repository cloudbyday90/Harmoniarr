/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMigrationPreparationSafe } from '../../src/server/migration-preparation-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { parseMigrationCliOptions } from '../../src/server/migration-cli-options.js';

const manifest = [{ filename: '20260101_000001_first.sql', migrationKey: '20260101_000001', checksum: 'first', sql: 'SELECT 1' },
  { filename: '20260102_000001_second.sql', migrationKey: '20260102_000001', checksum: 'second', sql: 'SELECT 2' }];
const row = (migration = manifest[0], overrides = {}) => ({ filename: migration.filename, migration_key: migration.migrationKey,
  checksum: migration.checksum, status: 'applied', ...overrides });
function fixture({ rows = [row()], schema = { ledger_present: true, relation_count: 2 }, queryFailure, releaseFailure, failQuery = false } = {}) {
  const calls = [];
  const client = {
    async query(sql) {
      assert.equal(this, client); calls.push(sql);
      if (failQuery) throw queryFailure;
      if (sql.includes('pg_catalog.pg_class')) return { rows: [schema] };
      if (sql.includes('SELECT filename, checksum, status')) return { rows };
      return { rows: [] };
    },
    release() { assert.equal(this, client); calls.push('release'); if (releaseFailure) throw releaseFailure; },
  };
  return { calls, client, options: { queryable: client, loadMigrationManifestFn: async () => manifest } };
}

test('preparation admits a fresh schema, an empty ledger alone and valid absent pending files without DDL', async () => {
  for (const options of [{ schema: { ledger_present: false, relation_count: 0 }, rows: [] },
    { schema: { ledger_present: true, relation_count: 1 }, rows: [] }, {}]) {
    const f = fixture(options); const plan = await assertMigrationPreparationSafe(f.options);
    assert.deepEqual(plan.repoMigrations, manifest); assert.equal(Object.isFrozen(plan.repoMigrations), true);
    assert.deepEqual(plan.pending, options.rows ? manifest.map(file => file.filename) : [manifest[1].filename]);
    for (const sql of f.calls) assert.match(sql, /^\s*SELECT\b/u);
  }
});

test('applied drift, unknown history and every non-applied state block preparation without disclosing stored detail', async () => {
  for (const overrides of [{ checksum: 'private-detail' }, { migration_key: 'private-detail' },
    { filename: 'private-detail' }, { status: 'failed', error_message: 'private-detail' }, { status: 'running' }]) {
    const f = fixture({ rows: [row(manifest[0], overrides)] });
    await assert.rejects(assertMigrationPreparationSafe(f.options), error => {
      assert.equal(error.code, 'migration_preparation_lineage_invalid');
      assert.doesNotMatch(error.message, /private-detail/u); assert.ok(error.message.length < 650); return true;
    });
    for (const sql of f.calls) assert.match(sql, /^\s*SELECT\b/u);
  }
});

test('explicit failed retry permits only known failed rows with matching key and checksum', async () => {
  const f = fixture({ rows: [row(manifest[0], { status: 'failed' })] });
  assert.equal((await assertMigrationPreparationSafe({ ...f.options, retryFailedMigrations: true })).pending.length, 2);
  for (const overrides of [{ status: 'running' }, { status: 'failed', checksum: 'changed' },
    { status: 'failed', migration_key: 'changed' }, { status: 'failed', filename: 'unknown' }]) {
    const invalid = fixture({ rows: [row(manifest[0], overrides)] });
    await assert.rejects(assertMigrationPreparationSafe({ ...invalid.options, retryFailedMigrations: true }), { code: 'migration_preparation_lineage_invalid' });
  }
});

test('nonempty schemas without usable history and empty manifests refuse before preparation writes', async () => {
  for (const schema of [{ ledger_present: false, relation_count: 1 }, { ledger_present: true, relation_count: 2 }]) {
    const f = fixture({ rows: [], schema });
    await assert.rejects(assertMigrationPreparationSafe(f.options), { code: 'migration_preparation_lineage_invalid' });
  }
  const f = fixture();
  await assert.rejects(assertMigrationPreparationSafe({ ...f.options, loadMigrationManifestFn: async () => [] }), /empty repository manifest/u);
  await assert.rejects(assertMigrationPreparationSafe({ ...f.options, retryFailedMigrations: 'true' }), TypeError);
  assert.equal(f.calls.length, 0);
});

test('writer refuses before any DDL and preserves query Error/null over captured-client release failure', async () => {
  for (const original of [new Error('query failure'), null]) {
    const f = fixture({ failQuery: true, queryFailure: original, releaseFailure: new Error('cleanup') });
    await assert.rejects(applyPendingMigrations({ getPoolFn: () => ({ connect: async () => f.client }),
      loadMigrationManifestFn: async () => manifest }), error => error === original);
    assert.equal(f.calls.length, 2); assert.equal(f.calls[1], 'release');
  }
  const f = fixture({ rows: [row(manifest[0], { checksum: 'drift' })] });
  await assert.rejects(applyPendingMigrations({ getPoolFn: () => ({ connect: async () => f.client }),
    loadMigrationManifestFn: async () => manifest }), { code: 'migration_preparation_lineage_invalid' });
  assert.equal(f.calls.at(-1), 'release');
  for (const sql of f.calls.slice(0, -1)) assert.match(sql, /^\s*SELECT\b/u);
});

test('writer executes only captured pending SQL after validation, with one manifest read', async () => {
  const f = fixture(); let loads = 0;
  const applied = await applyPendingMigrations({ getPoolFn: () => ({ connect: async () => f.client }),
    loadMigrationManifestFn: async () => { loads++; return manifest; } });
  assert.deepEqual(applied, [manifest[1].filename]); assert.equal(loads, 1);
  assert.match(f.calls[0], /pg_catalog.pg_class/u); assert.match(f.calls[1], /SELECT filename, checksum, status/u);
  assert.ok(f.calls.indexOf('SELECT 2') > f.calls.findIndex(sql => sql.includes('CREATE TABLE IF NOT EXISTS')));
  assert.equal(f.calls.includes('SELECT 1'), false); assert.equal(f.calls.at(-1), 'release');
});

test('migration retry CLI requires an explicit boolean flag and rejects ambiguous or unknown arguments', () => {
  assert.deepEqual(parseMigrationCliOptions([]), { retryFailedMigrations: false });
  assert.deepEqual(parseMigrationCliOptions(['--retry-failed']), { retryFailedMigrations: true });
  for (const args of [['--retry-failed=false'], ['--repair'], ['true']]) assert.throws(() => parseMigrationCliOptions(args));
});

test('caller mutation during observation cannot replace captured pending SQL or identity', async () => {
  const source = structuredClone(manifest); const f = fixture(); const query = f.client.query;
  f.client.query = async function (sql) {
    source[1].sql = 'unexpected mutation'; source[1].checksum = 'changed';
    return query.call(this, sql);
  };
  await applyPendingMigrations({ getPoolFn: () => ({ connect: async () => f.client }), loadMigrationManifestFn: async () => source });
  assert.equal(f.calls.includes('SELECT 2'), true); assert.equal(f.calls.includes('unexpected mutation'), false);
});

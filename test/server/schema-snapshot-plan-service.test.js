/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { renderSchemaSnapshot } from '../../src/server/schema-snapshot-renderer.js';
import { prepareSchemaSnapshotSql } from '../../src/server/schema-snapshot-plan-service.js';
import { scanMigrationSql } from '../../src/server/migration-sql-lexer.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { withPreparationLockFixture } from '../../testing/server/preparation-lock-fixture.js';

test('the committed snapshot retains exact provenance while all historical frames compile out in memory', async () => {
  const repoMigrations = await loadMigrationManifest(), before = structuredClone(repoMigrations);
  const snapshotSql = await readFile(new URL('../../src/server/schema-snapshot.sql', import.meta.url), 'utf8');
  assert.equal(renderSchemaSnapshot({ migrations: repoMigrations }), snapshotSql);
  const original = scanMigrationSql(snapshotSql), body = prepareSchemaSnapshotSql({ snapshotSql, repoMigrations });
  assert.equal(original.filter(row => row.code === 'BEGIN').length, 42);
  assert.equal(original.filter(row => row.code === 'COMMIT').length, 42);
  assert.equal(scanMigrationSql(body).some(row => /^(BEGIN|COMMIT)\b/u.test(row.code)), false);
  assert.equal(scanMigrationSql(body).filter(row => /^INSERT INTO SCHEMA_MIGRATIONS\b/u.test(row.code)).length, 115);
  assert.deepEqual(repoMigrations, before);
  for (const migration of repoMigrations) assert.ok(body.includes(migration.checksum));
});

test('tampering, old prefixes, missing or empty snapshot lineage refuse before compilation', async () => {
  const repoMigrations = await loadMigrationManifest(), source = renderSchemaSnapshot({ migrations: repoMigrations });
  for (const snapshotSql of ['', source + 'COMMIT;', source.replace(repoMigrations[0].checksum, 'private-tamper'),
    renderSchemaSnapshot({ migrations: repoMigrations.slice(0, -1) })]) {
    assert.throws(() => prepareSchemaSnapshotSql({ snapshotSql, repoMigrations }), error => {
      assert.equal(error.code, 'snapshot_provenance_invalid'); assert.doesNotMatch(error.message, /private-tamper/u); return true;
    });
  }
  for (const missing of [[], undefined, null]) assert.throws(() => prepareSchemaSnapshotSql({ snapshotSql: source, repoMigrations: missing }), { code: 'snapshot_provenance_invalid' });
});

test('matching provenance does not permit unsupported migration transaction controls', () => {
  for (const sql of ['BEGIN READ ONLY; SELECT 1; COMMIT;', 'SELECT 1; COMMIT; SELECT 2;', 'SET synchronous_commit=off;']) {
    const repoMigrations = [{ filename: '20990101_000001_fixture.sql', migrationKey: '20990101_000001', checksum: 'fixture', description: 'fixture', sql }];
    assert.throws(() => prepareSchemaSnapshotSql({ snapshotSql: renderSchemaSnapshot({ migrations: repoMigrations }), repoMigrations }), { code: 'migration_sql_transaction_invalid' });
  }
});

test('loader provenance refusal occurs before BEGIN or any snapshot DDL on the captured connection', async () => {
  const calls = [], repoMigrations = await loadMigrationManifest(); let released = false;
  const client = withPreparationLockFixture({ query: async sql => { calls.push(sql); return { rows: [{ table_count: 0 }] }; }, release() { released = true; } });
  await assert.rejects(bootstrapDatabaseSchemaFromSnapshot({ getPoolFn: () => ({ connect: async () => client }),
    assertMigrationPreparationSafeFn: async () => ({ fresh: true, repoMigrations }), readFileFn: async () => 'private unexpected SQL',
  }), { code: 'snapshot_provenance_invalid' });
  assert.equal(calls.length, 1); assert.match(calls[0], /information_schema.tables/u); assert.equal(released, true);
});

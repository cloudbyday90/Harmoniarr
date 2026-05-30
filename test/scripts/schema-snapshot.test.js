import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSchemaSnapshotCurrent,
  checkDatabaseBackedSchema,
  renderSchemaSnapshot,
  schemaSnapshotPath,
  updateSchemaSnapshot,
} from '../../scripts/schema-snapshot.js';

test('renderSchemaSnapshot emits deterministic bootstrap SQL from the accepted migration lineage', () => {
  const snapshot = renderSchemaSnapshot({
    migrations: [{
      checksum: 'abc123',
      description: 'bootstrap_core_tables',
      filename: '20260427_000001_bootstrap_core_tables.sql',
      migrationKey: '20260427_000001',
      sql: 'BEGIN;\nCREATE TABLE demo_table (id integer);\nCOMMIT;\n',
    }],
  });

  assert.match(snapshot, /-- Harmoniarr schema snapshot/);
  assert.match(snapshot, /CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.match(snapshot, /updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)\n\);/);
  assert.match(snapshot, /-- Migration: 20260427_000001_bootstrap_core_tables\.sql/);
  assert.match(snapshot, /CREATE TABLE demo_table \(id integer\);/);
  assert.match(snapshot, /INSERT INTO schema_migrations/);
  assert.match(snapshot, /'20260427_000001_bootstrap_core_tables\.sql'/);
  assert.match(snapshot, /'abc123'/);
});

test('assertSchemaSnapshotCurrent rejects missing snapshots with update guidance', () => {
  assert.throws(
    () => assertSchemaSnapshotCurrent({
      actualContent: null,
      expectedContent: '-- expected --\n',
    }),
    new RegExp(`Schema snapshot missing at .*${schemaSnapshotPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
});

test('assertSchemaSnapshotCurrent rejects stale snapshots with update guidance', () => {
  assert.throws(
    () => assertSchemaSnapshotCurrent({
      actualContent: '-- stale --\n',
      expectedContent: '-- current --\n',
    }),
    /Schema snapshot is stale .* Run npm run update:schema-snapshot\./,
  );
});

test('updateSchemaSnapshot verifies source database migration state before writing', async () => {
  const calls = [];

  const result = await updateSchemaSnapshot({
    assertDatabaseMigrationStateCurrentFn: async () => {
      calls.push('database');
      return { current: true };
    },
    writeFileFn: async (path, content, encoding) => {
      calls.push({ content, encoding, path });
    },
  });

  assert.equal(calls[0], 'database');
  assert.equal(calls[1].path, schemaSnapshotPath);
  assert.equal(calls[1].encoding, 'utf8');
  assert.match(calls[1].content, /-- Harmoniarr schema snapshot/);
  assert.equal(result.databaseState.current, true);
  assert.ok(result.migrationCount > 0);
  assert.equal(result.snapshotPath, schemaSnapshotPath);
});

test('checkDatabaseBackedSchema verifies source database, committed snapshot, and fresh bootstrap', async () => {
  const calls = [];

  const result = await checkDatabaseBackedSchema({
    assertDatabaseMigrationStateCurrentFn: async () => {
      calls.push('database');
      return { current: true };
    },
    checkSchemaSnapshotFn: async () => {
      calls.push('snapshot');
      return { migrationCount: 2, snapshotPath: 'schema.sql' };
    },
    validateSchemaBootstrapFn: async () => {
      calls.push('bootstrap');
      return { appliedCount: 2, migrationCount: 2 };
    },
  });

  assert.deepEqual(calls, ['database', 'snapshot', 'bootstrap']);
  assert.equal(result.databaseState.current, true);
  assert.equal(result.snapshot.migrationCount, 2);
  assert.equal(result.bootstrap.appliedCount, 2);
});

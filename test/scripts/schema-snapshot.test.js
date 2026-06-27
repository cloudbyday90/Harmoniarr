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
    prepareSchemaSourceFn: async () => {
      calls.push('docker-source');
      return {
        appliedMigrations: ['001.sql'],
        databaseName: 'docker_db',
        databaseState: { current: true },
        image: 'postgres:test',
      };
    },
    writeFileFn: async (path, content, encoding) => {
      calls.push({ content, encoding, path });
    },
  });

  assert.equal(calls[0], 'docker-source');
  assert.equal(calls[1].path, schemaSnapshotPath);
  assert.equal(calls[1].encoding, 'utf8');
  assert.match(calls[1].content, /-- Harmoniarr schema snapshot/);
  assert.equal(result.databaseState.current, true);
  assert.deepEqual(result.appliedMigrations, ['001.sql']);
  assert.equal(result.databaseName, 'docker_db');
  assert.equal(result.dockerImage, 'postgres:test');
  assert.ok(result.migrationCount > 0);
  assert.equal(result.snapshotPath, schemaSnapshotPath);
});

test('checkDatabaseBackedSchema verifies source database, committed snapshot, and fresh bootstrap', async () => {
  const calls = [];
  const sourcePool = {};
  const temporaryDatabaseRunner = async ({ run }) => run({
    databaseName: 'snapshot_db',
    getPoolFn: () => ({}),
  });

  const result = await checkDatabaseBackedSchema({
    checkSchemaSnapshotFn: async () => {
      calls.push('snapshot');
      return { migrationCount: 2, snapshotPath: 'schema.sql' };
    },
    prepareSchemaSourceFn: async ({ run }) => {
      calls.push('docker-source');
      return run({
        databaseName: 'docker_db',
        databaseState: { current: true },
        getPoolFn: () => sourcePool,
        image: 'postgres:test',
        temporaryDatabaseRunner,
      });
    },
    validateSchemaBootstrapFn: async () => {
      calls.push('bootstrap');
      return { appliedCount: 2, migrationCount: 2 };
    },
    validateSchemaAnchorsAgainstSnapshotFn: async ({ getPoolFn }) => {
      calls.push(getPoolFn() === sourcePool ? 'anchors:source' : 'anchors:wrong-source');
      return { anchorCount: 3 };
    },
  });

  assert.deepEqual(calls, ['docker-source', 'snapshot', 'bootstrap', 'anchors:source']);
  assert.equal(result.databaseState.current, true);
  assert.equal(result.databaseName, 'docker_db');
  assert.equal(result.dockerImage, 'postgres:test');
  assert.equal(result.snapshot.migrationCount, 2);
  assert.equal(result.bootstrap.appliedCount, 2);
  assert.equal(result.anchors.anchorCount, 3);
});

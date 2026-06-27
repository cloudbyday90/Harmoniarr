import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSchemaBootstrap } from '../../scripts/schema-bootstrap-validation.js';

test('validateSchemaBootstrap bootstraps an empty temporary database and finds no pending migrations', async () => {
  const calls = [];

  const result = await validateSchemaBootstrap({
    bootstrapSchemaFn: async ({ getPoolFn, schemaSnapshotPath }) => {
      calls.push({ kind: 'bootstrap', getPoolFn, schemaSnapshotPath });
      return {
        bootstrapped: true,
      };
    },
    getAppliedMigrationFilenamesFn: async (client) => {
      calls.push({ kind: 'applied', client });
      return new Set(['20260427_000001_bootstrap.sql', '20260428_000002_more.sql']);
    },
    loadMigrationManifestFn: async () => ([
      { filename: '20260427_000001_bootstrap.sql' },
      { filename: '20260428_000002_more.sql' },
    ]),
    schemaSnapshotPath: 'schema.sql',
    withTemporaryPostgresDatabaseFn: async ({ run }) => {
      return run({
        databaseName: 'temp_db',
        getPoolFn: () => ({
          async connect() {
            return {
              release() {
                calls.push({ kind: 'release' });
              },
            };
          },
        }),
      });
    },
  });

  assert.deepEqual(result, {
    appliedCount: 2,
    databaseName: 'temp_db',
    migrationCount: 2,
    schemaSnapshotPath: 'schema.sql',
  });
  assert.equal(calls[0].kind, 'bootstrap');
  assert.equal(calls[1].kind, 'applied');
  assert.equal(calls[2].kind, 'release');
});

test('validateSchemaBootstrap uses the Docker database runner by default', async () => {
  const calls = [];

  const result = await validateSchemaBootstrap({
    bootstrapSchemaFn: async () => {
      calls.push('bootstrap');
      return { bootstrapped: true };
    },
    getAppliedMigrationFilenamesFn: async () => new Set(['20260427_000001_bootstrap.sql']),
    loadMigrationManifestFn: async () => ([
      { filename: '20260427_000001_bootstrap.sql' },
    ]),
    withDockerizedPostgresDatabaseFn: async ({ run }) => {
      calls.push('docker');
      return run({
        databaseName: 'docker_schema_db',
        getPoolFn: () => ({
          async connect() {
            return {
              release() {
                calls.push('release');
              },
            };
          },
        }),
      });
    },
  });

  assert.equal(result.databaseName, 'docker_schema_db');
  assert.deepEqual(calls, ['docker', 'bootstrap', 'release']);
});

test('validateSchemaBootstrap fails when the snapshot leaves pending migrations', async () => {
  await assert.rejects(
    () => validateSchemaBootstrap({
      bootstrapSchemaFn: async () => ({ bootstrapped: true }),
      getAppliedMigrationFilenamesFn: async () => new Set(['20260427_000001_bootstrap.sql']),
      loadMigrationManifestFn: async () => ([
        { filename: '20260427_000001_bootstrap.sql' },
        { filename: '20260428_000002_more.sql' },
      ]),
      withTemporaryPostgresDatabaseFn: async ({ run }) => run({
        databaseName: 'temp_db',
        getPoolFn: () => ({
          async connect() {
            return {
              release() {},
            };
          },
        }),
      }),
    }),
    /Schema snapshot bootstrap left pending migrations: 20260428_000002_more\.sql/,
  );
});

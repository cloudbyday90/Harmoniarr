import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSchemaAnchorsAgainstSnapshot } from '../../scripts/schema-anchor-validation.js';

function buildPool(client) {
  return {
    async connect() {
      return client;
    },
  };
}

function buildClient(label, calls) {
  return {
    label,
    release() {
      calls.push(`release:${label}`);
    },
  };
}

test('validateSchemaAnchorsAgainstSnapshot compares source anchors to a bootstrapped snapshot database', async () => {
  const calls = [];
  const sourceClient = buildClient('source', calls);
  const snapshotClient = buildClient('snapshot', calls);
  const anchorSnapshot = {
    columns: {
      'column.operation_runs.status': { actual: { dataType: 'text' } },
    },
    constraints: {},
    indexes: {},
    tables: {},
  };

  const result = await validateSchemaAnchorsAgainstSnapshot({
    bootstrapSchemaFn: async ({ schemaSnapshotPath }) => {
      calls.push(`bootstrap:${schemaSnapshotPath}`);
      return { bootstrapped: true };
    },
    getPoolFn: () => buildPool(sourceClient),
    inspectSchemaAnchorsFn: async ({ client }) => {
      calls.push(`inspect:${client.label}`);
      return anchorSnapshot;
    },
    schemaSnapshotPath: 'schema.sql',
    withTemporaryPostgresDatabaseFn: async ({ run }) => run({
      databaseName: 'temp_anchor_db',
      getPoolFn: () => buildPool(snapshotClient),
    }),
  });

  assert.deepEqual(result, {
    anchorCount: 1,
    databaseName: 'temp_anchor_db',
    schemaSnapshotPath: 'schema.sql',
  });
  assert.deepEqual(calls, [
    'inspect:source',
    'release:source',
    'bootstrap:schema.sql',
    'inspect:snapshot',
    'release:snapshot',
  ]);
});

test('validateSchemaAnchorsAgainstSnapshot uses Docker source database when no pool is provided', async () => {
  const calls = [];
  const sourceClient = buildClient('source', calls);
  const snapshotClient = buildClient('snapshot', calls);
  const anchorSnapshot = {
    columns: {
      'column.activity_events.event_type': { actual: { dataType: 'text' } },
    },
    constraints: {},
    indexes: {},
    tables: {},
  };

  const result = await validateSchemaAnchorsAgainstSnapshot({
    applyPendingMigrationsFn: async ({ getPoolFn }) => {
      assert.equal(getPoolFn().label, 'source-pool');
      calls.push('migrate:source');
    },
    bootstrapSchemaFn: async () => {
      calls.push('bootstrap:snapshot');
      return { bootstrapped: true };
    },
    inspectSchemaAnchorsFn: async ({ client }) => {
      calls.push(`inspect:${client.label}`);
      return anchorSnapshot;
    },
    withDockerizedPostgresDatabaseFn: async ({ run }) => {
      calls.push('docker');
      return run({
        env: { PGHOST: '127.0.0.1' },
        getPoolFn: () => ({
          async connect() {
            return sourceClient;
          },
          label: 'source-pool',
        }),
      });
    },
    withTemporaryPostgresDatabaseFn: async ({ run }) => {
      return run({
        databaseName: 'snapshot_db',
        getPoolFn: () => ({
          async connect() {
            return snapshotClient;
          },
        }),
      });
    },
  });

  assert.equal(result.anchorCount, 1);
  assert.deepEqual(calls, [
    'docker',
    'migrate:source',
    'inspect:source',
    'release:source',
    'bootstrap:snapshot',
    'inspect:snapshot',
    'release:snapshot',
  ]);
});

test('validateSchemaAnchorsAgainstSnapshot fails when snapshot bootstrap does not run', async () => {
  await assert.rejects(
    () => validateSchemaAnchorsAgainstSnapshot({
      bootstrapSchemaFn: async () => ({ bootstrapped: false }),
      getPoolFn: () => buildPool(buildClient('source', [])),
      inspectSchemaAnchorsFn: async () => ({
        columns: {},
        constraints: {},
        indexes: {},
        tables: {},
      }),
      withTemporaryPostgresDatabaseFn: async ({ run }) => run({
        databaseName: 'temp_anchor_db',
        getPoolFn: () => buildPool(buildClient('snapshot', [])),
      }),
    }),
    /Schema snapshot bootstrap did not run for anchor validation database temp_anchor_db/,
  );
});

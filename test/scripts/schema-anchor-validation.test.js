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

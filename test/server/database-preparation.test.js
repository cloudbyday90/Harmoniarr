import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareDatabase } from '../../src/server/database-preparation.js';

test('prepareDatabase bootstraps empty databases before applying and verifying migrations', async () => {
  const events = [];

  const result = await prepareDatabase({
    withDatabasePreparationFn: async ({ getPoolFn }, work) => {
      assert.equal(getPoolFn, 'pool-factory');
      return work({ client: 'captured-client' });
    },
    applyPendingMigrationsFn: async ({ getPoolFn }) => {
      assert.equal(getPoolFn, 'pool-factory');
      events.push('apply');
      return ['20260501_010101_example.sql'];
    },
    assertNoPendingMigrationsFn: async ({ getPoolFn, queryable }) => {
      assert.equal(getPoolFn, 'pool-factory');
      assert.equal(queryable, 'captured-client');
      events.push('verify');
      return {
        applied: 19,
        pending: [],
      };
    },
    bootstrapDatabaseSchemaFromSnapshotFn: async ({ getPoolFn }) => {
      events.push('bootstrap');
      assert.equal(getPoolFn, 'pool-factory');
      return {
        bootstrapped: true,
        schemaSnapshotPath: 'schema.sql',
      };
    },
    getPoolFn: 'pool-factory',
  });

  assert.deepEqual(events, ['bootstrap', 'apply', 'verify']);
  assert.deepEqual(result, {
    appliedMigrations: ['20260501_010101_example.sql'],
    bootstrap: {
      bootstrapped: true,
      schemaSnapshotPath: 'schema.sql',
    },
    status: {
      applied: 19,
      pending: [],
    },
  });
});

test('prepareDatabase still applies migrations and verifies lineage when snapshot bootstrap is skipped', async () => {
  const events = [];

  const result = await prepareDatabase({
    withDatabasePreparationFn: async (options, work) => work({ client: 'captured-client' }),
    applyPendingMigrationsFn: async () => {
      events.push('apply');
      return [];
    },
    assertNoPendingMigrationsFn: async () => {
      events.push('verify');
      return {
        applied: 4,
        pending: [],
      };
    },
    bootstrapDatabaseSchemaFromSnapshotFn: async () => {
      events.push('bootstrap');
      return {
        bootstrapped: false,
        reason: 'schema_not_empty',
      };
    },
  });

  assert.deepEqual(events, ['bootstrap', 'apply', 'verify']);
  assert.deepEqual(result, {
    appliedMigrations: [],
    bootstrap: {
      bootstrapped: false,
      reason: 'schema_not_empty',
    },
    status: {
      applied: 4,
      pending: [],
    },
  });
});

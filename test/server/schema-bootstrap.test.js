import assert from 'node:assert/strict';
import test from 'node:test';
import { withPreparationLockFixture } from '../../testing/server/preparation-lock-fixture.js';
import { renderSchemaSnapshot } from '../../src/server/schema-snapshot-renderer.js';
import {
  bootstrapDatabaseSchemaFromSnapshot,
  getPublicTableCount,
} from '../../src/server/schema-bootstrap.js';

test('getPublicTableCount reads the number of public base tables', async () => {
  const queries = [];
  const tableCount = await getPublicTableCount({
    async query(sql) {
      queries.push(sql);
      return {
        rows: [{ table_count: 3 }],
      };
    },
  });

  assert.equal(tableCount, 3);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /information_schema\.tables/);
});

test('bootstrapDatabaseSchemaFromSnapshot applies the schema snapshot only when the public schema is empty', async () => {
  const queryCalls = [];
  let released = false;
  let transactionStatus = 'I';
  const migration = { filename: '20990101_000001_fixture.sql', migrationKey: '20990101_000001',
    description: 'fixture', checksum: 'fixture-checksum', sql: 'BEGIN; CREATE TABLE demo (id integer); COMMIT;' };

  const result = await bootstrapDatabaseSchemaFromSnapshot({
    assertMigrationPreparationSafeFn: async ({ queryable }) => {
      assert.equal(typeof queryable.query, 'function');
      assert.equal(queryCalls.length, 1);
      return { fresh: true, repoMigrations: [migration] };
    },
    getPoolFn: () => ({
      async connect() {
        return withPreparationLockFixture({
          getTransactionStatus: () => transactionStatus,
          async query(sql) {
            queryCalls.push(sql);
            if (queryCalls.length === 1) {
              return {
                rows: [{ table_count: 0 }],
              };
            }

            if (sql === 'BEGIN') transactionStatus = 'T';
            if (sql === 'COMMIT') { transactionStatus = 'I'; return { command: 'COMMIT' }; }
            if (sql.includes('SELECT filename, checksum, status')) return { rows: [{ filename: migration.filename,
              migration_key: migration.migrationKey, checksum: migration.checksum, status: 'applied' }] };
            return { rows: [] };
          },
          release() {
            released = true;
          },
        });
      },
    }),
    readFileFn: async (path, encoding) => {
      assert.equal(path, 'schema.sql');
      assert.equal(encoding, 'utf8');
      return renderSchemaSnapshot({ migrations: [migration] });
    },
    schemaSnapshotPath: 'schema.sql',
  });

  assert.deepEqual(result, {
    bootstrapped: true,
    reason: 'empty_schema',
    schemaSnapshotPath: 'schema.sql',
    tableCount: 0,
  });
  assert.equal(queryCalls.length, 7);
  assert.equal(queryCalls[1], 'BEGIN');
  assert.match(queryCalls[4], /CREATE TABLE demo/);
  assert.match(queryCalls[5], /SELECT filename, checksum, status/u);
  assert.equal(queryCalls[6], 'COMMIT');
  assert.equal(released, true);
});

test('snapshot bootstrap refuses hidden existing relations before reading or executing snapshot SQL and preserves primary failure', async () => {
  for (const original of [new Error('refused'), null]) {
    let reads = 0, queries = 0, releases = 0;
    await assert.rejects(bootstrapDatabaseSchemaFromSnapshot({
      getPoolFn: () => ({ connect: async () => withPreparationLockFixture({
        query: async () => { queries++; return { rows: [{ table_count: 0 }] }; },
        release: () => { releases++; throw new Error('release failed'); },
      }) }),
      assertMigrationPreparationSafeFn: async () => { throw original; },
      readFileFn: async () => { reads++; return 'unsafe'; },
    }), error => error === original);
    assert.equal(reads, 0); assert.equal(queries, 1); assert.equal(releases, 1);
  }
});

test('bootstrapDatabaseSchemaFromSnapshot leaves non-empty schemas alone', async () => {
  const queryCalls = [];

  const result = await bootstrapDatabaseSchemaFromSnapshot({
    getPoolFn: () => ({
      async connect() {
        return withPreparationLockFixture({
          async query(sql) {
            queryCalls.push(sql);
            return {
              rows: [{ table_count: 4 }],
            };
          },
          release() {},
        });
      },
    }),
    readFileFn: async () => {
      throw new Error('schema snapshot should not be read for non-empty schemas');
    },
    schemaSnapshotPath: 'schema.sql',
  });

  assert.deepEqual(result, {
    bootstrapped: false,
    reason: 'schema_not_empty',
    schemaSnapshotPath: 'schema.sql',
    tableCount: 4,
  });
  assert.equal(queryCalls.length, 1);
});

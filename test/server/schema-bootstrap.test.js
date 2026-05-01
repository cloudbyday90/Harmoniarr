import assert from 'node:assert/strict';
import test from 'node:test';
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

  const result = await bootstrapDatabaseSchemaFromSnapshot({
    getPoolFn: () => ({
      async connect() {
        return {
          async query(sql) {
            queryCalls.push(sql);
            if (queryCalls.length === 1) {
              return {
                rows: [{ table_count: 0 }],
              };
            }

            return { rows: [] };
          },
          release() {
            released = true;
          },
        };
      },
    }),
    readFileFn: async (path, encoding) => {
      assert.equal(path, 'schema.sql');
      assert.equal(encoding, 'utf8');
      return 'CREATE TABLE demo (id integer);';
    },
    schemaSnapshotPath: 'schema.sql',
  });

  assert.deepEqual(result, {
    bootstrapped: true,
    reason: 'empty_schema',
    schemaSnapshotPath: 'schema.sql',
    tableCount: 0,
  });
  assert.equal(queryCalls.length, 2);
  assert.match(queryCalls[1], /CREATE TABLE demo/);
  assert.equal(released, true);
});

test('bootstrapDatabaseSchemaFromSnapshot leaves non-empty schemas alone', async () => {
  const queryCalls = [];

  const result = await bootstrapDatabaseSchemaFromSnapshot({
    getPoolFn: () => ({
      async connect() {
        return {
          async query(sql) {
            queryCalls.push(sql);
            return {
              rows: [{ table_count: 4 }],
            };
          },
          release() {},
        };
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
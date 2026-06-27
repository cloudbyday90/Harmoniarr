import assert from 'node:assert/strict';
import test from 'node:test';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

function createFakeContainer(calls) {
  const state = {
    database: 'harmoniarr',
    password: 'pw',
    username: 'user',
  };

  return {
    getDatabase: () => state.database,
    getHost: () => '127.0.0.1',
    getId: () => 'container-1',
    getPassword: () => state.password,
    getPort: () => 55432,
    getUsername: () => state.username,
    async start() {
      calls.push('start');
      return this;
    },
    async stop() {
      calls.push('stop');
    },
    withDatabase(value) {
      calls.push(`database:${value}`);
      state.database = value;
      return this;
    },
    withPassword(value) {
      calls.push(`password:${value}`);
      state.password = value;
      return this;
    },
    withUsername(value) {
      calls.push(`username:${value}`);
      state.username = value;
      return this;
    },
  };
}

test('withDockerizedPostgresDatabase starts PostgreSQL, exposes env and pool, then cleans up', async () => {
  const calls = [];
  const pool = {
    async end() {
      calls.push('pool:end');
    },
    on(eventName) {
      calls.push(`pool:on:${eventName}`);
    },
  };

  const result = await withDockerizedPostgresDatabase({
    containerFactory: (image) => {
      calls.push(`image:${image}`);
      return createFakeContainer(calls);
    },
    createPool: (config) => {
      calls.push({ config });
      return pool;
    },
    database: 'db1',
    image: 'postgres:test',
    password: 'secret',
    run: async ({ databaseConfig, databaseName, env, getPoolFn, image }) => {
      assert.equal(databaseName, 'db1');
      assert.equal(image, 'postgres:test');
      assert.equal(getPoolFn(), pool);
      assert.deepEqual(databaseConfig, {
        database: 'db1',
        host: '127.0.0.1',
        password: 'secret',
        port: 55432,
        user: 'operator',
      });
      assert.equal(env.PGHOST, '127.0.0.1');
      assert.equal(env.PGPORT, '55432');
      assert.equal(env.PGUSER, 'operator');
      assert.equal(env.PGPASSWORD, 'secret');
      assert.equal(env.PGDATABASE, 'db1');
      assert.equal(env.PGMAINTENANCE_DB, 'postgres');
      return { ok: true };
    },
    username: 'operator',
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.slice(0, 5), [
    'image:postgres:test',
    'database:db1',
    'username:operator',
    'password:secret',
    'start',
  ]);
  assert.equal(calls.at(-2), 'pool:end');
  assert.equal(calls.at(-1), 'stop');
});

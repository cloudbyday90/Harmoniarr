import assert from 'node:assert/strict';
import test from 'node:test';
import {
  probePostgresConnection,
  waitForPostgres,
} from '../../scripts/wait-for-postgres.js';

test('probePostgresConnection opens a client, runs a query, and closes it', async () => {
  const calls = [];

  await probePostgresConnection({
    config: {
      database: 'harmoniarr',
      host: '127.0.0.1',
      password: 'secret',
      port: 5432,
      user: 'harmoniarr',
    },
    clientFactory: (config) => ({
      connect: async () => {
        calls.push(['connect', config]);
      },
      end: async () => {
        calls.push(['end']);
      },
      query: async (sql) => {
        calls.push(['query', sql]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['connect', {
      database: 'harmoniarr',
      host: '127.0.0.1',
      password: 'secret',
      port: 5432,
      user: 'harmoniarr',
    }],
    ['query', 'SELECT 1'],
    ['end'],
  ]);
});

test('waitForPostgres retries until the probe succeeds', async () => {
  let attempt = 0;
  let currentTime = 0;
  const waits = [];

  const result = await waitForPostgres({
    config: {
      database: 'harmoniarr',
      host: '127.0.0.1',
      port: 5432,
      user: 'harmoniarr',
    },
    getNow: () => currentTime,
    intervalMs: 250,
    probe: async () => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error(`not ready ${attempt}`);
      }
    },
    timeoutMs: 1000,
    waitFn: async (delayMs) => {
      waits.push(delayMs);
      currentTime += delayMs;
    },
  });

  assert.equal(result.attempts, 3);
  assert.equal(result.waitedMs, 500);
  assert.deepEqual(waits, [250, 250]);
});

test('waitForPostgres reports the last probe error after timing out', async () => {
  let currentTime = 0;

  await assert.rejects(
    () => waitForPostgres({
      getNow: () => currentTime,
      intervalMs: 200,
      probe: async () => {
        throw new Error('auth failed');
      },
      timeoutMs: 400,
      waitFn: async (delayMs) => {
        currentTime += delayMs;
      },
    }),
    /PostgreSQL did not become ready within 400ms after 3 attempt\(s\): auth failed/,
  );
});
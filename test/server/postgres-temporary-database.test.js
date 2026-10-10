/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withTemporaryPostgresDatabase } from '../../testing/postgres-temporary-database.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';

function fixture({ createError = null, runError = null, poolError = null, countError = null } = {}) {
  const calls = []; const records = [];
  const admin = {
    connect: async () => calls.push('connect'), end: async () => calls.push('admin:end'),
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (/^CREATE DATABASE/u.test(sql) && createError) throw createError;
      if (/COUNT/u.test(sql) && countError) throw countError;
      return { rows: [{ active_count: 0 }] };
    },
  };
  const pool = { on: () => {}, end: async () => { calls.push('pool:end'); if (poolError) throw poolError; } };
  const input = { adminClientFactory: () => admin, createPool: () => pool, databaseName: 'controlled_owned_db',
    env: { PGHOST: 'hidden', PGUSER: 'hidden', PGPASSWORD: 'private-password' },
    phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
    run: async ({ getPoolFn, phaseObserver }) => {
      calls.push('run'); assert.equal(getPoolFn(), pool);
      if (runError) throw runError;
      return phaseObserver.measure('scenario_work', () => 'complete');
    },
  };
  return { calls, records, input };
}

test('temporary database phases include owned creation and cleanup without connection or database values', async () => {
  const f = fixture(); assert.equal(await withTemporaryPostgresDatabase(f.input), 'complete');
  assert.deepEqual(f.records.map((record) => record.phase), ['database_connect', 'database_create', 'pool_create',
    'scenario_work', 'pool_close', 'backend_drain', 'database_drop', 'admin_close']);
  assert.equal(JSON.stringify(f.records).includes('private-password'), false);
  assert.equal(JSON.stringify(f.records).includes('controlled_owned_db'), false);
  assert.equal(f.calls.at(-1), 'admin:end');
});

test('failed backend verification is recorded as failure while original scenario identity and owned drop remain', async () => {
  const primary = new Error('Controlled scenario error'); const countError = new Error('Controlled unreadable count');
  const f = fixture({ runError: primary, countError });
  await assert.rejects(withTemporaryPostgresDatabase(f.input), (error) => error === primary);
  assert.equal(f.records.find((record) => record.phase === 'backend_drain').outcome, 'failed');
  assert.ok(f.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
  assert.equal(f.calls.at(-1), 'admin:end');
});

test('failed database creation never terminates or drops an existing database with that name', async () => {
  const primary = Object.assign(new Error('Database already exists'), { code: '42P04' });
  const f = fixture({ createError: primary });
  await assert.rejects(withTemporaryPostgresDatabase(f.input), (error) => error === primary);
  assert.equal(f.calls.includes('run'), false); assert.equal(f.calls.includes('pool:end'), false);
  assert.equal(f.calls.some((call) => typeof call === 'object' && /pg_terminate_backend|DROP DATABASE/u.test(call.sql)), false);
  assert.deepEqual(f.records.map(({ phase, outcome }) => ({ phase, outcome })), [
    { phase: 'database_connect', outcome: 'passed' }, { phase: 'database_create', outcome: 'failed' },
    { phase: 'admin_close', outcome: 'passed' },
  ]);
});

test('callback failure keeps its identity when pool cleanup fails and owned database cleanup still runs', async () => {
  const primary = new Error('Controlled scenario error'); const f = fixture({ runError: primary, poolError: new Error('Secondary cleanup error') });
  await assert.rejects(withTemporaryPostgresDatabase(f.input), (error) => error === primary);
  assert.ok(f.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
  assert.equal(f.records.find((record) => record.phase === 'pool_close').outcome, 'failed');
});

test('strict cleanup rejects incomplete pool closure after an otherwise successful scenario', async () => {
  const failure = new Error('Controlled pool closure failure'); const f = fixture({ poolError: failure });
  await assert.rejects(withTemporaryPostgresDatabase({ ...f.input, strictCleanup: true }), (error) => error === failure);
  assert.ok(f.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
  assert.equal(f.calls.at(-1), 'admin:end');
});

test('legacy cleanup keeps its successful result while strict verification rejects an unreadable drain', async () => {
  const failure = new Error('Controlled unreadable backend count');
  const legacy = fixture({ countError: failure });
  assert.equal(await withTemporaryPostgresDatabase(legacy.input), 'complete');
  const strict = fixture({ countError: failure });
  await assert.rejects(withTemporaryPostgresDatabase({ ...strict.input, strictCleanup: true }), (error) => error === failure);
});

test('strict cleanup preserves a null primary error and continues all owned cleanup', async () => {
  const f = fixture({ poolError: new Error('Secondary closure failure') });
  await withTemporaryPostgresDatabase({ ...f.input, strictCleanup: true, run: async () => { throw null; } })
    .then(() => assert.fail('The scenario failure was lost'), (error) => assert.equal(error, null));
  assert.ok(f.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
  assert.equal(f.calls.at(-1), 'admin:end');
});

test('an adapter creation refusal never gains cleanup ownership', async () => {
  const failure = Object.assign(new Error('Controlled clone collision'), { code: '42P04' }); const f = fixture();
  await assert.rejects(withTemporaryPostgresDatabase({ ...f.input, strictCleanup: true,
    createDatabaseFn: async () => { throw failure; } }), (error) => error === failure);
  assert.equal(f.calls.includes('run'), false);
  assert.equal(f.calls.some((call) => typeof call === 'object' && /DROP DATABASE|pg_terminate_backend/u.test(call.sql)), false);
});

test('pre-aborted creation launches nothing; cancellation after acknowledged creation cleans only the owned database', async () => {
  const controller = new AbortController(); controller.abort(null); const before = fixture();
  await withTemporaryPostgresDatabase({ ...before.input, signal: controller.signal })
    .then(() => assert.fail('A cancelled creation launched'), (error) => assert.equal(error, null));
  assert.deepEqual(before.calls, []);
  const during = new AbortController(); const reason = new Error('Cancelled after creation'); const after = fixture();
  await assert.rejects(withTemporaryPostgresDatabase({ ...after.input, signal: during.signal,
    createDatabaseFn: async () => { after.calls.push('create acknowledged'); during.abort(reason); } }), (error) => error === reason);
  assert.equal(after.calls.includes('run'), false); assert.equal(after.calls.includes('pool:end'), false);
  assert.ok(after.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
});

test('cancellation during asynchronous pool creation closes its pool and never starts scenario work', async () => {
  const f = fixture(); const originalFactory = f.input.createPool;
  const entered = createFixtureGate(); const resume = createFixtureGate();
  const controller = new AbortController(); const reason = new Error('Cancelled during pool creation');
  const operation = withTemporaryPostgresDatabase({ ...f.input, strictCleanup: true, signal: controller.signal,
    createPool: async () => { entered.release(); await resume.promise; return originalFactory(); } });
  operation.catch(() => {});
  await entered.promise; controller.abort(reason); resume.release();
  await assert.rejects(operation, (error) => error === reason);
  assert.equal(f.calls.includes('run'), false); assert.equal(f.calls.includes('pool:end'), true);
  assert.ok(f.calls.some((call) => typeof call === 'object' && /^DROP DATABASE/u.test(call.sql)));
});

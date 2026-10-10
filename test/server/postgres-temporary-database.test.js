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

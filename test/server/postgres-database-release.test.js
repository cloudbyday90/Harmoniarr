/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresIntegrationRuntime, withPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withTemporaryPostgresDatabase } from '../../testing/postgres-temporary-database.js';

function fixture({ external = false, failures = new Map(), beforeStep = async () => {} } = {}) {
  const calls = [];
  const step = async name => {
    calls.push(name); await beforeStep(name);
    if (failures.has(name)) throw failures.get(name);
    return { rows: [{ active_count: 0 }] };
  };
  const admin = { connect: async () => {}, end: () => step('admin_close'), query: sql => {
    if (sql.startsWith('CREATE DATABASE')) return step('database_create');
    if (sql.startsWith('DROP DATABASE')) return step('database_drop');
    return step('backend_drain');
  } };
  return { calls, options: {
    env: { HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS: 'off', ...(external ? { PGPASSWORD: 'controlled' } : {}) },
    createPostgresContainer: () => {
      assert.equal(external, false, 'Borrowed server was acquired');
      return { start: async () => ({
        getDatabase: () => 'controlled', getHost: () => '127.0.0.1', getPort: () => 54321,
        getUsername: () => 'controlled', getPassword: () => 'controlled', stop: () => step('server_stop'),
      }) };
    },
    withTemporaryPostgresDatabaseFn: options => withTemporaryPostgresDatabase({ ...options,
      parentClientFactory: () => null, adminClientFactory: () => admin,
      createPool: () => ({ end: () => step('pool_close') }),
    }),
  } };
}

const releaseOrder = ['database_create', 'pool_close', 'backend_drain', 'database_drop', 'admin_close'];
for (const external of [false, true]) {
  for (const phase of releaseOrder.slice(1)) {
    for (const failure of [new Error('controlled-release'), null]) {
      test(`${external ? 'borrowed' : 'owned'} empty-schema ${phase} preserves ${failure === null ? 'null' : 'Error'} and completes later release`, async () => {
        const f = fixture({ external, failures: new Map([[phase, failure]]) });
        const runtime = await createPostgresIntegrationRuntime(f.options);
        try { await assert.rejects(runtime.runIsolatedDatabase(async () => 'complete'), error => error === failure); }
        finally { await runtime.cleanup(); }
        assert.deepEqual(f.calls, external ? releaseOrder : [...releaseOrder, 'server_stop']);
      });
    }
  }
}

for (const primary of [new Error('controlled-scenario'), null]) {
  test(`wrapper keeps original scenario ${primary === null ? 'null' : 'Error'} through failed database and server release`, async () => {
    const f = fixture({ failures: new Map(['pool_close', 'admin_close', 'server_stop'].map(phase => [phase, new Error('secondary')])) });
    await assert.rejects(withPostgresIntegrationRuntime({ ...f.options, run: async () => { throw primary; } }), error => error === primary);
    assert.deepEqual(f.calls, [...releaseOrder, 'server_stop']);
  });
}

test('first null cleanup failure survives held final release and its later Error', async () => {
  const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false;
  const f = fixture({ failures: new Map([['pool_close', null], ['admin_close', new Error('secondary')]]),
    beforeStep: async phase => { if (phase === 'admin_close') { entered.resolve(); await hold.promise; } },
  });
  const runtime = await createPostgresIntegrationRuntime(f.options);
  const pending = runtime.runIsolatedDatabase(async () => 'complete');
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  try {
    await entered.promise; assert.equal(settled, false); assert.deepEqual(f.calls, releaseOrder);
    hold.resolve(); await assert.rejects(pending, error => error === null);
  } finally { hold.resolve(); await observed; await runtime.cleanup(); }
});

test('wrapper rejects successful work after failed DROP and still awaits its owned server stop', async () => {
  const failure = new Error('controlled-drop');
  const f = fixture({ failures: new Map([['database_drop', failure], ['server_stop', new Error('secondary')]]) });
  await assert.rejects(withPostgresIntegrationRuntime({ ...f.options, run: async () => 'complete' }), error => error === failure);
  assert.deepEqual(f.calls, [...releaseOrder, 'server_stop']);
});

test('normal owned and borrowed empty-schema scenarios retain their exact result', async () => {
  for (const external of [false, true]) {
    const f = fixture({ external }); const result = Object.freeze({ complete: true });
    assert.equal(await withPostgresIntegrationRuntime({ ...f.options, run: async () => result }), result);
    assert.deepEqual(f.calls, external ? releaseOrder : [...releaseOrder, 'server_stop']);
  }
});

test('failed CREATE grants no pool, backend termination or DROP authority through the shared entrypoint', async () => {
  const failure = Object.assign(new Error('controlled-collision'), { code: '42P04' });
  const f = fixture({ external: true, failures: new Map([['database_create', failure]]) });
  await assert.rejects(withPostgresIntegrationRuntime({ ...f.options, run: () => assert.fail('Collision admitted work') }), error => error === failure);
  assert.deepEqual(f.calls, ['database_create', 'admin_close']);
});

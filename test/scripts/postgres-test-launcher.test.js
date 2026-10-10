/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runSharedPostgresTests, postgresWorkersAreQuiescent } from '../../testing/integration/postgres-test-launcher.js';
import { resolvePostgresTestCohort, sharedPostgresTestCohort } from '../../testing/integration/postgres-test-cohort.js';

function fixture() {
  const events = []; let scopeCount = 0;
  const registry = { beginScope: () => { events.push('scope'); return { token: String(++scopeCount) }; },
    closeAdmission: () => events.push('admission:close'), workerPids: () => [123],
    finishScope: async (_token, { workersQuiescent }) => {
      events.push('reconcile'); assert.equal(workersQuiescent, true);
      return { registered: 2, released: 1, reaped: 1 };
    } };
  const input = { resolveFiles: async () => ['one', 'two'], env: { PGHOST: 'borrowed', CUSTOM: 'preserved' },
    createServer: async () => { events.push('server:start'); return { env: { PGHOST: 'owned', PGPASSWORD: 'secret' }, close: async () => events.push('server:stop') }; },
    createAdminClient: () => ({ connect: async () => events.push('admin:connect'), end: async () => events.push('admin:end') }),
    createStore: () => ({}), createRegistry: () => registry,
    createControlServer: async () => ({ endpoint: 'http://127.0.0.1:1234/fixture-database', close: async () => events.push('control:close') }),
    workersAreQuiescent: () => { events.push('worker:probe'); return true; },
    runFile: async ({ file, env }) => { events.push(`file:${file}:close`); assert.equal(env.PGHOST, 'owned');
      assert.equal(env.CUSTOM, 'preserved'); assert.equal(env.HARMONIARR_TEST_PG_MODE, 'parent'); return { exitCode: 0 }; },
  };
  return { events, input, registry };
}
test('parent reconciles each closed worker before the next file and closes owned server once', async () => {
  const f = fixture(); const result = await runSharedPostgresTests(f.input);
  assert.deepEqual(f.events, ['server:start', 'admin:connect', 'scope', 'file:one:close', 'admission:close',
    'worker:probe', 'reconcile', 'scope', 'file:two:close', 'admission:close', 'worker:probe', 'reconcile',
    'control:close', 'admin:end', 'server:stop']);
  assert.equal(result.completed, 2); assert.equal(result.reaped, 2);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
test('a failed native test stops admission and prevents another file while owned cleanup completes', async () => {
  const f = fixture(); f.input.runFile = async () => ({ exitCode: 1 });
  await assert.rejects(runSharedPostgresTests(f.input), { code: 'fixture_parent_test_failed' });
  assert.equal(f.events.filter((event) => event === 'scope').length, 1);
  assert.equal(f.events.at(-1), 'server:stop'); assert.ok(f.events.includes('reconcile'));
});
test('original null cancellation survives incomplete worker and server cleanup failures', async () => {
  const f = fixture(); f.input.runFile = async ({ onCancel, onTermination }) => {
    onCancel(); onTermination({ quiescent: false }); throw null;
  };
  f.registry.finishScope = async (_token, { workersQuiescent }) => { assert.equal(workersQuiescent, false); throw new Error('secondary'); };
  await runSharedPostgresTests(f.input).then(() => assert.fail('Cancellation was lost'), (error) => assert.equal(error, null));
  assert.equal(f.events.filter((event) => event === 'scope').length, 1);
  assert.equal(f.events.at(-1), 'server:stop'); assert.equal(f.events.includes('worker:probe'), false);
});
test('startup failure closes acquired resources without launching a child', async () => {
  const f = fixture(); const primary = new Error('connection failed');
  f.input.createAdminClient = () => ({ connect: async () => { throw primary; }, end: async () => { f.events.push('admin:end'); throw new Error('secondary'); } });
  await assert.rejects(runSharedPostgresTests(f.input), (error) => error === primary);
  assert.deepEqual(f.events, ['server:start', 'admin:end', 'server:stop']);
});
test('pre-aborted launcher starts nothing and worker probes treat only ESRCH as absence', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort(null);
  await runSharedPostgresTests({ ...f.input, signal: controller.signal })
    .then(() => assert.fail('Started after cancellation'), (error) => assert.equal(error, null));
  assert.deepEqual(f.events, []);
  assert.equal(postgresWorkersAreQuiescent([123], () => { throw Object.assign(new Error(), { code: 'ESRCH' }); }), true);
  assert.equal(postgresWorkersAreQuiescent([123], () => { throw Object.assign(new Error(), { code: 'EPERM' }); }), false);
  assert.equal(postgresWorkersAreQuiescent([123], () => {}), false);
});
test('public cohort refuses arbitrary or duplicate file selection before allocating server resources', async () => {
  for (const args of [['test/integration/parent-postgres-launcher.test.js'],
    [sharedPostgresTestCohort[0], sharedPostgresTestCohort[0]], ['--test-force-exit']]) {
    const f = fixture();
    await assert.rejects(runSharedPostgresTests({ ...f.input, resolveFiles: resolvePostgresTestCohort, args }), TypeError);
    assert.deepEqual(f.events, []);
  }
  const files = await resolvePostgresTestCohort({ args: [sharedPostgresTestCohort[0]] });
  assert.equal(files.length, 1); assert.match(files[0], /library-wanted-release-reconciliation\.test\.js$/u);
});

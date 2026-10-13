/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePgStartupContext, readPgStartupLogWindow } from '../../testing/integration/pg-startup-log-policy.js';
import { buildPgStartupServerRecord } from '../../testing/integration/pg-startup-server-record.js';
import { createPostgresStartupLogProbe } from '../../testing/integration/postgres-startup-log-probe.js';
import { supportsPostgresStartupImage } from '../../testing/integration/postgres-startup-config.js';
import { createPostgresFailureEvidence, observePostgresFixtureFailure } from '../../testing/integration/postgres-failure-evidence.js';

const context = Object.freeze({ marker: 'hxi_11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222', user: 'private_user', database: 'private_db' });
const base = { pid: 52, session_id: 'abcdef.34', backend_type: 'client backend', error_severity: 'LOG' };
function rows() { return [
  { ...base, backend_type: 'not initialized', line_num: 1, file_name: 'backend_startup.c', func_name: 'BackendInitialize', message: 'connection received: host=127.0.0.1 port=54321' },
  { ...base, line_num: 2, file_name: 'auth.c', func_name: 'set_authn_id', message: 'connection authenticated: identity="private_user" method=scram-sha-256 (private-path:7)' },
  { ...base, line_num: 3, file_name: 'postinit.c', func_name: 'PerformAuthentication', user: context.user, dbname: context.database,
    message: `connection authorized: user=${context.user} database=${context.database} application_name=${context.marker}` },
  { ...base, line_num: 4, file_name: 'postgres.c', func_name: 'PostgresMain', application_name: context.marker,
    message: 'connection ready: setup total=15.321 ms, fork=0.123 ms, authentication=4.321 ms' },
]; }
const log = entries => entries.map(row => JSON.stringify(row)).join('\n');

test('one authorization marker selects ordered structured stages and numeric components without raw identity', () => {
  const parsed = readPgStartupLogWindow(log(rows()), context); const record = buildPgStartupServerRecord(parsed);
  assert.equal(record.outcome, 'associated'); assert.equal(record.clientId, context.clientId); assert.equal(record.lastStage, 'ready');
  assert.equal(record.receiptObserved, true); assert.equal(record.authenticationObserved, true); assert.equal(record.authorizationObserved, true);
  assert.equal(record.readyObserved, true); assert.equal(record.setupTotalMs, 15.321); assert.equal(record.forkMs, 0.123);
  assert.equal(record.authenticationMs, 4.321); assert.ok(Object.isFrozen(record));
  assert.equal(/private|hxi_|127\.0|abcdef/u.test(JSON.stringify(record)), false);
});

test('receipt and authentication without authorization remain unassociated rather than another client proof', () => {
  const parsed = readPgStartupLogWindow(log(rows().slice(0, 2)), context);
  assert.equal(parsed.outcome, 'unassociated'); assert.equal(parsed.receiptRowsInWindow, 1);
  const other = rows(); other[2].message = other[2].message.replace(context.marker, 'unrelated');
  assert.equal(readPgStartupLogWindow(log(other), context).outcome, 'unassociated');
});

test('duplicated markers, conflicting line numbers and reversed stages refuse association', () => {
  const cases = [[...rows(), { ...rows()[2], pid: 53 }], [...rows(), rows()[2]], rows().map((r, i) => ({ ...r, line_num: 4 - i }))];
  for (const entries of cases) assert.equal(readPgStartupLogWindow(log(entries), context).outcome, 'ambiguous');
});

test('query-generated lookalikes, foreign names and source formats cannot become authorization evidence', () => {
  for (const patch of [{ func_name: 'exec_stmt_raise' }, { file_name: 'pl_exec.c' }, { backend_type: 'autovacuum worker' },
    { user: 'foreign' }, { dbname: 'foreign' }, { state_code: 'P0001' }, { session_id: 'private' }]) {
    const entries = rows(); entries[2] = { ...entries[2], ...patch };
    assert.equal(readPgStartupLogWindow(log(entries), context).outcome, 'unassociated');
  }
});

test('truncated windows are explicit, byte/row caps hold and missing early events never become observed', () => {
  const partial = readPgStartupLogWindow('truncated\n' + log(rows().slice(2)), context);
  assert.equal(partial.clipped, true); assert.equal(partial.outcome, 'associated'); assert.equal(partial.receiptObserved, false);
  assert.equal(readPgStartupLogWindow('x'.repeat(65_537), context).outcome, 'unavailable');
  const capped = readPgStartupLogWindow('{}\n'.repeat(257) + log(rows()), context);
  assert.equal(capped.clipped, true); assert.equal(capped.outcome, 'unassociated');
  assert.equal(readPgStartupLogWindow(log([{ ...rows()[2], message: 'x'.repeat(5000) }]), context).clipped, true);
});

test('changing and hostile context fields are captured once; public hostile fields stay minimized', () => {
  let reads = 0; const input = { ...context, get marker() { reads++; return context.marker; } };
  assert.deepEqual(capturePgStartupContext(input), context); assert.equal(reads, 1);
  assert.equal(capturePgStartupContext({ ...context, get user() { throw null; } }), null);
  const record = buildPgStartupServerRecord(new Proxy({ outcome: 'associated', password: 'private' }, { get(target, key) {
    if (key === 'clientId') throw null; return target[key];
  } }));
  assert.equal(record.outcome, 'unavailable'); assert.equal(JSON.stringify(record).includes('private'), false);
});

test('the read-only probe uses immutable container/context and bounded hidden argv without dumping log failures', async () => {
  const mutable = { ...context }; let args;
  const probe = createPostgresStartupLogProbe({ containerId: 'a'.repeat(64), context: mutable, executeFileFn: async (...input) => {
    args = input; return { stdout: log(rows()) };
  } }); mutable.marker = 'changed';
  assert.equal((await probe()).outcome, 'associated'); assert.equal(args[0], 'docker');
  assert.deepEqual(args[1].slice(0, 4), ['exec', 'a'.repeat(64), 'sh', '-c']);
  assert.equal(args[2].shell, false); assert.equal(args[2].windowsHide, true); assert.equal(args[2].timeout, 2000);
  assert.equal(args[2].maxBuffer, 66_560); assert.equal(JSON.stringify(args).includes('private'), false);
  for (const primary of [new Error('private logs'), null]) assert.equal((await createPostgresStartupLogProbe({
    containerId: 'a'.repeat(64), context, executeFileFn: async () => { throw primary; } })()).outcome, 'failed');
  assert.throws(() => createPostgresStartupLogProbe({ containerId: 'unowned', context }), TypeError);
});

test('only the reviewed image family qualifies for default fresh startup configuration', () => {
  for (const image of ['postgres:18-alpine', 'postgres:18.3-alpine', `postgres:18-alpine@sha256:${'a'.repeat(64)}`]) assert.equal(supportsPostgresStartupImage(image), true);
  for (const image of ['postgres:17-alpine', 'postgres:18', 'custom:18-alpine', undefined]) assert.equal(supportsPostgresStartupImage(image), false);
});

test('off, external, reused, pre-cancelled and disabled startup capture launch no log read', async () => {
  for (const change of [{ mode: 'off' }, { source: 'external_postgres' }, { fresh: false }, { startupLogging: false }, { cancelled: true }]) {
    const records = []; const controller = new AbortController(); if (change.cancelled) controller.abort(null);
    const owner = createPostgresFailureEvidence({ source: 'testcontainer_postgres', fresh: true, startupLogging: true,
      containerId: 'a'.repeat(64), ...change, onRecord: value => records.push(value),
      hostProbeFactory: () => async () => ({ outcome: 'passed' }), readinessProbeFactory: () => async () => ({ outcome: 'accepting' }),
      containerStateProbeFactory: () => async () => ({ outcome: 'passed' }),
      startupLogProbeFactory: () => { assert.fail('An unowned/off startup log read was admitted'); } });
    await owner.createCapture({ signal: controller.signal })(null, 'pool_checkout', context.clientId, context);
    if (change.mode === 'off') assert.equal(records.length, 0);
    else assert.equal(records[0].serverStartup.outcome, 'unavailable');
  }
});

test('failure capture freezes the accepted private context before probe scheduling', async () => {
  const mutable = { ...context }; const records = [];
  const owner = createPostgresFailureEvidence({ source: 'testcontainer_postgres', fresh: true, startupLogging: true, containerId: 'a'.repeat(64),
    onRecord: value => records.push(value), hostProbeFactory: () => async () => ({ outcome: 'passed' }),
    readinessProbeFactory: () => async () => ({ outcome: 'accepting' }), containerStateProbeFactory: () => async () => ({ outcome: 'passed' }),
    startupLogProbeFactory: input => async () => readPgStartupLogWindow(log(rows()), input.context) });
  const pending = owner.createCapture()(null, 'pool_checkout', context.clientId, mutable);
  mutable.marker = 'changed'; mutable.database = 'changed'; await pending;
  assert.equal(records[0].serverStartup.outcome, 'associated'); assert.equal(records[0].serverStartup.clientId, context.clientId);
});

for (const primary of [new Error('Original private work failure'), null]) test(`capture waits for startup evidence while retaining ${primary === null ? 'null' : 'Error'}`, async () => {
  const hold = Promise.withResolvers(); const records = []; let calls = 0;
  const owner = createPostgresFailureEvidence({ source: 'testcontainer_postgres', fresh: true, startupLogging: true, containerId: 'a'.repeat(64),
    onRecord: value => records.push(value), hostProbeFactory: () => async () => ({ outcome: 'passed' }),
    readinessProbeFactory: () => async () => ({ outcome: 'accepting' }), containerStateProbeFactory: () => async () => ({ outcome: 'passed' }),
    startupLogProbeFactory: () => async () => { calls++; await hold.promise; return readPgStartupLogWindow(log(rows()), context); } });
  const capture = owner.createCapture(); let forwarded = false;
  const pending = observePostgresFixtureFailure((error, phase) => capture(error, phase, '33333333-3333-4333-8333-333333333333', context),
    'pool_checkout', async () => { throw primary; });
  void pending.then(() => { forwarded = true; }, () => { forwarded = true; });
  await new Promise(resolve => { setImmediate(resolve); }); assert.equal(calls, 1); assert.equal(records.length, 0); assert.equal(forwarded, false);
  hold.resolve(); await assert.rejects(pending, error => error === primary);
  assert.equal(records[0].version, 4); assert.equal(records[0].serverStartup.outcome, 'associated');
  assert.equal(JSON.stringify(records).includes('private'), false);
});

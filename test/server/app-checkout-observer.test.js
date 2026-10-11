/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPoolCheckoutRecord, capturePoolCheckoutSnapshot } from '../../testing/integration/pool-checkout-record.js';
import { createIntegrationPoolCheckoutObserver, createPoolCheckoutObserver,
  observeAppSchemaPreparation } from '../../testing/integration/app-checkout-observer.js';

const id = '11111111-1111-4111-8111-111111111111';
const context = { correlationId: id, source: 'testcontainer_postgres', serverPhase: 'isolated_database_admitted' };
const poolFixture = () => ({ totalCount: 0, idleCount: 0, waitingCount: 0,
  options: { max: 2, connectionTimeoutMillis: 10_000, password: 'private-password' }, ending: false, ended: false });

test('checkout retains client identity and observes pre-request, dispatched and settled counters', async () => {
  const records = []; const pool = poolFixture(); const client = { release() { assert.fail('Observer must not release'); } };
  const pending = Promise.withResolvers(); let now = 1;
  const observer = createPoolCheckoutObserver({ mode: 'all', onRecord: r => records.push(r), now: () => now++ });
  const result = observer.observe(pool, context, () => { pool.totalCount = 1; pool.waitingCount = 1; return pending.promise; });
  assert.equal(records[0].outcome, 'started');
  assert.equal(records[0].settled.total, null); assert.equal(records[0].durationMs, null);
  pool.waitingCount = 0; pending.resolve(client);
  assert.equal(await result, client);
  assert.equal(records[1].correlationId, id);
  assert.equal(records[1].before.total, 0); assert.equal(records[1].requested.waiting, 1);
  assert.equal(records[1].settled.waiting, 0); assert.equal(records[1].settled.total, 1);
  assert.equal(records[1].durationMs, 1);
});

test('failure-only default emits approved causes while preserving the exact primary error', async () => {
  const records = []; const primary = new Error('private SQL/password', {
    cause: Object.assign(new Error('postgres://private:password@hidden/db'), { code: 'ECONNREFUSED' }),
  });
  const observer = createPoolCheckoutObserver({ onRecord: r => records.push(r) });
  await observer.observe(poolFixture(), context, () => 123);
  assert.equal(records.length, 0);
  await assert.rejects(observer.observe(poolFixture(), context, () => { throw primary; }), e => e === primary);
  assert.equal(records.length, 1); assert.equal(records[0].errors[1].code, 'ECONNREFUSED');
  assert.equal(JSON.stringify(records).includes('private'), false);
});

test('throw-null, cause cycles, hostile getters and unapproved fields stay bounded', async () => {
  const records = []; const observer = createPoolCheckoutObserver({ onRecord: r => records.push(r) });
  let caught = false;
  try { await observer.observe(poolFixture(), context, () => { throw null; }); }
  catch (error) { caught = true; assert.equal(error, null); }
  assert.equal(caught, true);
  const malicious = { name: 'private-class', code: 'private-code', message: 'private-message' };
  malicious.cause = malicious;
  const record = buildPoolCheckoutRecord({ ...context, outcome: 'failed', error: malicious,
    before: { total: 2, password: 'private-secret' }, durationMs: Infinity });
  assert.equal(record.errors.length, 1); assert.equal(record.errors[0].code, null);
  assert.equal(record.durationMs, null); assert.equal(JSON.stringify(record).includes('private'), false);
  const hostile = new Proxy({}, { get() { throw new Error('private getter'); } });
  assert.equal(capturePoolCheckoutSnapshot(hostile).total, null);
  assert.equal(buildPoolCheckoutRecord({ outcome: 'failed', error: hostile }).errors[0].errorClass, null);
});

test('cause depth, invalid metrics and invalid context cannot enlarge the record', () => {
  const failure = Object.assign(new Error('private'), { code: '53300' });
  let chain = failure;
  for (let i = 0; i < 10; i++) chain = new Error('private', { cause: chain });
  const record = buildPoolCheckoutRecord({ correlationId: 'private', source: 'private', serverPhase: 'private',
    outcome: 'failed', error: chain, before: { total: -1, idle: 'private', waiting: 1e9 }, durationMs: -1 });
  assert.equal(record.errors.length, 3); assert.equal(record.correlationId, null);
  assert.equal(record.before.total, null); assert.equal(record.before.idle, null); assert.equal(record.before.waiting, null);
  assert.equal(JSON.stringify(record).includes('private'), false);
  assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.before)); assert.ok(Object.isFrozen(record.errors));
});

test('broken clocks and throwing/rejecting sinks never replace checkout results or errors', async () => {
  const failure = new Error('primary'); const client = {};
  for (const onRecord of [() => { throw new Error('sink'); }, () => Promise.reject(new Error('sink'))]) {
    const observer = createPoolCheckoutObserver({ mode: 'all', onRecord, now: () => { throw new Error('clock'); } });
    assert.equal(await observer.observe(poolFixture(), context, () => client), client);
    await assert.rejects(observer.observe(poolFixture(), context, () => Promise.reject(failure)), e => e === failure);
  }
  await new Promise(resolve => { setImmediate(resolve); });
});

test('off bypasses diagnostics and strict settings reject private input without echoing it', async () => {
  const observer = createPoolCheckoutObserver({ mode: 'off', now: () => assert.fail(), onRecord: () => assert.fail() });
  assert.equal(await observer.observe(null, null, () => 42), 42);
  const getPoolFn = () => poolFixture();
  await observeAppSchemaPreparation({ getPoolFn, observer,
    prepareDatabaseFn: async (options) => { assert.equal(options.getPoolFn, getPoolFn); } });
  assert.throws(() => createIntegrationPoolCheckoutObserver({ env: { HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS: 'private' } }),
    error => error instanceof TypeError && !error.message.includes('private'));
});

test('a schema error after checkout is not reported as a checkout failure', async () => {
  const records = []; const client = {}; const pool = poolFixture();
  pool.connect = async () => client;
  const failure = Object.assign(new Error('private SQL detail'), { code: '23505' });
  await assert.rejects(observeAppSchemaPreparation({ getPoolFn: () => pool,
    observer: createPoolCheckoutObserver({ onRecord: r => records.push(r) }),
    prepareDatabaseFn: async ({ getPoolFn }) => {
      assert.equal(await getPoolFn().connect(), client); throw failure;
    } }), error => error === failure);
  assert.deepEqual(records, []);
});

test('schema adapter binds the real receiver, observes once and leaves pool/client methods unchanged', async () => {
  const records = []; const pool = poolFixture(); const client = {}; let calls = 0;
  pool.connect = function () { assert.equal(this, pool); calls++; return Promise.resolve(client); };
  const connect = pool.connect;
  await observeAppSchemaPreparation({ getPoolFn: () => pool, source: context.source,
    phaseObserver: { correlationId: id }, observer: createPoolCheckoutObserver({ mode: 'all', onRecord: r => records.push(r) }),
    prepareDatabaseFn: async ({ getPoolFn }) => {
      assert.equal(await getPoolFn().connect(), client); assert.equal(await getPoolFn().connect(), client);
    } });
  assert.equal(calls, 2); assert.equal(records.length, 2); assert.equal(pool.connect, connect);
  assert.equal(records[1].lastServerPhase, 'isolated_database_admitted');
});

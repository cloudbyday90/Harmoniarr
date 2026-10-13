/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { observeFixturePoolCheckouts, resolveFixtureCheckoutMode } from '../../testing/integration/fixture-pool-checkout.js';
import { buildFixtureCheckoutRecord } from '../../testing/integration/fixture-checkout-record.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { buildPostgresFailureRecord } from '../../testing/integration/postgres-failure-record.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { withAppPoolCheckoutDiagnostics } from '../../testing/integration/app-pool-checkout.js';

const poolFixture = connect => ({ connect, options: { max: 2, connectionTimeoutMillis: 10_000,
  password: 'private-password' }, totalCount: 0, idleCount: 0, waitingCount: 0, ending: false, ended: false });
const make = (pool, extra = {}) => observeFixturePoolCheckouts({ pool, source: 'testcontainer_postgres',
  poolKind: 'scenario_pool', phaseObserver: createFixturePhaseObserver({ enabled: false }), ...extra });

test('owned promise checkout retains concrete clients/receivers and dispatched queue counters', async () => {
  const client = { release() { assert.fail('Observer cannot release'); } }; const records = [];
  const pending = Promise.withResolvers();
  const pool = poolFixture(function () { assert.equal(this, pool); pool.waitingCount = 1; return pending.promise; });
  const descriptor = Object.getOwnPropertyDescriptor(pool, 'connect');
  const observer = createFixturePhaseObserver({ enabled: false });
  const diagnostics = make(pool, { mode: 'all', onRecord: r => records.push(r), phaseObserver: observer });
  const operation = observer.measure('schema_prepare', () => pool.connect());
  pool.waitingCount = 0; pool.totalCount = 1; pending.resolve(client);
  assert.equal(await operation, client);
  assert.deepEqual(records.map(r => r.outcome), ['started', 'passed']);
  assert.equal(records[1].phase, 'schema_prepare'); assert.equal(records[1].requested.waiting, 1);
  assert.equal(records[1].settled.waiting, 0); assert.equal(records[1].correlationId, observer.correlationId);
  await diagnostics.restore(); assert.deepEqual(Object.getOwnPropertyDescriptor(pool, 'connect'), descriptor);
});

test('callback checkout preserves callback receiver, client/release identity and undefined return', async () => {
  const records = []; const receiver = {}; const client = {}; const release = () => {};
  let callback;
  const pool = poolFixture(function (cb) { assert.equal(this, pool); callback = cb; pool.waitingCount = 1; });
  const diagnostics = make(pool, { mode: 'all', onRecord: r => records.push(r) });
  let received;
  assert.equal(pool.connect(function (...args) { assert.equal(this, receiver); received = args; }), undefined);
  pool.waitingCount = 0; callback.call(receiver, null, client, release);
  assert.deepEqual(received, [null, client, release]);
  assert.equal(records[1].requested.waiting, 1); assert.equal(records[1].settled.waiting, 0);
  await diagnostics.restore();
});

for (const failure of [new Error('private primary'), null]) {
  test(`promise rejection keeps original ${failure === null ? 'null' : 'Error'} beyond held failing capture`, async () => {
    const entered = createFixtureGate(); const held = createFixtureGate(); const records = [];
    const pool = poolFixture(() => Promise.reject(failure)); let settled = false;
    const diagnostics = make(pool, { onRecord: r => records.push(r), captureFailure: async (error, id) => {
      assert.equal(error, failure); assert.equal(id, records[0].checkoutId); assert.equal(pool.ending, false);
      entered.release(); await held.promise; throw new Error('Secondary probe failure');
    } });
    const operation = pool.connect().then(() => assert.fail(), error => { settled = true; assert.equal(error, failure); });
    let restored = false;
    try {
      await entered.promise; const restoration = diagnostics.restore().then(() => { restored = true; });
      await Promise.resolve(); assert.equal(settled, false); assert.equal(restored, false);
      held.release(); await operation; await restoration;
    } finally { held.release(); await operation; }
  });
}

test('callback failure records before capture, waits for it, and retains native callback values', async () => {
  const held = createFixtureGate(); const entered = createFixtureGate(); const records = [];
  const error = Object.assign(new Error('private endpoint'), { code: 'ECONNREFUSED' }); let callback;
  const release = () => {}; const receiver = {};
  const pool = poolFixture(cb => { callback = cb; });
  const diagnostics = make(pool, { onRecord: r => records.push(r), captureFailure: async primary => {
    assert.equal(primary, error); assert.equal(records[0].outcome, 'failed'); entered.release(); await held.promise;
  } });
  const done = Promise.withResolvers(); let settled = false;
  assert.equal(pool.connect(function (...values) { assert.equal(this, receiver); settled = true;
    assert.deepEqual(values, [error, undefined, release]); done.resolve(); }), undefined);
  callback.call(receiver, error, undefined, release);
  try { await entered.promise; assert.equal(settled, false); } finally { held.release(); }
  await done.promise; await diagnostics.restore();
});

test('synchronous throw stays synchronous while restoration drains its admitted capture', async () => {
  const error = new Error('original'); const held = createFixtureGate(); const entered = createFixtureGate();
  const pool = poolFixture(() => { throw error; });
  const diagnostics = make(pool, { onRecord: () => {}, captureFailure: async primary => {
    assert.equal(primary, error); entered.release(); await held.promise;
  } });
  assert.throws(() => pool.connect(), primary => primary === error);
  let restored = false;
  try { await entered.promise; const completion = diagnostics.restore().then(() => { restored = true; });
    await Promise.resolve(); assert.equal(restored, false); held.release(); await completion;
  } finally { held.release(); }
});

test('native callback exception is not misclassified as a second checkout failure', async () => {
  const error = new Error('callback'); const records = []; const client = {};
  const pool = poolFixture(cb => cb(null, client, () => {}));
  const diagnostics = make(pool, { mode: 'all', onRecord: r => records.push(r) });
  assert.throws(() => pool.connect(() => { throw error; }), primary => primary === error);
  assert.deepEqual(records.map(r => r.outcome), ['started', 'passed']); await diagnostics.restore();
});

test('off preserves the native function and receiver borrowing bypasses owned observations', async () => {
  const original = function () { return Promise.resolve(this); }; const pool = poolFixture(original);
  const off = make(pool, { mode: 'off', onRecord: () => assert.fail() });
  assert.equal(pool.connect, original); await off.restore();
  const records = []; const owner = make(pool, { onRecord: r => records.push(r) }); const borrowed = {};
  assert.equal(await pool.connect.call(borrowed), borrowed); assert.equal(records.length, 0); await owner.restore();
});

test('record budgets, invalid settings and hostile/private fields remain bounded', async () => {
  const records = []; const pool = poolFixture(() => Promise.resolve({}));
  const owner = make(pool, { mode: 'all', onRecord: r => records.push(r) });
  for (let i = 0; i < 70; i++) await pool.connect();
  const error = new Error('private'); pool.connect = pool.connect.bind(pool);
  await assert.rejects(owner.restore(), /ownership changed/u);
  assert.equal(records.length, 128);
  assert.throws(() => resolveFixtureCheckoutMode({ HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS: 'private' }), TypeError);
  const record = buildFixtureCheckoutRecord({ checkoutId: 'private', correlationId: 'private', poolKind: 'private',
    phase: 'private', outcome: 'failed', error, before: { password: 'private' } });
  assert.equal(JSON.stringify(record).includes('private'), false); assert.equal(record.phase, 'unknown');
  assert.ok(Object.isFrozen(record));
  const server = buildPostgresFailureRecord({ phase: 'pool_checkout', checkoutId: records[0].checkoutId });
  assert.equal(server.version, 3); assert.equal(server.checkoutId, records[0].checkoutId);
});

test('throwing clock/sink and rejected sink never replace checkout authority', async () => {
  const failure = new Error('original');
  for (const onRecord of [() => { throw null; }, () => Promise.reject(null)]) {
    const pool = poolFixture(() => Promise.reject(failure));
    const owner = make(pool, { mode: 'all', onRecord, now: () => { throw null; } });
    await assert.rejects(pool.connect(), error => error === failure); await owner.restore();
  }
});

test('inherited driver method is restored and failure records retain their separate budget', async () => {
  const error = new Error('original'); const prototype = { connect: () => Promise.reject(error) };
  const pool = Object.assign(Object.create(prototype), { options: { max: 2, connectionTimeoutMillis: 10_000 } });
  const records = []; const owner = make(pool, { mode: 'all', onRecord: r => records.push(r) });
  for (let i = 0; i < 150; i++) await assert.rejects(pool.connect(), e => e === error);
  assert.equal(records.filter(r => r.outcome === 'failed').length, 16);
  assert.equal(records.filter(r => r.outcome === 'started').length, 128);
  await owner.restore(); assert.equal(Object.hasOwn(pool, 'connect'), false); assert.equal(pool.connect, prototype.connect);
});

test('application adapter decorates lazily, coalesces the same pool and retains Error/null over restore failure', async () => {
  for (const failure of [new Error('original'), null]) {
    let requested = 0; const pool = poolFixture(() => Promise.resolve({}));
    const observed = withAppPoolCheckoutDiagnostics({ getPoolFn: () => { requested++; return pool; },
      env: {}, onRecord: () => {} }, async getPoolFn => {
      assert.equal(requested, 0); assert.equal(getPoolFn(), pool); const decorated = pool.connect;
      assert.equal(getPoolFn(), pool); assert.equal(pool.connect, decorated);
      pool.connect = () => Promise.resolve({}); throw failure;
    });
    await assert.rejects(observed, error => error === failure); assert.equal(requested, 2);
  }
});

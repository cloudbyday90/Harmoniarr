/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPoolConfig } from '../../src/server/database.js';
import { attachPoolAdmissionLimit, buildPoolAdmissionPolicy, getPoolAdmissionState } from '../../src/server/database-pool-admission-service.js';
import { normalizeDatabaseConnectionError } from '../../src/server/database-error-mapper.js';

test('production checkout defaults are finite and explicit supported configuration is preserved', () => {
  assert.equal(buildPoolConfig({}).connectionTimeoutMillis, 5_000);
  assert.equal(buildPoolConfig({ PGPOOL_CONNECTION_TIMEOUT_MS: '12000' }).connectionTimeoutMillis, 12_000);
  assert.deepEqual(buildPoolAdmissionPolicy({}), { maxPendingCheckouts: 64 });
  assert.deepEqual(buildPoolAdmissionPolicy({ HARMONIARR_PG_POOL_MAX_PENDING: '3' }), { maxPendingCheckouts: 3 });
  for (const value of ['0','-1','1oops','1.5','Infinity','9007199254740992']) {
    assert.throws(() => buildPoolConfig({ HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS: value }));
    assert.throws(() => buildPoolAdmissionPolicy({ HARMONIARR_PG_POOL_MAX_PENDING: value }));
  }
  assert.throws(() => buildPoolConfig({ PGPOOL_CONNECTION_TIMEOUT_MS: '2147483648' }));
});

test('promise and callback checkouts share one finite admission limit without queueing refusals', async () => {
  const gate = Promise.withResolvers(), callbacks = []; let calls = 0;
  const pool = { connect(callback) { assert.equal(this, pool); calls++; if (callback) { callbacks.push(callback); return; } return gate.promise; } };
  attachPoolAdmissionLimit(pool, { maxPendingCheckouts: 2 });
  const first = pool.connect(), second = new Promise((resolve, reject) => { pool.connect((error, value) => error ? reject(error) : resolve(value)); });
  assert.deepEqual(getPoolAdmissionState(pool), { pendingCheckouts: 2, maxPendingCheckouts: 2 });
  await assert.rejects(pool.connect(), { code: 'database_pool_busy' });
  await new Promise(resolve => { pool.connect(error => { assert.equal(error.code, 'database_pool_busy'); resolve(); }); });
  assert.equal(calls, 2);
  gate.resolve('first'); callbacks[0](null, 'second'); assert.equal(await first, 'first'); assert.equal(await second, 'second');
  assert.equal(getPoolAdmissionState(pool).pendingCheckouts, 0); assert.equal(await pool.connect(), 'first');
  assert.throws(() => attachPoolAdmissionLimit(pool));
});

test('native callback receiver, release function and Error/null are delivered unchanged', async () => {
  for (const error of [new Error('original'), null]) {
    let deliver;
    const pool = attachPoolAdmissionLimit({ connect(callback) { deliver = callback; } });
    const client = {}, release = () => {}, receiver = {}; let called = false;
    pool.connect(function (...args) { called = true; assert.equal(this, receiver); assert.deepEqual(args, [error, client, release]); });
    deliver.call(receiver, error, client, release); assert.equal(called, true); assert.equal(getPoolAdmissionState(pool).pendingCheckouts, 0);
  }
});

test('native rejection, synchronous failure and throwing callbacks release only their admission count', async () => {
  for (const error of [new Error('original'), null]) {
    const rejected = attachPoolAdmissionLimit({ connect: () => Promise.reject(error) });
    await assert.rejects(rejected.connect(), cause => cause === error); assert.equal(getPoolAdmissionState(rejected).pendingCheckouts, 0);
    const throwing = attachPoolAdmissionLimit({ connect() { throw error; } });
    let caught = false;
    try { throwing.connect(); } catch (cause) { caught = true; assert.equal(cause, error); }
    assert.equal(caught, true); assert.equal(getPoolAdmissionState(throwing).pendingCheckouts, 0);
    const callbackPool = attachPoolAdmissionLimit({ connect(callback) { callback(); } });
    try { callbackPool.connect(() => { throw error; }); assert.fail('callback did not throw'); } catch (cause) { assert.equal(cause, error); }
    assert.equal(getPoolAdmissionState(callbackPool).pendingCheckouts, 0);
  }
});

test('native shutdown remains authoritative and known admission failures map to safe 503 with private cause', async () => {
  const error = new Error('native shutdown');
  const pool = attachPoolAdmissionLimit({ ending: true, connect: () => Promise.reject(error) });
  await assert.rejects(pool.connect(), cause => cause === error); assert.equal(getPoolAdmissionState(pool).pendingCheckouts, 0);
  for (const original of [Object.assign(new Error('private marker'), { code: 'database_pool_busy' }),
    new Error('timeout exceeded when trying to connect'), new Error('Connection terminated due to connection timeout')]) {
    const mapped = normalizeDatabaseConnectionError(original);
    assert.equal(mapped.status, 503); assert.equal(mapped.cause, original); assert.doesNotMatch(mapped.message, /private|timeout exceeded/u);
  }
});

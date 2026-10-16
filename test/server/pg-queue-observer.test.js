/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { buildPgAcquisitionRecord } from '../../testing/integration/pg-acquisition-record.js';
import { observeOwnedPgQueue } from '../../testing/integration/owned-pg-queue-observer.js';
import { observeFixturePoolCheckouts } from '../../testing/integration/fixture-pool-checkout.js';

const unobserved = run => run();
const connection = { dispatch: unobserved };
function observe(pool) {
  let tick = 0;
  return observeOwnedPgQueue({ pool, now: () => tick++, runUnobserved: unobserved });
}

test('acquisition records whitelist hostile fields, enums and finite bounded offsets', () => {
  const input = new Proxy({ observation: 'observed', lastStage: 'private-secret', clientKind: 'new',
    queuedMs: 2, newClientMs: -1, acquireEnteredMs: Infinity, deliveredMs: 86_400_001, password: 'private' }, {
    get(target, key) { if (key === 'clientKind') throw null; return target[key]; },
  });
  const record = buildPgAcquisitionRecord(input);
  assert.equal(record.observation, 'observed'); assert.equal(record.lastStage, 'unknown');
  assert.equal(record.clientKind, 'unavailable'); assert.equal(record.queuedMs, 2);
  for (const key of ['newClientMs', 'acquireEnteredMs', 'deliveredMs']) assert.equal(record[key], null);
  assert.ok(Object.isFrozen(record)); assert.equal(JSON.stringify(record).includes('private'), false);
});

for (const failure of [new Error('original'), null]) {
  test(`queue dispatch preserves synchronous ${failure === null ? 'null' : 'Error'} and restores admission`, async () => {
    const pool = new pg.Pool(); const observer = observe(pool);
    const descriptors = ['newClient', '_acquireClient'].map(key => Object.getOwnPropertyDescriptor(pool, key));
    try {
      const failed = observer.begin(connection);
      assert.throws(() => failed.dispatch(() => { throw failure; }), error => error === failure);
      failed.finish();
      const next = observer.begin(connection); const item = { callback() {} };
      assert.equal(next.dispatch(() => { pool._pendingQueue.push(item); return 7; }), 7);
      assert.equal(next.snapshot().lastStage, 'queued');
      next.finish(); pool._pendingQueue.length = 0;
      assert.equal(descriptors.every(Boolean), true);
    } finally { observer.restore(); pool._pendingQueue.length = 0; await pool.end(); }
    for (const key of ['newClient', '_acquireClient']) assert.equal(Object.hasOwn(pool, key), false);
  });
}

test('a saved pending item owns acquire entry independently of another active dispatch', async () => {
  const pool = new pg.Pool(); const observer = observe(pool); const first = observer.begin(connection);
  const second = observer.begin(connection); const client = new pg.Client(); let release;
  const item = { callback(error, acquired, done) { assert.equal(error, undefined); assert.equal(acquired, client); release = done; } };
  try {
    first.dispatch(() => pool._pendingQueue.push(item)); pool._pendingQueue.shift();
    second.dispatch(() => pool._acquireClient(client, item, () => {}, false));
    assert.equal(first.snapshot().lastStage, 'acquire_entered'); assert.equal(first.snapshot().clientKind, 'reused');
    assert.equal(second.snapshot().acquireEnteredMs, null);
    assert.equal(typeof release, 'function');
    first.finish(); second.finish(); observer.restore();
  } finally { client.connection.stream.destroy(); pool._pendingQueue.length = 0; await pool.end(); }
});

test('finished and unknown pending items cannot inherit another checkout acquisition', async () => {
  const pool = new pg.Pool(); const observer = observe(pool); const old = observer.begin(connection);
  const item = { callback() {} }; const client = new pg.Client(); const next = observer.begin(connection);
  try {
    old.dispatch(() => pool._pendingQueue.push(item)); old.finish(); pool._pendingQueue.shift();
    next.dispatch(() => pool._acquireClient(client, item, () => {}, false));
    assert.equal(next.snapshot().acquireEnteredMs, null); assert.equal(old.snapshot().acquireEnteredMs, null);
    next.finish(); observer.restore();
  } finally { client.connection.stream.destroy(); pool._pendingQueue.length = 0; await pool.end(); }
});

test('ambiguous, accessor and oversized queue snapshots refuse mapping without reading payloads', async () => {
  for (const kind of ['ambiguous', 'accessor', 'oversized', 'proxy']) {
    const pool = new pg.Pool(); const observer = observe(pool); let reads = 0;
    const entry = observer.begin(connection);
    try {
      entry.dispatch(() => {
        if (kind === 'ambiguous') pool._pendingQueue.push({}, {});
        if (kind === 'oversized') pool._pendingQueue.push(...Array.from({ length: 129 }, () => ({})));
        if (kind === 'accessor') Object.defineProperty(pool._pendingQueue, 0, { get() { reads++; throw null; }, configurable: true });
        if (kind === 'proxy') pool._pendingQueue = new Proxy([], { get() { reads++; throw null; } });
      });
      assert.equal(entry.snapshot().observation, 'adapter_unavailable'); assert.equal(reads, 0);
      entry.finish(); observer.restore();
    } finally { pool._pendingQueue = []; await pool.end(); }
  }
});

test('custom native method/client overrides remain untouched and unsupported', async () => {
  for (const key of ['connect', 'newClient', '_acquireClient', '_pulseQueue', 'Client']) {
    const pool = new pg.Pool(); const original = pool[key]; const custom = function () {};
    pool[key] = custom;
    const observer = observe(pool);
    assert.equal(observer.begin(connection).snapshot().observation, 'unsupported_driver');
    observer.restore(); assert.equal(pool[key], custom); pool[key] = original; await pool.end();
  }
});

test('an unsupported custom connect cannot supply a cold-client owner through synchronous construction', async () => {
  const pool = new pg.Pool(); const records = []; let client;
  pool.connect = function () { client = new this.Client(this.options); return Promise.resolve(client); };
  const original = pool.connect;
  const diagnostics = observeFixturePoolCheckouts({ pool, mode: 'all', onRecord: record => records.push(record) });
  try {
    assert.equal(await pool.connect(), client);
    assert.equal(records[1].acquisition.observation, 'unsupported_driver');
    assert.equal(records[1].connection.observation, 'not_observed');
    assert.equal(records[1].connection.clientId, null);
    assert.equal(Object.hasOwn(client.connection, 'startup'), false);
  } finally { await diagnostics.restore(); client?.connection.stream.destroy(); await pool.end(); }
  assert.equal(pool.connect, original);
});

test('restore attempts each owned descriptor and preserves a later method owner', async () => {
  const pool = new pg.Pool(); const Client = Object.getOwnPropertyDescriptor(pool, 'Client');
  const original = pool.connect; const diagnostics = observeFixturePoolCheckouts({ pool, onRecord: () => {} });
  const later = () => {}; pool.newClient = later;
  await assert.rejects(diagnostics.restore(), /Fixture queue observer ownership changed/);
  assert.equal(pool.newClient, later); assert.equal(Object.hasOwn(pool, '_acquireClient'), false);
  assert.deepEqual(Object.getOwnPropertyDescriptor(pool, 'Client'), Client); assert.equal(pool.connect, original);
  await pool.end();
});

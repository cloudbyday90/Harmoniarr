/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { startSessionLookup } from '../../src/server/session-lookup-owner-service.js';
import { readRefreshTokenSession, readRequestSessionRow } from '../../src/server/session-lookup-service.js';

function fixture(options = {}) {
  let status = options.status ?? 'I'; const queries = [], releases = [], closes = [];
  const client = Object.assign(new EventEmitter(), { getTransactionStatus: () => status, async query(sql, values) {
    queries.push({ sql, values });
    if (sql.startsWith('BEGIN')) { status = 'T'; return { command: 'BEGIN' }; }
    if (sql === 'ROLLBACK') { if (Object.hasOwn(options, 'rollbackError')) throw options.rollbackError; status = 'I'; return { command: 'ROLLBACK' }; }
    return { rows: options.rows ?? [{ id: 'user', role: 'admin' }] };
  }, release(value) { releases.push(value); } });
  const owner = { getPoolFn: () => ({ connect: async () => client }), createRetirementFn: () => ({ async close(value) {
    closes.push(value); if (Object.hasOwn(options, 'closeError')) throw options.closeError; client.emit('end');
  } }) };
  return { owner, client, queries, releases, closes };
}

test('fresh session reads use a read-only transaction, parameterized lookup and clean reusable checkout', async () => {
  const f = fixture(); const row = await readRefreshTokenSession('hashed-token', f.owner);
  assert.deepEqual(row, { id: 'user', role: 'admin' });
  assert.match(f.queries[0].sql, /READ COMMITTED READ ONLY/u); assert.match(f.queries[1].sql, /statement_timeout='3s'/u);
  assert.deepEqual(f.queries[2].values, ['hashed-token']); assert.match(f.queries[2].sql, /public.refresh_tokens/u);
  assert.equal(f.queries.at(-1).sql, 'ROLLBACK'); assert.deepEqual(f.releases, [undefined]); assert.deepEqual(f.closes, []);
  assert.equal(f.client.listenerCount('error'), 0); assert.equal(f.client.listenerCount('end'), 0);
  assert.equal(await readRefreshTokenSession('missing', fixture({ rows: [] }).owner), null);
});

test('lookup failures refuse authority and preserve original Error/null through failed rollback and close', async () => {
  for (const original of [new Error('private SQL token secret'), null]) {
    const f = fixture({ rollbackError: new Error('rollback failed'), closeError: new Error('close failed') });
    const task = startSessionLookup(async () => { throw original; }, f.owner);
    await assert.rejects(task.result, error => error.status === 503 && error.cause === original && !error.message.includes('private'));
    assert.equal(await task.drained, false); assert.deepEqual(f.releases, []); assert.equal(f.client.listenerCount('error'), 1);
    f.client.emit('error', new Error('late connection error')); f.client.emit('end'); assert.equal(f.client.listenerCount('error'), 0);
  }
  const dirty = fixture({ status: 'T' });
  await assert.rejects(readRefreshTokenSession('hash', dirty.owner), { code: 'session_lookup_unavailable' });
  assert.equal(dirty.queries.length, 0); assert.deepEqual(dirty.releases, [true]);
});

test('deadline owns late pool delivery and waits for close before releasing exactly once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const checkout = Promise.withResolvers(), close = Promise.withResolvers(); const f = fixture(); let entered = false, closed = 0;
  const task = startSessionLookup(async () => { entered = true; }, { getPoolFn: () => ({ connect: () => checkout.promise }), timeoutMs: 100,
    createRetirementFn: () => ({ close({ force }) { assert.equal(force, true); closed++; return close.promise; } }) });
  const refused = assert.rejects(task.result, { status: 503 }); await Promise.resolve(); t.mock.timers.tick(100); await refused;
  checkout.resolve(f.client); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(entered, false); assert.equal(closed, 1); assert.deepEqual(f.releases, []);
  close.resolve(); assert.equal(await task.drained, true); assert.deepEqual(f.releases, [true]);
});

test('failed rollback cannot publish a row and discards its checkout after transport retirement', async () => {
  const f = fixture({ rollbackError: null });
  await assert.rejects(readRefreshTokenSession('hash', f.owner), error => error.status === 503 && error.cause === null);
  assert.deepEqual(f.releases, [true]); assert.deepEqual(f.closes, [{ force: true }]);
});

test('only unfinished response close cancels request-owned session reads and all listeners retire', async () => {
  for (const finished of [false, true]) {
    const response = Object.assign(new EventEmitter(), { writableFinished: finished });
    let observed;
    const result = await readRequestSessionRow({ res: response }, 'hash', async (_hash, { signal }) => {
      response.emit('close'); observed = signal.aborted; return null;
    });
    assert.equal(result, null); assert.equal(observed, !finished); assert.equal(response.listenerCount('close'), 0);
  }
});

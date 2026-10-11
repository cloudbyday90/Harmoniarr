/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabasePoolLifecycle } from '../../src/server/database-pool-lifecycle.js';

test('pool lifecycle validates construction and creates one lazy shared generation', async () => {
  assert.throws(() => createDatabasePoolLifecycle(), TypeError);
  let creates = 0;
  const pool = { end: async () => {} };
  const lifecycle = createDatabasePoolLifecycle({ createPool: () => { creates += 1; return pool; } });
  await lifecycle.closePool();
  assert.equal(creates, 0);
  assert.strictEqual(lifecycle.getPool(), pool);
  assert.strictEqual(lifecycle.getPool(), pool);
  assert.equal(creates, 1);
  await lifecycle.closePool();
});

test('failed construction preserves its error and permits an explicit later attempt', async () => {
  const failure = new Error('construction failure');
  let creates = 0;
  const pool = { end: async () => {} };
  const lifecycle = createDatabasePoolLifecycle({ createPool: () => {
    creates += 1;
    if (creates === 1) throw failure;
    return pool;
  } });
  assert.throws(() => lifecycle.getPool(), error => error === failure);
  await lifecycle.closePool();
  assert.strictEqual(lifecycle.getPool(), pool);
  await lifecycle.closePool();
});

test('pending close fences synchronous access and shares native completion across callers', async () => {
  const gate = Promise.withResolvers();
  const pools = [];
  const states = [];
  let ends = 0;
  const lifecycle = createDatabasePoolLifecycle({ createPool: ({ runtimeState }) => {
    states.push(runtimeState);
    const pool = { end: () => { ends += 1; return gate.promise; } };
    pools.push(pool);
    return pool;
  } });
  const original = lifecycle.getPool();
  const closing = lifecycle.closePool();
  try {
    assert.equal(states[0].closing, true);
    assert.throws(() => lifecycle.getPool(), { code: 'database_pool_closing' });
    assert.strictEqual(lifecycle.closePool(), closing);
    assert.equal(ends, 1);
    assert.equal(pools.length, 1);
  } finally { gate.resolve(); await closing; }
  const restarted = lifecycle.getPool();
  assert.notStrictEqual(restarted, original);
  assert.equal(states[1].closing, false);
  await lifecycle.closePool();
  assert.equal(ends, 2);
});

test('end sees the admission fence and its own shared close promise during reentrancy', async () => {
  let reentrant;
  let lifecycle;
  lifecycle = createDatabasePoolLifecycle({ createPool: () => ({ end() {
    assert.throws(() => lifecycle.getPool(), { code: 'database_pool_closing' });
    reentrant = lifecycle.closePool();
    return Promise.resolve();
  } }) });
  lifecycle.getPool();
  const closing = lifecycle.closePool();
  assert.strictEqual(reentrant, closing);
  await closing;
});

for (const failure of [new Error('native end failure'), null]) {
  test(`rejected end preserves ${failure === null ? 'null' : 'Error'} and refuses a replacement generation`, async () => {
    const gate = Promise.withResolvers();
    let creates = 0;
    let ends = 0;
    const lifecycle = createDatabasePoolLifecycle({ createPool: () => {
      creates += 1;
      return { end: () => { ends += 1; return gate.promise; } };
    } });
    lifecycle.getPool();
    const closing = lifecycle.closePool();
    const observed = assert.rejects(closing, error => error === failure);
    gate.reject(failure);
    await observed;
    assert.strictEqual(lifecycle.closePool(), closing);
    await assert.rejects(lifecycle.closePool(), error => error === failure);
    assert.throws(() => lifecycle.getPool(), { code: 'database_pool_closing' });
    assert.equal(creates, 1);
    assert.equal(ends, 1);
  });
}

test('synchronous end failure remains an asynchronous shared rejection', async () => {
  const failure = new Error('synchronous failure');
  const lifecycle = createDatabasePoolLifecycle({ createPool: () => ({ end() { throw failure; } }) });
  lifecycle.getPool();
  const closing = lifecycle.closePool();
  await assert.rejects(closing, error => error === failure);
  assert.strictEqual(lifecycle.closePool(), closing);
  assert.throws(() => lifecycle.getPool(), { code: 'database_pool_closing' });
});

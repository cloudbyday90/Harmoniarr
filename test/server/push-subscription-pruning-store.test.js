/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createPushSubscriptionPruningStore } from '../../src/server/push/push-subscription-pruning-store.js';

const row = { id: '11111111-1111-4111-8111-111111111111', registration_token: '22222222-2222-4222-8222-222222222222',
  invalidated_at: '2026-07-01 12:00:00.123456+00', older_than: '2026-08-01 12:00:00.654321+00' };
function fixture({ selected = [row], failAt, failRollback = false, commit = async () => {} } = {}) {
  const calls = [], released = [];
  const store = createPushSubscriptionPruningStore({ getPoolFn: () => ({ connect: async () => ({
    query: async (sql, values) => {
      calls.push({ sql, values });
      const kind = sql.startsWith('BEGIN') ? 'begin' : sql === 'COMMIT' ? 'commit' : sql === 'ROLLBACK' ? 'rollback'
        : sql.startsWith('DELETE') ? 'delete' : 'select';
      if (kind === failAt || (kind === 'rollback' && failRollback)) throw new Error('private endpoint and credentials');
      if (kind === 'select') return { rows: selected };
      if (kind === 'delete') return { rowCount: selected.length };
      if (kind === 'commit') await commit();
      return {};
    }, release: (discard) => released.push(discard),
  }) }) });
  return { store, calls, released };
}

test('invalid pruning limits do not acquire a pooled client', async () => {
  const store = createPushSubscriptionPruningStore({ getPoolFn: () => assert.fail('Invalid limit must not acquire a client') });
  for (const limit of [0, -1, 1.5, 501, Infinity, '500', null]) await assert.rejects(store.pruneInvalidatedSubscriptions({ limit }), RangeError);
});

test('pruning preserves timestamp precision and reports success only after commit', async () => {
  let finishCommit;
  let committed = false;
  const blocked = new Promise((resolve) => { finishCommit = resolve; });
  const context = fixture({ commit: () => blocked });
  const result = context.store.pruneInvalidatedSubscriptions().then((value) => { committed = true; return value; });
  await setImmediate();
  assert.equal(committed, false);
  assert.deepEqual(context.released, []);
  assert.equal(context.calls[0].sql, 'BEGIN ISOLATION LEVEL READ COMMITTED');
  assert.deepEqual(context.calls[1].values, [2592000000, 500]);
  assert.deepEqual(context.calls[2].values, [[row.id], [row.registration_token], [row.invalidated_at], row.older_than]);
  finishCommit();
  assert.deepEqual(await result, { deletedCount: 1 });
  assert.deepEqual(context.released, [false]);
});

test('empty pruning commits without issuing a delete', async () => {
  const context = fixture({ selected: [] });
  assert.deepEqual(await context.store.pruneInvalidatedSubscriptions(), { deletedCount: 0 });
  assert.equal(context.calls.length, 3);
  assert.equal(context.calls.at(-1).sql, 'COMMIT');
  assert.deepEqual(context.released, [false]);
});

test('failed pruning rolls back when possible and discards the client without leaking diagnostics', async () => {
  for (const failAt of ['begin', 'select', 'delete', 'commit']) {
    for (const failRollback of [false, true]) {
      const context = fixture({ failAt, failRollback });
      await assert.rejects(context.store.pruneInvalidatedSubscriptions(), { message: 'Invalidated subscription pruning failed' });
      assert.equal(context.calls.some(({ sql }) => sql === 'ROLLBACK'), failAt !== 'begin');
      assert.deepEqual(context.released, [true]);
    }
  }
});

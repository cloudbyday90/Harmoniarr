/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';

function fixture() {
  const order = [];
  const released = [];
  const client = { query: async (sql) => { order.push(sql); }, release: (discard) => { released.push(discard); order.push('release'); } };
  return { client, order, released, pool: { connect: async () => client } };
}
test('lock-holder rollback and checked-out release precede observed completion', async () => {
  const f = fixture(); const result = await withRollbackFixtureClient(f.pool, async (client) => {
    assert.equal(client, f.client); f.order.push('held work'); return 42;
  });
  f.order.push('closed'); assert.equal(result, 42);
  assert.deepEqual(f.order, ['BEGIN', 'held work', 'ROLLBACK', 'release', 'closed']);
  assert.deepEqual(f.released, [false]);
});
test('rollback failure still releases the client and cannot replace an Error or null primary', async () => {
  for (const reason of [new Error('Controlled holder failure'), null]) {
    const f = fixture(); f.client.query = async (sql) => { f.order.push(sql); if (sql === 'ROLLBACK') throw new Error('Secondary rollback'); };
    await withRollbackFixtureClient(f.pool, async () => { throw reason; })
      .then(() => assert.fail('Primary holder failure was lost'), (error) => assert.equal(error, reason));
    assert.deepEqual(f.order, ['BEGIN', 'ROLLBACK', 'release']);
    assert.deepEqual(f.released, [true]);
  }
});
test('failed BEGIN releases its client, while rollback failure after successful work remains a failure', async () => {
  const failure = new Error('Controlled SQL failure'); const begin = fixture();
  begin.client.query = async () => { throw failure; };
  await assert.rejects(withRollbackFixtureClient(begin.pool, () => assert.fail('Unstarted transaction used')), (error) => error === failure);
  assert.deepEqual(begin.order, ['release']);
  assert.deepEqual(begin.released, [true]);
  const rollback = fixture(); rollback.client.query = async (sql) => { if (sql === 'ROLLBACK') throw failure; };
  await assert.rejects(withRollbackFixtureClient(rollback.pool, () => 42), (error) => error === failure);
  assert.deepEqual(rollback.order, ['release']);
  assert.deepEqual(rollback.released, [true]);
});

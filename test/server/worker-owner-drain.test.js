/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { drainWorkerOwners } from '../../src/server/worker-owner-drain.js';

for (const primary of [new Error('first owner'), null]) {
  test(`ordered drain snapshots owners and retains first ${primary === null ? 'null' : 'Error'} after all settle`, async () => {
    const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); const calls = [];
    const first = { close() { assert.equal(this, first); calls.push('first'); entered.resolve(); return gate.promise; } };
    const second = { close() { assert.equal(this, second); calls.push('second'); throw new Error('second'); } };
    const third = { close() { assert.equal(this, third); calls.push('third'); return Promise.reject(new Error('third')); } };
    const source = [first, null, {}, second, third]; const pending = drainWorkerOwners(source); void pending.catch(() => {});
    await entered.promise; source.splice(0, source.length); assert.deepEqual(calls, ['first']);
    gate.reject(primary); await assert.rejects(pending, error => error === primary);
    assert.deepEqual(calls, ['first', 'second', 'third']);
  });
}

test('ordered drain handles empty owners and waits for successful last cleanup', async () => {
  await drainWorkerOwners([]); const gate = Promise.withResolvers(); let settled = false;
  const pending = drainWorkerOwners([undefined, { close: () => gate.promise }]); void pending.then(() => { settled = true; });
  try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); }
  finally { gate.resolve(); await pending; }
});

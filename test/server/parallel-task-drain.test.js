/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runParallelTasksAndDrain } from '../../src/server/parallel-task-drain.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
test('parallel drainage preserves ordered values and starts independent work together', async () => {
  const first = Promise.withResolvers(); const second = Promise.withResolvers(); const calls = [];
  const pending = runParallelTasksAndDrain([() => { calls.push(1); return first.promise; }, () => { calls.push(2); return second.promise; }]);
  await flush(); assert.deepEqual(calls, [1, 2]); second.resolve('second'); first.resolve('first');
  assert.deepEqual(await pending, ['first', 'second']); assert.deepEqual(await runParallelTasksAndDrain([]), []);
});
for (const primary of [new Error('first observed'), null]) {
  test(`first observed ${primary === null ? 'null' : 'Error'} wins over an earlier-index later failure after both drain`, async () => {
    const gate = Promise.withResolvers(); let settled = false; let drained = false;
    const pending = runParallelTasksAndDrain([async () => { await gate.promise; drained = true; throw new Error('later'); }, () => { throw primary; }]);
    void pending.then(() => { settled = true; }, () => { settled = true; });
    try { await flush(); assert.equal(settled, false); assert.equal(drained, false); }
    finally { gate.resolve(); }
    await assert.rejects(pending, error => error === primary); assert.equal(drained, true);
  });
  test(`synchronous ${primary === null ? 'null' : 'Error'} still admits and drains later callbacks`, async () => {
    const gate = Promise.withResolvers(); let started = false; let settled = false;
    const pending = runParallelTasksAndDrain([() => { throw primary; }, async () => { started = true; await gate.promise; }]);
    void pending.then(() => { settled = true; }, () => { settled = true; });
    try { await flush(); assert.equal(started, true); assert.equal(settled, false); }
    finally { gate.resolve(); }
    await assert.rejects(pending, error => error === primary);
  });
}

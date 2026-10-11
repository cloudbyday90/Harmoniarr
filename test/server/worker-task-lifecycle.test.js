/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerTaskLifecycle } from '../../src/server/worker-task-lifecycle.js';

test('worker completion is registered before launch, coalesces duplicates and seals admission before drain', async () => {
  const callbacks = [];
  let runs = 0;
  const tasks = createWorkerTaskLifecycle({ execute: async input => { runs += 1; return input.value; },
    schedule: callback => { callbacks.push(callback); } });
  const pending = tasks.start({ runId: 'one', value: 42 });
  assert.strictEqual(tasks.start({ runId: 'one' }), pending);
  const closing = tasks.close();
  assert.strictEqual(tasks.close(), closing);
  assert.throws(() => tasks.start({ runId: 'late' }), { code: 'worker_closing' });
  assert.equal(runs, 0);
  callbacks[0](); callbacks[0]();
  assert.equal(await pending, 42);
  await closing;
  assert.equal(runs, 1);
  assert.throws(() => tasks.start({ runId: 'one' }), { code: 'worker_closing' });
});

for (const error of [new Error('escaped execution failure'), null]) {
  test(`worker drain waits for siblings and retains an escaped ${error === null ? 'null' : 'Error'}`, async () => {
    const gate = Promise.withResolvers();
    let closed = false;
    const tasks = createWorkerTaskLifecycle({ execute: async input => {
      if (input.runId === 'failed') throw error;
      await gate.promise;
    } });
    const failed = tasks.start({ runId: 'failed' });
    const held = tasks.start({ runId: 'held' });
    const closing = tasks.close();
    void closing.then(() => { closed = true; }, () => { closed = true; });
    try {
      await assert.rejects(failed, failure => failure === error);
      assert.equal(closed, false);
    } finally { gate.resolve(); await held; }
    await assert.rejects(closing, failure => failure === error);
    assert.strictEqual(tasks.close(), closing);
  });
}

test('a scheduler that queues then throws settles registration and never launches orphan work', async () => {
  const failure = new Error('scheduler failed');
  let callback;
  let runs = 0;
  const tasks = createWorkerTaskLifecycle({ execute: () => { runs += 1; }, schedule: run => {
    callback = run;
    throw failure;
  } });
  assert.throws(() => tasks.start({ runId: 'not-started' }), error => error === failure);
  callback();
  await assert.rejects(tasks.close(), error => error === failure);
  assert.equal(runs, 0);
});

test('a reentrant scheduler that invokes then throws also prevents deferred execution', async () => {
  const failure = new Error('reentrant scheduling failure');
  let runs = 0;
  const tasks = createWorkerTaskLifecycle({ execute: () => { runs += 1; }, schedule: run => {
    run(); throw failure;
  } });
  assert.throws(() => tasks.start({ runId: 'not-started' }), error => error === failure);
  await assert.rejects(tasks.close(), error => error === failure);
  assert.equal(runs, 0);
});

test('cooperative cancellation must actually settle admitted work before close completes', async () => {
  const controller = new AbortController();
  const ready = Promise.withResolvers();
  let released = false;
  const tasks = createWorkerTaskLifecycle({ execute: async () => {
    try {
      await new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
        ready.resolve();
      });
    } finally { released = true; }
  } });
  tasks.start({ runId: 'cancelled' });
  const closing = tasks.close();
  await ready.promise;
  assert.equal(released, false);
  controller.abort(null);
  await assert.rejects(closing, error => error === null);
  assert.equal(released, true);
});

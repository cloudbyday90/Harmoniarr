/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createOperationQueueDispatcher } from '../../src/server/operation-queue-dispatcher.js';
import { createStartupServiceSupervisor } from '../../src/server/startup-service-supervisor.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const timer = ({ onTick }) => ({ start() {}, stop() {}, tick: onTick });

test('supervised shutdown waits for a held claim and its returned worker completion without another claim', async () => {
  const claimEntered = Promise.withResolvers(); const claim = Promise.withResolvers();
  const worker = Promise.withResolvers(); let claims = 0; let handled = 0; let finished = false;
  const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
    handlers: { library_scan: async () => { handled++; return { completion: worker.promise }; } },
    operationQueueStore: { claimNextRunnableRun: async () => { if (++claims > 1) return null; claimEntered.resolve(); return claim.promise; } } });
  const supervisor = createStartupServiceSupervisor({ processEmitter: new EventEmitter() });
  supervisor.registerService(dispatcher);
  const tick = dispatcher.tick(); await claimEntered.promise;
  const shutdown = supervisor.stopAll().then(() => { finished = true; });
  try {
    await flush(); assert.equal(finished, false);
    claim.resolve({ id: 'held-run', operationType: 'library_scan' });
    await tick; await flush();
    assert.equal(handled, 1); assert.equal(claims, 1); assert.equal(finished, false);
    worker.resolve(); await shutdown;
    assert.equal(finished, true);
  } finally {
    claim.resolve({ id: 'held-run', operationType: 'library_scan' }); worker.resolve();
    await tick.catch(() => {}); await shutdown.catch(() => {});
  }
});

test('closure during readiness or recovery refuses the next phase and preserves ordinary pause/restart', async () => {
  for (const phase of ['readiness', 'recovery']) {
    const entered = Promise.withResolvers(); const held = Promise.withResolvers(); let claims = 0; let recovery = 0;
    const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
      dispatchPauseService: { resolveDispatchReadiness: async () => {
        if (phase === 'readiness') { entered.resolve(); await held.promise; } return { allowed: true };
      } },
      operationStrandedRunRecoveryService: { recoverStrandedRuns: async () => { recovery++;
        if (phase === 'recovery') { entered.resolve(); await held.promise; } return {};
      } },
      operationQueueStore: { claimNextRunnableRun: async () => { claims++; return null; } } });
    const tick = dispatcher.tick(); await entered.promise;
    const closing = dispatcher.stopAndDrain(); assert.equal(dispatcher.stopAndDrain(), closing);
    assert.throws(() => dispatcher.start(), { code: 'dispatcher_closing' });
    assert.deepEqual(await dispatcher.tick(), { reason: 'stopped', skipped: true });
    held.resolve(); await tick; await closing;
    assert.equal(claims, 0); assert.equal(recovery, phase === 'recovery' ? 1 : 0);
  }
  let starts = 0; let claims = 0;
  const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
    start: () => { starts++; }, stop() {}, tick: onTick }),
    operationQueueStore: { claimNextRunnableRun: async () => { claims++; return null; } } });
  dispatcher.start(); await dispatcher.stop(); dispatcher.start(); await dispatcher.tick();
  assert.equal(starts, 2); assert.equal(claims, 1); await dispatcher.stopAndDrain();
});

for (const primary of [new Error('owned failure'), null]) {
  test(`failed handler drains its sibling and retains original ${primary === null ? 'null' : 'Error'} over reporter fallout`, async () => {
    const sibling = Promise.withResolvers(); const first = Promise.withResolvers(); let claims = 0; let finished = false;
    const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
      handlers: { first: async () => ({ completion: first.promise }), second: async () => ({ completion: sibling.promise }) },
      onError: async error => { assert.equal(error, primary); throw new Error('reporter'); },
      operationQueueStore: { claimNextRunnableRun: async () => ++claims <= 2 ? { id: String(claims), operationType: claims === 1 ? 'first' : 'second' } : null } });
    await dispatcher.tick();
    const closing = dispatcher.stopAndDrain(); void closing.then(() => { finished = true; }, () => { finished = true; });
    first.reject(primary); await flush(); assert.equal(finished, false);
    sibling.resolve(); await assert.rejects(closing, error => error === primary); assert.equal(finished, true);
  });
  test(`explicit tick exposes ${primary === null ? 'null' : 'Error'} while the automatic callback observes and retains it`, async () => {
    let automatic;
    const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: ({ onTick }) => {
      automatic = onTick; return { start() {}, stop() {}, tick: onTick };
    }, operationQueueStore: { claimNextRunnableRun: async () => { throw primary; } }, onError: async () => { throw new Error('reporter'); } });
    await assert.rejects(dispatcher.tick(), error => error === primary);
    assert.deepEqual(await automatic(), { reason: 'error', skipped: true });
    await assert.rejects(dispatcher.stopAndDrain(), error => error === primary);
  });
}

test('timer-stop rejection and reentrant close still drain an admitted handler', async () => {
  const handled = Promise.withResolvers(); const worker = Promise.withResolvers(); let claim = 0; let reentrant; let dispatcher;
  dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: () => ({
    start() {}, stop() { reentrant = dispatcher.stopAndDrain(); return Promise.reject(null); } }),
    handlers: { work: async () => { handled.resolve(); return { completion: worker.promise }; } },
    operationQueueStore: { claimNextRunnableRun: async () => ++claim === 1 ? { id: 'run', operationType: 'work' } : null } });
  await dispatcher.tick(); await handled.promise;
  let finished = false; const closing = dispatcher.stopAndDrain();
  void closing.then(() => { finished = true; }, () => { finished = true; });
  assert.equal(reentrant, closing); await flush(); assert.equal(finished, false);
  worker.resolve(); await assert.rejects(closing, error => error === null);
});

test('overlapping explicit ticks are refused before a second readiness call', async () => {
  const held = Promise.withResolvers(); const entered = Promise.withResolvers(); let readiness = 0;
  const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
    dispatchPauseService: { resolveDispatchReadiness: async () => { readiness++; entered.resolve(); await held.promise; return { allowed: true }; } },
    operationQueueStore: { claimNextRunnableRun: async () => null } });
  const active = dispatcher.tick(); await entered.promise;
  assert.deepEqual(await dispatcher.tick(), { reason: 'tick_in_progress', skipped: true }); assert.equal(readiness, 1);
  held.resolve(); await active; await dispatcher.stopAndDrain();
});

test('a failed tick still drains a handler launched by its earlier committed claim', async () => {
  const worker = Promise.withResolvers(); let claims = 0;
  const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
    handlers: { work: async () => ({ completion: worker.promise }) },
    operationQueueStore: { claimNextRunnableRun: async () => { if (++claims === 1) return { id: 'first', operationType: 'work' }; throw null; } } });
  await assert.rejects(dispatcher.tick(), error => error === null);
  let settled = false; const closing = dispatcher.stopAndDrain();
  void closing.then(() => { settled = true; }, () => { settled = true; });
  await flush(); assert.equal(settled, false);
  worker.resolve(); await assert.rejects(closing, error => error === null);
});

test('an invalid completion acknowledgement fails closed rather than certifying worker completion', async () => {
  let claims = 0;
  const dispatcher = createOperationQueueDispatcher({ createIntervalHeartbeatRunnerFn: timer,
    handlers: { work: async () => ({ completion: 42 }) },
    operationQueueStore: { claimNextRunnableRun: async () => ++claims === 1 ? { id: 'run', operationType: 'work' } : null } });
  await dispatcher.tick();
  await assert.rejects(dispatcher.stopAndDrain(), TypeError);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { withOperationRunInterruption } from '../../src/server/worker-interruption-scope.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });

test('step polling serializes reads and drains an admitted read before the fresh handoff check', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const query = Promise.withResolvers(); const entered = Promise.withResolvers(); const work = Promise.withResolvers();
  let active = 0; let peak = 0; let checks = 0; let settled = false;
  const task = withOperationRunInterruption({ runId: 'owned', isCancellationRequested: async () => {
    checks++; active++; peak = Math.max(peak, active); entered.resolve(); await query.promise; active--; return false;
  } }, async signal => { assert.equal(signal.aborted, false); return work.promise; });
  void task.then(() => { settled = true; }); t.mock.timers.tick(1000); await entered.promise;
  t.mock.timers.tick(5000); assert.equal(checks, 1); work.resolve('result'); await flush(); assert.equal(settled, false);
  query.resolve(); assert.equal(await task, 'result'); assert.equal(peak, 1); assert.equal(checks, 2);
  t.mock.timers.tick(20_000); assert.equal(checks, 2);
});

for (const interruption of [true, { kind: 'paused', pauseCode: 'maintenance', nextRetryAt: '2026-10-23T14:00:00Z' }]) {
  test(`step ${interruption === true ? 'cancellation' : 'pause'} retains owned work through actual settlement`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); const work = Promise.withResolvers(); let signal; let settled = false;
    const task = withOperationRunInterruption({ runId: 'owned', isCancellationRequested: async () => interruption },
      async supplied => { signal = supplied; return work.promise; });
    const refused = assert.rejects(task, error => error === signal.reason && error.code === (interruption === true ? 'operation_run_cancelled' : 'operation_run_paused'));
    void task.then(() => { settled = true; }, () => { settled = true; });
    t.mock.timers.tick(1000); await flush(); assert.equal(signal.aborted, true); assert.equal(settled, false);
    work.resolve(); await refused;
  });
}

for (const failure of [new Error('original check'), null]) {
  test(`step polling preserves ${failure === null ? 'null' : 'Error'} and still drains the operation`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); const work = Promise.withResolvers(); let signal;
    const task = withOperationRunInterruption({ runId: 'owned', isCancellationRequested: async () => { throw failure; } },
      async supplied => { signal = supplied; return work.promise; });
    const refused = assert.rejects(task, error => error === failure); t.mock.timers.tick(1000); await flush();
    assert.equal(signal.reason, failure); work.reject(new Error('later abort adapter')); await refused;
  });
}

test('callback failure wins over a later pending-read failure and no late timer remains', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const query = Promise.withResolvers(); const work = Promise.withResolvers();
  const original = new Error('work'); let checks = 0;
  const task = withOperationRunInterruption({ runId: 'owned', isCancellationRequested: async () => { checks++; return query.promise; } }, () => work.promise);
  const refused = assert.rejects(task, error => error === original); t.mock.timers.tick(1000); work.reject(original); await flush();
  query.reject(null); await refused; t.mock.timers.tick(20_000); assert.equal(checks, 1);
});

test('a final durable check refuses late cancellation and missing checkers allocate no timer', async () => {
  await assert.rejects(withOperationRunInterruption({ runId: 'owned', isCancellationRequested: async () => true }, async () => 'unpublished'), { code: 'operation_run_cancelled' });
  assert.equal(await withOperationRunInterruption({ runId: 'fixture', setTimeoutFn: () => assert.fail('No checker, no poll') },
    async signal => { assert.equal(signal, undefined); return 'done'; }), 'done');
});

for (const reason of [new Error('lease lost'), null]) {
  test(`pre-aborted lease signal refuses dispatch with original ${reason === null ? 'null' : 'Error'}`, async () => {
    const controller = new AbortController(); controller.abort(reason);
    await assert.rejects(withOperationRunInterruption({ signal: controller.signal, setTimeoutFn: () => assert.fail('No timer') },
      () => assert.fail('No dispatch')), error => error === reason);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });
}

test('signal-only interruption drains callback, preserves first failure and removes its listener', async () => {
  const controller = new AbortController(); const work = Promise.withResolvers(); const original = new Error('lost'); let supplied; let settled = false;
  const task = withOperationRunInterruption({ signal: controller.signal, setTimeoutFn: () => assert.fail('No durable checker, no timer') },
    signal => { supplied = signal; return work.promise; });
  const refused = assert.rejects(task, error => error === original); void task.then(() => { settled = true; }, () => { settled = true; });
  controller.abort(original); await flush(); assert.equal(supplied.reason, original); assert.equal(settled, false);
  work.reject(null); await refused; assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  const normal = new AbortController();
  assert.equal(await withOperationRunInterruption({ signal: normal.signal }, async () => 'done'), 'done');
  assert.equal(getEventListeners(normal.signal, 'abort').length, 0);
});

test('lease interruption drains an admitted durable read and does not start a handoff read', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const controller = new AbortController(); const read = Promise.withResolvers(); const work = Promise.withResolvers();
  let checks = 0; let settled = false;
  const task = withOperationRunInterruption({ signal: controller.signal, isCancellationRequested: async () => { checks++; return read.promise; } }, () => work.promise);
  const refused = assert.rejects(task, error => error === null); void task.then(() => { settled = true; }, () => { settled = true; });
  t.mock.timers.tick(1000); controller.abort(null); work.resolve(); await flush(); assert.equal(settled, false);
  read.reject(new Error('later read')); await refused; t.mock.timers.tick(5000); assert.equal(checks, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

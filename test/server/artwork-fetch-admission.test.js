import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { createArtworkFetchAdmission, isArtworkAdmissionError } from '../../src/server/artwork/artwork-fetch-admission.js';

test('artwork admission holds FIFO slots through actual success and Error/null settlement', async () => {
  const gate = createArtworkFetchAdmission({ concurrency: 1 });
  const held = Promise.withResolvers(); const order = [];
  const first = gate.run(async () => { order.push(1); await held.promise; return 'first'; });
  const failure = new Error('owned failure');
  const second = gate.run(() => { order.push(2); throw failure; });
  const secondCheck = assert.rejects(second, error => error === failure);
  const third = gate.run(() => { order.push(3); throw null; });
  const thirdCheck = assert.rejects(third, error => error === null);
  const last = gate.run(() => { order.push(4); return 'last'; });
  assert.deepEqual(gate.getState(), { active: 1, queued: 3 });
  assert.deepEqual(order, [1]);
  held.resolve();
  assert.equal(await first, 'first'); await secondCheck; await thirdCheck;
  assert.equal(await last, 'last');
  assert.deepEqual(order, [1, 2, 3, 4]);
  assert.deepEqual(gate.getState(), { active: 0, queued: 0 });
});

test('artwork admission bounds waiting work and rejects overflow without dispatch', async () => {
  const gate = createArtworkFetchAdmission({ concurrency: 1, maxQueued: 1 });
  const held = Promise.withResolvers();
  const first = gate.run(() => held.promise);
  const next = gate.run(() => 'next'); let overflow = false;
  await assert.rejects(gate.run(() => { overflow = true; }), error => {
    assert.equal(error.status, 503); assert.equal(error.code, 'artwork_fetch_capacity');
    assert.equal(isArtworkAdmissionError(error), true); return true;
  });
  assert.equal(overflow, false); assert.deepEqual(gate.getState(), { active: 1, queued: 1 });
  held.resolve(); await first; assert.equal(await next, 'next');
});

test('queued cancellation removes timer/listener without releasing an active slot or admitting late work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = createArtworkFetchAdmission({ concurrency: 1 }); const held = Promise.withResolvers();
  const activeController = new AbortController();
  const active = gate.run(() => held.promise, { signal: activeController.signal });
  const controller = new AbortController(); let dispatched = false;
  const pending = gate.run(() => { dispatched = true; }, { signal: controller.signal });
  const check = assert.rejects(pending, { code: 'artwork_fetch_cancelled' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
  controller.abort(new Error('PRIVATE-cancellation-reason')); await check;
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  activeController.abort();
  assert.deepEqual(gate.getState(), { active: 1, queued: 0 });
  t.mock.timers.tick(15000); held.resolve(); await active;
  assert.equal(dispatched, false); assert.deepEqual(gate.getState(), { active: 0, queued: 0 });
});

test('queued timeout and overdue handoff refuse before task dispatch', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let clock = 0;
  const gate = createArtworkFetchAdmission({ concurrency: 1, queueTimeoutMs: 10, now: () => clock });
  const held = Promise.withResolvers(); const first = gate.run(() => held.promise); let dispatched = 0;
  const controller = new AbortController();
  const timed = gate.run(() => { dispatched++; }, { signal: controller.signal });
  const timedCheck = assert.rejects(timed, { code: 'artwork_fetch_capacity' });
  t.mock.timers.tick(10); await timedCheck;
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  const overdue = gate.run(() => { dispatched++; });
  const overdueCheck = assert.rejects(overdue, { code: 'artwork_fetch_capacity' });
  clock = 11; held.resolve(); await first; await overdueCheck;
  assert.equal(dispatched, 0); assert.equal(await gate.run(() => 'healthy'), 'healthy');
});

test('pre-cancelled work and invalid policies are refused without retaining custom diagnostics', async () => {
  const gate = createArtworkFetchAdmission(); const reason = new Error('PRIVATE');
  await assert.rejects(gate.run(() => assert.fail(), { signal: AbortSignal.abort(reason) }), error => {
    assert.equal(error.code, 'artwork_fetch_cancelled'); assert.equal(error.message.includes('PRIVATE'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false); return true;
  });
  for (const policy of [{ concurrency: 0 }, { concurrency: 9 }, { maxQueued: -1 }, { maxQueued: 257 },
    { queueTimeoutMs: 0 }, { queueTimeoutMs: 60001 }]) assert.throws(() => createArtworkFetchAdmission(policy), TypeError);
  assert.equal(isArtworkAdmissionError(Object.assign(new Error(), { code: 'artwork_fetch_capacity' })), false);
  await assert.rejects(gate.run(null), TypeError);
  await assert.rejects(gate.run(() => {}, { signal: {} }), TypeError);
});

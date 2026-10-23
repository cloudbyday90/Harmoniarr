import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkAdmission, isWorkAdmissionError } from '../../src/server/work-admission.js';

function gate() {
  return createWorkAdmission({ concurrency: 2, maxQueued: 4, queueTimeoutMs: 1000, maxActiveWeight: 10,
    makeError: reason => Object.assign(new Error('fixed'), { code: reason }) });
}

test('active reservations shrink in the same FIFO and remain held through original settlement', async () => {
  const admission = gate(); const held = Promise.withResolvers(); const secondHeld = Promise.withResolvers();
  let firstPermit; let secondStarted = false; let thirdStarted = false;
  const first = admission.run(permit => { firstPermit = permit; return held.promise; }, { activeWeight: 8 });
  const second = admission.run(() => { secondStarted = true; return secondHeld.promise; }, { activeWeight: 4 });
  const third = admission.run(() => { thirdStarted = true; }, { activeWeight: 1 });
  try {
    assert.equal(secondStarted, false); assert.equal(thirdStarted, false);
    firstPermit.shrinkTo(6); assert.equal(secondStarted, true); assert.equal(thirdStarted, false);
    assert.equal(admission.getState().activeWeight, 10);
    secondHeld.resolve(); await second; assert.equal(thirdStarted, true); await third;
    assert.equal(admission.getState().activeWeight, 6);
  } finally { held.resolve(); secondHeld.resolve(); await Promise.allSettled([first, second, third]); }
  assert.deepEqual(admission.getState(), { active: 0, queued: 0, queuedWeight: 0, activeWeight: 0 });
  assert.throws(() => firstPermit.shrinkTo(0), TypeError);
});

test('cancelling a memory-blocked FIFO head immediately hands off a fitting follower', async () => {
  const admission = gate(); const held = Promise.withResolvers();
  const active = admission.run(() => held.promise, { activeWeight: 8 }); const controller = new AbortController(); let started = false;
  const head = admission.run(() => assert.fail('cancelled head'), { activeWeight: 4, signal: controller.signal });
  const rejected = assert.rejects(head, error => isWorkAdmissionError(error) && error.code === 'cancelled');
  const follower = admission.run(() => { started = true; }, { activeWeight: 1 });
  try { assert.equal(started, false); controller.abort(); await rejected; await follower; assert.equal(started, true); }
  finally { held.resolve(); await Promise.allSettled([active, head, follower]); }
});

test('reservation reductions refuse expansion or invalid weights and release after original Error/null', async () => {
  const admission = gate();
  for (const original of [new Error('owned'), null]) {
    await assert.rejects(admission.run(permit => {
      for (const value of [-1, 9, 1.5, Infinity]) assert.throws(() => permit.shrinkTo(value), TypeError);
      permit.shrinkTo(4); throw original;
    }, { activeWeight: 8 }), error => error === original);
    assert.equal(admission.getState().activeWeight, 0);
  }
  await assert.rejects(admission.run(() => assert.fail(), { activeWeight: 11 }), error => isWorkAdmissionError(error) && error.code === 'capacity');
});

test('expired memory waiters never acquire weight and active abort does not release the original task', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const admission = gate(); const controller = new AbortController();
  const held = Promise.withResolvers(); const active = admission.run(() => held.promise, { activeWeight: 8, signal: controller.signal });
  const waiting = admission.run(() => assert.fail('expired waiter'), { activeWeight: 4 }); const rejected = assert.rejects(waiting, { code: 'capacity' });
  controller.abort(); assert.equal(admission.getState().activeWeight, 8);
  t.mock.timers.tick(1000); await rejected; assert.equal(admission.getState().activeWeight, 8);
  held.resolve(); await active; assert.equal(admission.getState().activeWeight, 0);
});

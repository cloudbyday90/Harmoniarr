/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureGate, createFixtureWorkerObserver, waitForFixtureReady, withFixtureLifecycle }
  from '../../testing/integration/fixture-lifecycle.js';

const tick = () => new Promise((done) => { setImmediate(done); });

test('readiness surfaces the original operation rejection instead of waiting for an unreachable checkpoint', async () => {
  const ready = createFixtureGate(); const failure = new Error('Controlled operation failure');
  await assert.rejects(waitForFixtureReady({ ready: ready.promise, operation: Promise.reject(failure) }), (error) => error === failure);
});

test('a successful operation ending before readiness is an explicit fixture error', async () => {
  const ready = createFixtureGate();
  await assert.rejects(waitForFixtureReady({ ready: ready.promise, operation: Promise.resolve() }),
    { code: 'fixture_operation_completed_before_ready' });
});

test('genuine readiness can precede still-active work without discarding its later result', async () => {
  const ready = createFixtureGate(); const work = createFixtureGate();
  ready.release('checkpoint');
  assert.equal(await waitForFixtureReady({ ready: ready.promise, operation: work.promise }), 'checkpoint');
  work.release(7); assert.equal(await work.promise, 7);
});

test('cancellation rejects controlled gates with the original reason and settlement is idempotent', async () => {
  const controller = new AbortController(); const gate = createFixtureGate({ signal: controller.signal });
  const reason = new Error('Controlled cancellation'); controller.abort(reason);
  await assert.rejects(gate.promise, (error) => error === reason);
  assert.equal(gate.release(), false); assert.equal(gate.abort(new Error('Late abort')), false);
  const settled = createFixtureGate({ signal: controller.signal });
  await assert.rejects(settled.promise, (error) => error === reason);
});

test('a released gate remains resolved when its former signal is later cancelled', async () => {
  const controller = new AbortController(); const gate = createFixtureGate({ signal: controller.signal });
  assert.equal(gate.release(4), true); controller.abort(new Error('Late cancellation'));
  assert.equal(await gate.promise, 4); assert.equal(gate.release(5), false);
});

test('an explicit null cancellation reason remains null through gates, readiness and lifecycle', async () => {
  const controller = new AbortController(); controller.abort(null);
  const gate = createFixtureGate({ signal: controller.signal });
  await gate.promise.then(() => assert.fail('Cancelled gate resolved'), (reason) => assert.equal(reason, null));
  await waitForFixtureReady({ ready: createFixtureGate().promise, operation: Promise.resolve(), signal: controller.signal })
    .then(() => assert.fail('Cancelled readiness resolved'), (reason) => assert.equal(reason, null));
  await withFixtureLifecycle({ signal: controller.signal }, async () => assert.fail('Cancelled work started'))
    .then(() => assert.fail('Cancelled lifecycle resolved'), (reason) => assert.equal(reason, null));
});

test('scenario failure preserves identity after release and drain failures and drains before returning', async () => {
  const hold = createFixtureGate(); const primary = new Error('Primary failure');
  const order = []; const background = hold.promise.then(() => { order.push('drained'); throw new Error('Drain failure'); });
  await assert.rejects(withFixtureLifecycle({}, async (scope) => {
    scope.track(background); scope.onRelease(() => { order.push('released'); hold.release(); throw new Error('Cleanup failure'); });
    throw primary;
  }), (error) => error === primary);
  assert.deepEqual(order, ['released', 'drained']);
});

test('normal completion releases controlled work and waits for its actual drain before exposing the result', async () => {
  const hold = createFixtureGate(); const order = [];
  const result = await withFixtureLifecycle({}, async (scope) => {
    scope.track(hold.promise.then(async () => { await tick(); order.push('drained'); }));
    scope.onRelease(() => { order.push('released'); hold.release(); });
    return 42;
  });
  order.push('returned'); assert.equal(result, 42); assert.deepEqual(order, ['released', 'drained', 'returned']);
});

test('cleanup refuses late registrations while already-owned work still drains', async () => {
  const hold = createFixtureGate(); let drained = false;
  await withFixtureLifecycle({}, async (scope) => {
    scope.track(hold.promise.then(() => { drained = true; }));
    scope.onRelease(() => {
      hold.release();
      assert.throws(() => scope.onRelease(() => {}), /before cleanup/u);
      assert.throws(() => scope.track(Promise.resolve()), /registered promise/u);
    });
  });
  assert.equal(drained, true);
});

test('cancellation does not claim arbitrary work stopped before its cooperative finally has drained', async () => {
  const controller = new AbortController(); const entered = createFixtureGate(); const finalDrain = createFixtureGate();
  const reason = new Error('Cancelled while held'); const order = [];
  const operation = withFixtureLifecycle({ signal: controller.signal }, async (scope) => {
    const hold = createFixtureGate({ signal: scope.signal });
    scope.onRelease(() => { order.push('release'); }); entered.release();
    try { await hold.promise; }
    finally { await finalDrain.promise; order.push('actual drain'); }
  });
  let settled = false; operation.then(() => { settled = true; }, () => { settled = true; });
  await entered.promise; controller.abort(reason); await tick();
  assert.equal(settled, false); assert.deepEqual(order, ['release']);
  finalDrain.release(); await assert.rejects(operation, (error) => error === reason);
  assert.deepEqual(order, ['release', 'actual drain']);
});

test('a background task failure is reported even when the scenario body succeeds', async () => {
  const hold = createFixtureGate(); const failure = new Error('Background failure');
  await assert.rejects(withFixtureLifecycle({}, async (scope) => {
    scope.track(hold.promise.then(() => { throw failure; })); scope.onRelease(() => hold.release()); return 'body succeeded';
  }), (error) => error === failure);
});

test('a release failure cancels cooperative work before draining and preserves its identity', async () => {
  const fallback = createFixtureGate(); const releaseEntered = createFixtureGate();
  const failure = new Error('First release failure'); const order = [];
  let ownedSignal; let abortReason;
  const operation = withFixtureLifecycle({}, async (scope) => {
    ownedSignal = scope.signal;
    const waiting = createFixtureGate({ signal: scope.signal });
    scope.track(Promise.race([waiting.promise, fallback.promise]).catch((reason) => {
      abortReason = reason;
    }).finally(() => { order.push('drained'); }));
    scope.onRelease(() => { order.push('first release'); releaseEntered.release(); throw failure; });
    scope.onRelease(() => { order.push('second release'); throw new Error('Later release failure'); });
    return 'body succeeded';
  });
  operation.catch(() => {});
  await releaseEntered.promise; await tick();
  const cancelledBeforeFallback = ownedSignal.aborted;
  // This fallback always frees the deliberate old-helper hang before asserting.
  fallback.release();
  await assert.rejects(operation, (error) => error === failure);
  assert.equal(cancelledBeforeFallback, true);
  assert.equal(abortReason, failure);
  assert.equal(order.includes('second release'), true);
  assert.equal(order.at(-1), 'drained');
});

test('a later tracked rejection cancels an earlier waiting drain without waiting for drain order', async () => {
  const fallback = createFixtureGate(); const rejectTask = createFixtureGate(); const rejectionEntered = createFixtureGate();
  const failure = new Error('Later owned task failure'); let ownedSignal; let abortReason;
  const operation = withFixtureLifecycle({}, async (scope) => {
    ownedSignal = scope.signal;
    const waiting = createFixtureGate({ signal: scope.signal });
    scope.track(Promise.race([waiting.promise, fallback.promise]).catch((reason) => { abortReason = reason; }));
    scope.track(rejectTask.promise.then(() => { rejectionEntered.release(); throw failure; }));
    scope.onRelease(() => rejectTask.release());
  });
  operation.catch(() => {});
  await rejectionEntered.promise; await tick();
  const cancelledBeforeFallback = ownedSignal.aborted;
  fallback.release();
  await assert.rejects(operation, (error) => error === failure);
  assert.equal(cancelledBeforeFallback, true);
  assert.equal(abortReason, failure);
});

test('a body failure keeps priority over the background error that requests cooperative cancellation', async () => {
  const fallback = createFixtureGate(); const rejectionEntered = createFixtureGate();
  const backgroundFailure = new Error('Background cancellation cause'); const bodyFailure = new Error('Actual body failure');
  let bodyDrained = false;
  const operation = withFixtureLifecycle({}, async (scope) => {
    const waiting = createFixtureGate({ signal: scope.signal });
    scope.track(Promise.resolve().then(() => { rejectionEntered.release(); throw backgroundFailure; }));
    try { await Promise.race([waiting.promise, fallback.promise]); }
    catch { /* The background error wakes the body before its own failure. */ }
    bodyDrained = true;
    throw bodyFailure;
  });
  operation.catch(() => {});
  await rejectionEntered.promise; await tick(); fallback.release();
  await assert.rejects(operation, (error) => error === bodyFailure);
  assert.equal(bodyDrained, true);
});

test('already-cancelled scenarios start no work and readiness does not emit an unobserved future rejection', async () => {
  const controller = new AbortController(); const reason = new Error('Already cancelled'); controller.abort(reason);
  let started = 0;
  await assert.rejects(withFixtureLifecycle({ signal: controller.signal }, async () => { started += 1; }), (error) => error === reason);
  assert.equal(started, 0);
  await assert.rejects(waitForFixtureReady({ ready: createFixtureGate().promise, operation: Promise.reject(new Error('Later failure')),
    signal: controller.signal }), (error) => error === reason);
  await tick();
});

test('a missing acquisition completes without pretending a release or domain callback ran', async () => {
  let releases = 0;
  const observer = createFixtureWorkerObserver({ callbacks: { acquireLease: async () => null,
    releaseLease: async () => { releases += 1; } } });
  assert.equal(await observer.callbacks.acquireLease({ runId: 'run' }), null); await observer.finished;
  assert.equal(releases, 0);
});

test('an acquisition adapter rejection is observed and returned as no acquisition to detached work', async () => {
  const failure = new Error('Acquisition failure');
  const observer = createFixtureWorkerObserver({ callbacks: { acquireLease: async () => { throw failure; }, releaseLease: async () => {} } });
  assert.equal(await observer.callbacks.acquireLease({ runId: 'run' }), null);
  await assert.rejects(observer.finished, (error) => error === failure);
});

test('worker observer preserves callback arguments, false returns and legitimate domain failure outcomes', async () => {
  const input = { expectedLease: { acquisitionId: 'original' }, runId: 'run' }; const calls = [];
  const observer = createFixtureWorkerObserver({ callbacks: {
    markRunStarted: async (value) => { calls.push(value); return false; },
    markRunFailed: async (value) => { calls.push(value); return true; },
    releaseLease: async (value) => { calls.push(value); return null; },
  } });
  assert.equal(await observer.callbacks.markRunStarted(input), false);
  assert.equal(await observer.callbacks.markRunFailed(input), true);
  assert.equal(await observer.callbacks.releaseLease(input), null); await observer.finished;
  assert.equal(calls.every((value) => value === input), true);
});

test('lifecycle failure wins over later release failure, and no exception escapes the detached release callback', async () => {
  const primary = new Error('Lifecycle failure'); const cleanup = new Error('Release failure'); const order = [];
  const observer = createFixtureWorkerObserver({ callbacks: {
    markRunFailed: async () => { throw primary; },
    releaseLease: async () => { order.push('release'); throw cleanup; },
  } });
  assert.equal(await observer.callbacks.markRunFailed(), false);
  const detached = Promise.resolve().then(() => observer.callbacks.releaseLease());
  await assert.rejects(observer.finished, (error) => error === primary);
  assert.equal(await detached, false); assert.deepEqual(order, ['release']);
});

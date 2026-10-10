/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { createScopedFixtureGate, startScopedFixtureWork, withFixtureWorkScope } from '../../testing/integration/fixture-work-scope.js';

test('direct work registers before launch and its actual finally precedes resource cleanup', async () => {
  const order = [];
  const value = await withFixtureLifecycle({}, async (scope) => {
    scope.onRelease(() => { order.push('release'); });
    const hold = createScopedFixtureGate(scope);
    const work = startScopedFixtureWork(scope, async () => { try { await hold.promise; } finally { order.push('drained'); } });
    assert.deepEqual(order, []);
    work.catch(() => {});
    return 42;
  });
  order.push('resources closed'); assert.equal(value, 42);
  assert.deepEqual(order, ['release', 'drained', 'resources closed']);
});
test('captured lease finalization waits for held transaction drainage and continues after another finalizer fails', async () => {
  const primary = new Error('Body failed'); const order = []; let drained = false;
  await assert.rejects(withFixtureWorkScope({}, async (scope) => {
    // Registered before the gate, yet cannot block its release by doing SQL early.
    scope.onAfterDrain(() => { assert.equal(drained, true); order.push('lease'); throw new Error('Secondary lease failure'); });
    scope.onAfterDrain(() => { order.push('another resource'); });
    const hold = createScopedFixtureGate(scope);
    startScopedFixtureWork(scope, async () => { try { await hold.promise; } finally { drained = true; order.push('transaction'); } });
    await setImmediate(); throw primary;
  }), (error) => error === primary);
  assert.deepEqual(order, ['transaction', 'lease', 'another resource']);
});
test('successful work fails on deferred cleanup failure, while null primary and late-registration refusal remain exact', async () => {
  const cleanup = new Error('Deferred cleanup failure'); let captured;
  await assert.rejects(withFixtureWorkScope({}, async (scope) => { captured = scope;
    scope.onAfterDrain(() => { throw cleanup; }); return 1; }), (error) => error === cleanup);
  assert.throws(() => captured.onAfterDrain(() => {}), /before settlement/u);
  await withFixtureWorkScope({}, async (scope) => { scope.onAfterDrain(() => { throw cleanup; }); throw null; })
    .then(() => assert.fail('Null failure was lost'), (error) => assert.equal(error, null));
});
test('unreachable direct readiness surfaces the original failure and releases controlled dependencies', async () => {
  const failure = new Error('Failed before checkpoint');
  await assert.rejects(withFixtureLifecycle({}, async (scope) => {
    const entered = createScopedFixtureGate(scope);
    const operation = startScopedFixtureWork(scope, async () => { throw failure; });
    await waitForFixtureReady({ ready: entered.promise, operation, signal: scope.signal });
  }), (error) => error === failure);
});
test('held cancellation preserves Error and null and drains before allowing teardown', async () => {
  for (const reason of [new Error('Controlled cancellation'), null]) {
    const controller = new AbortController(); const entered = createFixtureGate(); const order = [];
    const pending = withFixtureLifecycle({ signal: controller.signal }, async (scope) => {
      const hold = createScopedFixtureGate(scope);
      const task = startScopedFixtureWork(scope, async () => {
        entered.release(); try { await hold.promise; } finally { await setImmediate(); order.push('drained'); }
      });
      await task;
    });
    pending.catch(() => {}); await entered.promise; controller.abort(reason);
    await pending.then(() => assert.fail('Cancellation was lost'), (error) => assert.equal(error, reason));
    order.push('resources closed'); assert.deepEqual(order, ['drained', 'resources closed']);
  }
});
test('pre-aborted and closed scopes launch neither direct work nor orphaned gate subscriptions', async () => {
  let closedScope; await withFixtureLifecycle({}, async (scope) => { closedScope = scope; });
  let launched = 0;
  assert.throws(() => startScopedFixtureWork(closedScope, () => { launched += 1; }), /registered promise/u);
  assert.throws(() => createScopedFixtureGate(closedScope), /before cleanup/u);
  const controller = new AbortController(); controller.abort(null);
  const scope = { signal: controller.signal, track: () => assert.fail('No registration after pre-abort'), onRelease: () => {} };
  for (const run of [() => createScopedFixtureGate(scope), () => startScopedFixtureWork(scope, () => { launched += 1; })]) {
    try { run(); assert.fail('Pre-abort was ignored'); } catch (error) { assert.equal(error, null); }
  }
  await setImmediate(); assert.equal(launched, 0);
});
test('cancellation after registration but before the launch microtask starts no work', async () => {
  const controller = new AbortController(); let launched = 0; let tracked;
  const scope = { signal: controller.signal, onRelease: () => {}, track: (operation) => { tracked = operation; controller.abort(null); } };
  const pending = startScopedFixtureWork(scope, () => { launched += 1; });
  assert.equal(pending, tracked);
  await pending.then(() => assert.fail('Cancelled launch resolved'), (error) => assert.equal(error, null));
  assert.equal(launched, 0);
});

/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createIntervalHeartbeatRunner } from '../../src/server/heartbeat/interval-heartbeat-runner.js';
import { createPushNotificationHistoryCleanupHeartbeat } from '../../src/server/push/push-notification-history-cleanup-heartbeat.js';

const summary = (overrides = {}) => ({ deletedCount: 0, batchesCompleted: 0, batchLimitReached: false, skipped: true, ...overrides });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function scheduledHeartbeat(options) {
  const handles = [], cleared = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ ...options,
    createIntervalHeartbeatRunnerFn: (input) => createIntervalHeartbeatRunner({ ...input,
      setIntervalFn: (callback, delay) => {
        const handle = { callback, delay, unreferenced: false, unref() { this.unreferenced = true; } };
        handles.push(handle); return handle;
      },
      clearIntervalFn: (handle) => cleared.push(handle),
    }),
  });
  return { heartbeat, handles, cleared };
}

test('history cleanup delegates the fixed database retention policy and stops after a short batch', async () => {
  const calls = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async (input) => {
    calls.push(input); return { deletedCount: 4 };
  } });
  assert.deepEqual(await heartbeat.tick(), summary({ deletedCount: 4, batchesCompleted: 1, skipped: false }));
  assert.deepEqual(calls, [{ limit: 500 }]);
});

test('history cleanup performs sequential full batches followed by one short batch', async () => {
  const counts = [500, 500, 4];
  let calls = 0, active = false;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async () => {
    assert.equal(active, false); active = true;
    await nextTurn(); active = false; calls++;
    return { deletedCount: counts.shift() };
  } });
  assert.deepEqual(await heartbeat.tick(), summary({ deletedCount: 1004, batchesCompleted: 3, skipped: false }));
  assert.equal(calls, 3);
});

test('history cleanup stops at ten full batches without an unbounded final sweep', async () => {
  let calls = 0;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async ({ limit }) => {
    calls++; assert.equal(limit, 500); return { deletedCount: 500 };
  } });
  assert.deepEqual(await heartbeat.tick(), summary({ deletedCount: 5000, batchesCompleted: 10, batchLimitReached: true, skipped: false }));
  assert.equal(calls, 10);
});

test('smaller injected limits stay bounded and cannot change the database age cutoff', async () => {
  const calls = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ batchLimit: 2, maxBatches: 3,
    deleteTerminalNotificationHistory: async (input) => { calls.push(input); return { deletedCount: 2 }; } });
  assert.deepEqual(await heartbeat.tick(), summary({ deletedCount: 6, batchesCompleted: 3, batchLimitReached: true, skipped: false }));
  assert.deepEqual(calls, [{ limit: 2 }, { limit: 2 }, { limit: 2 }]);
});

test('invalid retention batch, loop and timer bounds fail at construction', () => {
  assert.throws(() => createPushNotificationHistoryCleanupHeartbeat(), /deleteTerminalNotificationHistory dependency is required/);
  for (const options of [{ batchLimit: 0 }, { batchLimit: 501 }, { batchLimit: 1.5 }, { batchLimit: Infinity },
    { maxBatches: 0 }, { maxBatches: 11 }, { maxBatches: NaN }, { intervalMs: 0 }, { intervalMs: 2147483648 }]) {
    assert.throws(() => createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async () => ({ deletedCount: 0 }), ...options }), RangeError);
  }
});

test('retention failures report only a fixed error and preserve confirmed partial deletion counts', async () => {
  let calls = 0;
  const errors = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async () => {
    if (++calls === 3) throw new Error('private SQL payload endpoint recipient');
    return { deletedCount: 500 };
  }, onError: (error) => errors.push(error) });
  assert.deepEqual(await heartbeat.tick(), summary({ deletedCount: 1000, batchesCompleted: 2, skipped: false, reason: 'error' }));
  assert.equal(calls, 3);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Notification history cleanup failed');
  assert.equal(errors[0].cause, undefined);
  assert.deepEqual(Object.keys(errors[0]), []);
});

test('malformed deletion counts cannot invent progress or start another batch', async () => {
  for (const result of [undefined, {}, { deletedCount: -1 }, { deletedCount: 501 }, { deletedCount: '3' }, { deletedCount: NaN }]) {
    let calls = 0, errors = 0;
    const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async () => { calls++; return result; },
      onError: () => { errors++; } });
    assert.deepEqual(await heartbeat.tick(), summary({ reason: 'error' }));
    assert.equal(calls, 1); assert.equal(errors, 1);
  }
});

test('throwing and rejected diagnostic sinks cannot reject ticks or leave the overlap guard stuck', async () => {
  for (const onError of [() => { throw new Error('sink'); }, async () => { throw new Error('sink'); }]) {
    let calls = 0;
    const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: async () => {
      calls++; throw new Error('private database failure');
    }, onError });
    assert.deepEqual(await heartbeat.tick(), summary({ reason: 'error' }));
    assert.deepEqual(await heartbeat.tick(), summary({ reason: 'error' }));
    await nextTurn();
    assert.equal(calls, 2);
  }
});

test('overlapping retention ticks do not issue another deletion', async () => {
  const pending = deferred();
  let calls = 0;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: () => { calls++; return pending.promise; } });
  const first = heartbeat.tick();
  assert.deepEqual(await heartbeat.tick(), summary({ reason: 'tick_in_progress' }));
  assert.equal(calls, 1);
  pending.resolve({ deletedCount: 0 });
  assert.deepEqual(await first, summary({ batchesCompleted: 1, skipped: false }));
});

test('stop lets the active statement finish but prevents the next retention batch', async () => {
  const pending = deferred();
  let calls = 0, finished = false;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({ deleteTerminalNotificationHistory: () => { calls++; return pending.promise; } });
  const first = heartbeat.tick().then((result) => { finished = true; return result; });
  heartbeat.stop();
  await nextTurn();
  assert.equal(finished, false, 'stop must not pretend an active database statement was cancelled');
  pending.resolve({ deletedCount: 500 });
  assert.deepEqual(await first, summary({ deletedCount: 500, batchesCompleted: 1, skipped: false, reason: 'stopped' }));
  assert.equal(calls, 1);
  assert.deepEqual(await heartbeat.tick(), summary({ reason: 'stopped' }));
});

test('stop followed by restart cannot revive the previous generation batch loop', async () => {
  const pending = deferred();
  let calls = 0;
  const { heartbeat, handles, cleared } = scheduledHeartbeat({ deleteTerminalNotificationHistory: async () => {
    calls++; return calls === 1 ? pending.promise : { deletedCount: 0 };
  } });
  const first = heartbeat.tick();
  heartbeat.stop(); heartbeat.start();
  pending.resolve({ deletedCount: 500 });
  assert.deepEqual(await first, summary({ deletedCount: 500, batchesCompleted: 1, skipped: false, reason: 'stopped' }));
  assert.equal(calls, 1);
  assert.deepEqual(await heartbeat.tick(), summary({ batchesCompleted: 1, skipped: false }));
  assert.equal(calls, 2);
  heartbeat.stop();
  assert.deepEqual(cleared, handles);
});

test('scheduled cleanup starts once, runs immediately, unreferences its six-hour timer and stops cleanly', async () => {
  let calls = 0;
  const { heartbeat, handles, cleared } = scheduledHeartbeat({ deleteTerminalNotificationHistory: async () => { calls++; return { deletedCount: 0 }; } });
  const first = heartbeat.start();
  assert.equal(heartbeat.start(), first);
  await nextTurn();
  assert.equal(calls, 1);
  assert.equal(handles.length, 1);
  assert.equal(first.delay, 6 * 60 * 60 * 1000);
  assert.equal(first.unreferenced, true);
  heartbeat.stop();
  assert.deepEqual(cleared, [first]);
  assert.deepEqual(await heartbeat.tick(), summary({ reason: 'stopped' }));
  heartbeat.start();
  await nextTurn();
  assert.equal(calls, 2);
  heartbeat.stop();
  assert.equal(cleared.length, 2);
});

test('one cleanup tick completes independent history and subscription budgets sequentially', async () => {
  const calls = [];
  let active = false;
  const deleteBatch = (phase) => async (input) => {
    assert.equal(active, false); active = true;
    assert.deepEqual(input, { limit: 500 });
    calls.push(phase);
    await nextTurn(); active = false;
    return { deletedCount: 500 };
  };
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: deleteBatch('history'),
    pruneInvalidatedSubscriptions: deleteBatch('subscriptions'),
  });
  const completed = summary({ deletedCount: 5000, batchesCompleted: 10, batchLimitReached: true, skipped: false });
  assert.deepEqual(await heartbeat.tick(), { ...completed, subscriptionPruning: completed });
  assert.deepEqual(calls, [...Array(10).fill('history'), ...Array(10).fill('subscriptions')]);
});

test('short history batches proceed to subscription pruning with separately bounded progress', async () => {
  const calls = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: async () => ({ deletedCount: 0 }),
    pruneInvalidatedSubscriptions: async (input) => {
      calls.push(input); return { deletedCount: calls.length === 1 ? 2 : 1 };
    },
    subscriptionBatchLimit: 2, subscriptionMaxBatches: 3,
  });
  assert.deepEqual(await heartbeat.tick(), { ...summary({ batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ deletedCount: 3, batchesCompleted: 2, skipped: false }) });
  assert.deepEqual(calls, [{ limit: 2 }, { limit: 2 }]);
});

test('invalid subscription pruning dependencies and bounds fail before either phase runs', () => {
  const dependencies = { deleteTerminalNotificationHistory: () => assert.fail('construction must not clean history'),
    pruneInvalidatedSubscriptions: () => assert.fail('construction must not prune subscriptions') };
  assert.throws(() => createPushNotificationHistoryCleanupHeartbeat({ ...dependencies, pruneInvalidatedSubscriptions: {} }),
    /pruneInvalidatedSubscriptions dependency must be a function/);
  for (const options of [{ subscriptionBatchLimit: 0 }, { subscriptionBatchLimit: 501 }, { subscriptionBatchLimit: 1.5 },
    { subscriptionBatchLimit: Infinity }, { subscriptionMaxBatches: 0 }, { subscriptionMaxBatches: 11 }, { subscriptionMaxBatches: NaN }]) {
    assert.throws(() => createPushNotificationHistoryCleanupHeartbeat({ ...dependencies, ...options }), RangeError);
  }
});

test('failed history cleanup skips pruning without losing already confirmed history counts', async () => {
  let historyCalls = 0;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: async () => {
      if (++historyCalls === 2) throw new Error('private database details');
      return { deletedCount: 500 };
    },
    pruneInvalidatedSubscriptions: () => assert.fail('history errors must prevent pruning this tick'),
    onError: () => {},
  });
  assert.deepEqual(await heartbeat.tick(), { ...summary({ deletedCount: 500, batchesCompleted: 1, skipped: false, reason: 'error' }),
    subscriptionPruning: summary({ reason: 'history_error' }) });
});

test('subscription failures retain partial counts and emit only contained fixed diagnostics', async () => {
  for (const sink of [() => {}, () => { throw new Error('sink'); }, async () => { throw new Error('sink'); }]) {
    let calls = 0;
    const errors = [];
    const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
      deleteTerminalNotificationHistory: async () => ({ deletedCount: 3 }),
      pruneInvalidatedSubscriptions: async () => {
        if (++calls === 2) throw new Error('endpoint secret owner SQL');
        return { deletedCount: 500 };
      },
      onSubscriptionPruningError: (error) => { errors.push(error); return sink(); },
    });
    assert.deepEqual(await heartbeat.tick(), { ...summary({ deletedCount: 3, batchesCompleted: 1, skipped: false }),
      subscriptionPruning: summary({ deletedCount: 500, batchesCompleted: 1, skipped: false, reason: 'error' }) });
    await nextTurn();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'Invalidated subscription pruning failed');
    assert.equal(errors[0].cause, undefined);
    assert.deepEqual(Object.keys(errors[0]), []);
  }
});

test('invalid subscription deletion counts cannot invent progress or continue pruning', async () => {
  let calls = 0;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: async () => ({ deletedCount: 0 }),
    pruneInvalidatedSubscriptions: async () => { calls++; return { deletedCount: 501 }; },
    onSubscriptionPruningError: () => {},
  });
  assert.deepEqual(await heartbeat.tick(), { ...summary({ batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ reason: 'error' }) });
  assert.equal(calls, 1);
});

test('the shared overlap guard protects both phases while subscription pruning is active', async () => {
  const pending = deferred();
  let historyCalls = 0, pruningCalls = 0;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: async () => { historyCalls++; return { deletedCount: 0 }; },
    pruneInvalidatedSubscriptions: () => { pruningCalls++; return pending.promise; },
  });
  const first = heartbeat.tick();
  await nextTurn();
  assert.deepEqual(await heartbeat.tick(), { ...summary({ reason: 'tick_in_progress' }),
    subscriptionPruning: summary({ reason: 'tick_in_progress' }) });
  assert.equal(historyCalls, 1); assert.equal(pruningCalls, 1);
  pending.resolve({ deletedCount: 1 });
  assert.deepEqual(await first, { ...summary({ batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ deletedCount: 1, batchesCompleted: 1, skipped: false }) });
});

test('stop and restart between phases cannot begin pruning from the previous generation', async () => {
  const pending = deferred();
  let historyCalls = 0, pruningCalls = 0;
  const { heartbeat } = scheduledHeartbeat({
    deleteTerminalNotificationHistory: async () => { historyCalls++; return historyCalls === 1 ? pending.promise : { deletedCount: 0 }; },
    pruneInvalidatedSubscriptions: async () => { pruningCalls++; return { deletedCount: 0 }; },
  });
  const first = heartbeat.tick();
  heartbeat.stop(); heartbeat.start();
  pending.resolve({ deletedCount: 0 });
  assert.deepEqual(await first, { ...summary({ batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ reason: 'stopped' }) });
  assert.equal(pruningCalls, 0);
  assert.deepEqual(await heartbeat.tick(), { ...summary({ batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ batchesCompleted: 1, skipped: false }) });
  assert.equal(historyCalls, 2); assert.equal(pruningCalls, 1);
  heartbeat.stop();
});

test('stop during pruning lets its transaction finish and prevents another batch or later phase', async () => {
  const pending = deferred();
  let pruningCalls = 0, finished = false;
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteTerminalNotificationHistory: async () => ({ deletedCount: 2 }),
    pruneInvalidatedSubscriptions: () => { pruningCalls++; return pending.promise; },
  });
  const first = heartbeat.tick().then((result) => { finished = true; return result; });
  await nextTurn();
  heartbeat.stop();
  await nextTurn();
  assert.equal(finished, false);
  pending.resolve({ deletedCount: 500 });
  assert.deepEqual(await first, { ...summary({ deletedCount: 2, batchesCompleted: 1, skipped: false }),
    subscriptionPruning: summary({ deletedCount: 500, batchesCompleted: 1, skipped: false, reason: 'stopped' }) });
  assert.equal(pruningCalls, 1);
  assert.deepEqual(await heartbeat.tick(), { ...summary({ reason: 'stopped' }), subscriptionPruning: summary({ reason: 'stopped' }) });
});

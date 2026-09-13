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

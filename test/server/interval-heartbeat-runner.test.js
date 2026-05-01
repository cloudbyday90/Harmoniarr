import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntervalHeartbeatRunner } from '../../src/server/heartbeat/interval-heartbeat-runner.js';

test('createIntervalHeartbeatRunner starts once, unreferences the interval, and stops cleanly', async () => {
  let recordedDelay = null;
  let intervalHandle = null;
  const clearedHandles = [];
  const tickCalls = [];

  const runner = createIntervalHeartbeatRunner({
    clearIntervalFn: (handle) => {
      clearedHandles.push(handle);
    },
    intervalMs: 1234,
    onTick: async () => {
      tickCalls.push('tick');
      return { skipped: false };
    },
    setIntervalFn: (callback, delay) => {
      recordedDelay = delay;
      intervalHandle = {
        callback,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        },
      };
      return intervalHandle;
    },
  });

  const startHandle = runner.start();
  const secondHandle = runner.start();
  await Promise.resolve();

  assert.equal(recordedDelay, 1234);
  assert.equal(startHandle, intervalHandle);
  assert.equal(secondHandle, intervalHandle);
  assert.equal(intervalHandle.unrefCalled, true);
  assert.equal(tickCalls.length, 1);

  runner.stop();

  assert.deepEqual(clearedHandles, [intervalHandle]);
});

test('createIntervalHeartbeatRunner delegates concurrent ticks to onTickInProgress', async () => {
  let releaseTick = null;
  let onTickInProgressCalls = 0;
  const runner = createIntervalHeartbeatRunner({
    intervalMs: 1000,
    onTick: async () => new Promise((resolve) => {
      releaseTick = resolve;
    }),
    onTickInProgress: async () => {
      onTickInProgressCalls += 1;
      return {
        reason: 'tick_in_progress',
        skipped: true,
      };
    },
    setIntervalFn: () => ({ unref() {} }),
  });

  const firstTick = runner.tick();
  const secondTick = await runner.tick();

  assert.deepEqual(secondTick, {
    reason: 'tick_in_progress',
    skipped: true,
  });
  assert.equal(onTickInProgressCalls, 1);

  releaseTick({ skipped: false });
  await firstTick;
});
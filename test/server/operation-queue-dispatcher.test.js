import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationQueueDispatcher } from '../../src/server/operation-queue-dispatcher.js';

test('operation queue dispatcher claims runnable runs and launches matching handlers', async (t) => {
  let onTick;
  const queueResponses = [
    {
      id: 'run-1',
      operationType: 'library_scan',
      summary: { libraryRoot: 'D:/music' },
    },
    {
      id: 'run-2',
      operationType: 'artwork_cleanup',
      summary: { requestedAssetCount: 8 },
    },
    null,
  ];
  const claimNextRunnableRun = t.mock.fn(async () => queueResponses.shift() ?? null);
  const libraryHandler = t.mock.fn(async () => {});
  const artworkHandler = t.mock.fn(async () => {});
  const recoverStrandedRuns = t.mock.fn(async () => ({
    activeLeaseCount: 1,
    failedCount: 0,
    retriedCount: 1,
    scannedCount: 2,
    skipped: false,
  }));
  const dispatcher = createOperationQueueDispatcher({
    createIntervalHeartbeatRunnerFn: ({ onTick: tick }) => {
      onTick = tick;
      return {
        start() {},
        stop() {},
        tick() {
          return onTick();
        },
      };
    },
    handlers: {
      artwork_cleanup: artworkHandler,
      library_scan: libraryHandler,
    },
    operationQueueStore: {
      claimNextRunnableRun,
    },
    operationStrandedRunRecoveryService: {
      recoverStrandedRuns,
    },
  });

  const result = await dispatcher.tick();

  assert.deepEqual(recoverStrandedRuns.mock.calls[0].arguments, [{
    operationTypes: ['artwork_cleanup', 'library_scan'],
  }]);
  assert.deepEqual(claimNextRunnableRun.mock.calls[0].arguments, [{
    operationTypes: ['artwork_cleanup', 'library_scan'],
  }]);
  assert.equal(claimNextRunnableRun.mock.callCount(), 3);
  assert.deepEqual(libraryHandler.mock.calls[0].arguments, [{
    run: {
      id: 'run-1',
      operationType: 'library_scan',
      summary: { libraryRoot: 'D:/music' },
    },
  }]);
  assert.deepEqual(artworkHandler.mock.calls[0].arguments, [{
    run: {
      id: 'run-2',
      operationType: 'artwork_cleanup',
      summary: { requestedAssetCount: 8 },
    },
  }]);
  assert.deepEqual(result, {
    claimedCount: 2,
    failedCount: 0,
    retriedCount: 1,
    scannedCount: 2,
    skipped: false,
  });
});

test('operation queue dispatcher skips claims while maintenance dispatch readiness is paused', async (t) => {
  const claimNextRunnableRun = t.mock.fn(async () => null);
  const recoverStrandedRuns = t.mock.fn(async () => ({
    activeLeaseCount: 0,
    failedCount: 0,
    retriedCount: 0,
    scannedCount: 0,
    skipped: true,
  }));
  const resolveDispatchReadiness = t.mock.fn(async () => ({
    allowed: false,
    nextRetryAt: '2026-05-04T12:00:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Operation queue dispatch is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
    pausedOperationTypes: ['library_scan'],
  }));
  const dispatcher = createOperationQueueDispatcher({
    createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
      start() {},
      stop() {},
      tick() {
        return onTick();
      },
    }),
    dispatchPauseService: {
      resolveDispatchReadiness,
    },
    handlers: {
      library_scan: async () => {},
    },
    operationQueueStore: {
      claimNextRunnableRun,
    },
    operationStrandedRunRecoveryService: {
      recoverStrandedRuns,
    },
  });

  const result = await dispatcher.tick();

  assert.deepEqual(resolveDispatchReadiness.mock.calls[0].arguments, [{
    operationTypes: ['library_scan'],
  }]);
  assert.equal(recoverStrandedRuns.mock.callCount(), 0);
  assert.equal(claimNextRunnableRun.mock.callCount(), 0);
  assert.deepEqual(result, {
    claimedCount: 0,
    failedCount: 0,
    nextRetryAt: '2026-05-04T12:00:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Operation queue dispatch is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
    pausedOperationTypes: ['library_scan'],
    reason: 'paused',
    retriedCount: 0,
    scannedCount: 0,
    skipped: true,
  });
});

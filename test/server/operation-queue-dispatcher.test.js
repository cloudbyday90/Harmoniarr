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
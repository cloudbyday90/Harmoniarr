import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkCleanupWorker } from '../../src/server/artwork/artwork-cleanup-worker.js';

test('createArtworkCleanupWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createArtworkCleanupWorker({
    acquireLease,
    artworkCleanupService: {
      cleanupUnassignedArtwork: t.mock.fn(async () => ({
        deletedAssetCount: 0,
        scannedAssetCount: 0,
      })),
    },
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Artwork cleanup is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    }),
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    releaseLease,
  });

  const paused = new Promise((resolve) => {
    markRunPaused.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });
  const leaseReleased = new Promise((resolve) => {
    releaseLease.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    requestedAssetCount: 10,
    retentionCutoff: '2026-01-31T12:00:00.000Z',
    runId: 'run-paused',
  });

  const pausedArgs = await paused;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.deepEqual(pausedArgs, {
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    runId: 'run-paused',
    summary: {
      currentStep: 'Artwork cleanup paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Artwork cleanup is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      requestedAssetCount: 10,
      retentionCutoff: '2026-01-31T12:00:00.000Z',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('createArtworkCleanupWorker executes cleanup and records completion summary', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const artworkCleanupService = {
    cleanupUnassignedArtwork: t.mock.fn(async () => ({
      deletedAssetCount: 2,
      deletedFileCount: 1,
      failedAssetCount: 0,
      failures: [],
      missingFileCount: 1,
      retentionCutoff: '2026-01-31T12:00:00.000Z',
      scannedAssetCount: 2,
    })),
  };
  const worker = createArtworkCleanupWorker({
    acquireLease,
    artworkCleanupService,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    releaseLease,
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    requestedAssetCount: 2,
    retentionCutoff: '2026-01-31T12:00:00.000Z',
    runId: 'run-1',
  });

  const completionArgs = await completion;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.deepEqual(markRunStarted.mock.calls[0].arguments, [{
    runId: 'run-1',
    summary: {
      requestedAssetCount: 2,
      retentionCutoff: '2026-01-31T12:00:00.000Z',
    },
  }]);
  assert.deepEqual(artworkCleanupService.cleanupUnassignedArtwork.mock.calls[0].arguments, [{
    limit: 2,
  }]);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(completionArgs.summary.deletedAssetCount, 2);
});
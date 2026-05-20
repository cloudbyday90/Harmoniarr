import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';

test('createLibraryDiscoveryWorker reconciles and dispatches a protected discovery run', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => ({
    attemptedCount: 3,
    candidateCount: 8,
    dispatchedCount: 2,
    failedCount: 1,
    fileCount: 14,
  }));
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const prefetchMonitoredArtistArtwork = t.mock.fn(async () => ({
    cachedCount: 2,
    eligibleArtistCount: 2,
    fetchedCount: 1,
  }));
  const reconcileDiscoveryRequests = t.mock.fn(async () => {});
  const reconcileWantedReleases = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    prefetchMonitoredArtistArtwork,
    reconcileDiscoveryRequests,
    reconcileWantedReleases,
    releaseLease,
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });
  const leaseReleased = new Promise((resolve) => {
    releaseLease.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    requestMetadata: {
      ipAddress: '198.51.100.30',
      userAgent: 'HarmoniarrDiscoveryWorkerTest/1.0',
    },
    runId: 'run-3',
    triggeredByUserId: 'user-2',
  });

  const completionArgs = await completion;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.deepEqual(markRunStarted.mock.calls[0].arguments[0], {
    runId: 'run-3',
    summary: {
      triggerSource: 'manual',
    },
  });
  assert.equal(reconcileWantedReleases.mock.callCount(), 1);
  assert.equal(reconcileDiscoveryRequests.mock.callCount(), 1);
  assert.equal(prefetchMonitoredArtistArtwork.mock.callCount(), 1);
  assert.equal(dispatchDiscoveryRequests.mock.callCount(), 1);
  assert.deepEqual(dispatchDiscoveryRequests.mock.calls[0].arguments[0], {
    actorUserId: 'user-2',
    requestMetadata: {
      ipAddress: '198.51.100.30',
      userAgent: 'HarmoniarrDiscoveryWorkerTest/1.0',
    },
  });
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.deepEqual(completionArgs, {
    runId: 'run-3',
    summary: {
      attemptedCount: 3,
      candidateCount: 8,
      dispatchedCount: 2,
      failedCount: 1,
      fileCount: 14,
      monitoredArtistArtwork: {
        cachedCount: 2,
        eligibleArtistCount: 2,
        fetchedCount: 1,
      },
      outcome: 'partial',
      triggerSource: 'manual',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-3',
    status: 'completed',
  });
});

test('createLibraryDiscoveryWorker marks the run cancelled before dispatch when an operator cancellation is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => ({
    attemptedCount: 1,
    candidateCount: 2,
    dispatchedCount: 1,
    failedCount: 0,
    fileCount: 4,
  }));
  const isCancellationRequested = t.mock.fn(async () => true);
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    isCancellationRequested,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    releaseLease,
  });

  const cancelled = new Promise((resolve) => {
    markRunCancelled.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });
  const leaseReleased = new Promise((resolve) => {
    releaseLease.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({ runId: 'run-cancelled' });

  const cancelledArgs = await cancelled;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(dispatchDiscoveryRequests.mock.callCount(), 0);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.deepEqual(cancelledArgs, {
    runId: 'run-cancelled',
    summary: {
      currentStep: 'Library discovery cancelled',
      triggerSource: 'manual',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-cancelled',
    status: 'cancelled',
  });
});

test('createLibraryDiscoveryWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => ({
    attemptedCount: 1,
    candidateCount: 2,
    dispatchedCount: 1,
    failedCount: 0,
    fileCount: 4,
  }));
  const isCancellationRequested = t.mock.fn(async () => ({
    kind: 'paused',
    nextRetryAt: '2026-05-04T12:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Library discovery is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
  }));
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    isCancellationRequested,
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

  await worker.startWorkerRun({ runId: 'run-paused' });

  const pausedArgs = await paused;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(dispatchDiscoveryRequests.mock.callCount(), 0);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.deepEqual(pausedArgs, {
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    runId: 'run-paused',
    summary: {
      currentStep: 'Library discovery paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Library discovery is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      triggerSource: 'manual',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('createLibraryDiscoveryWorker calls pruneOldRuns after a completed run', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => ({
    attemptedCount: 0,
    candidateCount: 0,
    dispatchedCount: 0,
    failedCount: 0,
    fileCount: 0,
  }));
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const pruneOldRuns = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    pruneOldRuns,
    releaseLease,
  });

  const pruned = new Promise((resolve) => {
    pruneOldRuns.mock.mockImplementation(async () => {
      resolve();
    });
  });

  await worker.startWorkerRun({ runId: 'run-prune-1' });
  await pruned;

  assert.equal(pruneOldRuns.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
});

test('createLibraryDiscoveryWorker calls pruneOldRuns even when a run fails', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => {
    throw new Error('dispatch blew up');
  });
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const pruneOldRuns = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    pruneOldRuns,
    releaseLease,
  });

  const pruned = new Promise((resolve) => {
    pruneOldRuns.mock.mockImplementation(async () => {
      resolve();
    });
  });

  await worker.startWorkerRun({ runId: 'run-prune-fail-1' });
  await pruned;

  assert.equal(pruneOldRuns.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 0);
});

test('createLibraryDiscoveryWorker records monitored artist artwork prefetch failures without failing discovery dispatch', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const dispatchDiscoveryRequests = t.mock.fn(async () => ({
    attemptedCount: 1,
    candidateCount: 1,
    dispatchedCount: 1,
    failedCount: 0,
    fileCount: 2,
  }));
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const prefetchMonitoredArtistArtwork = t.mock.fn(async () => {
    throw new Error('prefetch failed');
  });
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    prefetchMonitoredArtistArtwork,
    releaseLease,
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({ runId: 'run-prefetch-warning' });
  const completionArgs = await completion;

  assert.equal(prefetchMonitoredArtistArtwork.mock.callCount(), 1);
  assert.equal(dispatchDiscoveryRequests.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.deepEqual(completionArgs, {
    runId: 'run-prefetch-warning',
    summary: {
      attemptedCount: 1,
      candidateCount: 1,
      dispatchedCount: 1,
      failedCount: 0,
      fileCount: 2,
      monitoredArtistArtwork: {
        errorMessage: 'prefetch failed',
        status: 'failed',
      },
      outcome: 'completed',
      triggerSource: 'manual',
    },
  });
});

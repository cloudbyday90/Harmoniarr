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
  const reconcileDiscoveryRequests = t.mock.fn(async () => {});
  const reconcileWantedReleases = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryDiscoveryWorker({
    acquireLease,
    dispatchDiscoveryRequests,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
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
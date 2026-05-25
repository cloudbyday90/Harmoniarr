import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';

test('createOperatorArtistReconciliationWorker executes the snapshot-driven reconciliation run', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const executeOperatorArtistReconciliation = t.mock.fn(async () => ({
    completedAt: '2026-05-25T13:10:00.000Z',
    desiredReleaseGroupCount: 2,
    desiredTrackOverrideCount: 3,
    monitoredReleaseGroupTypeCount: 2,
    monitoredReleaseGroupTypes: ['album', 'ep'],
    partialReleaseGroupCount: 1,
    releaseGroupSelectionCount: 3,
    selectionSourceMode: 'policy_only',
    snapshotId: 'snapshot-4',
    snapshotPayloadKeyCount: 2,
    snapshotRevision: 4,
    snapshotSavedAt: '2026-05-25T13:01:00.000Z',
    suppressedTrackOverrideCount: 1,
    trackOverrideCount: 4,
    unselectedReleaseGroupCount: 1,
    wantedAutomationMode: 'future_matching',
  }));
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createOperatorArtistReconciliationWorker({
    acquireLease,
    executeOperatorArtistReconciliation,
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
  const leaseReleased = new Promise((resolve) => {
    releaseLease.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    runId: 'run-1',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
  });

  const completionArgs = await completion;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.deepEqual(markRunStarted.mock.calls[0].arguments[0], {
    runId: 'run-1',
    summary: {
      appUserId: 'user-1',
      artistName: 'Autechre',
      currentStep: 'Reconciling operator artist snapshot',
      metadataArtistId: 'artist-1',
      snapshotId: 'snapshot-4',
      snapshotRevision: 4,
      triggerSource: 'save',
    },
  });
  assert.deepEqual(executeOperatorArtistReconciliation.mock.calls[0].arguments[0].appUserId, 'user-1');
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(completionArgs.summary.currentStep, 'Artist reconciliation completed');
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-1',
    status: 'completed',
  });
});

test('createOperatorArtistReconciliationWorker marks the run cancelled before execution when requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const executeOperatorArtistReconciliation = t.mock.fn(async () => ({
    completedAt: '2026-05-25T13:10:00.000Z',
  }));
  const isCancellationRequested = t.mock.fn(async () => true);
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createOperatorArtistReconciliationWorker({
    acquireLease,
    executeOperatorArtistReconciliation,
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

  await worker.startWorkerRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    runId: 'run-cancelled',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
  });

  const cancelledArgs = await cancelled;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(executeOperatorArtistReconciliation.mock.callCount(), 0);
  assert.deepEqual(cancelledArgs, {
    runId: 'run-cancelled',
    summary: {
      appUserId: 'user-1',
      artistName: 'Autechre',
      currentStep: 'Artist reconciliation cancelled',
      metadataArtistId: 'artist-1',
      snapshotId: 'snapshot-4',
      snapshotRevision: 4,
      triggerSource: 'save',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-cancelled',
    status: 'cancelled',
  });
});

test('createOperatorArtistReconciliationWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const executeOperatorArtistReconciliation = t.mock.fn(async () => ({
    completedAt: '2026-05-25T13:10:00.000Z',
  }));
  const isCancellationRequested = t.mock.fn(async () => ({
    kind: 'paused',
    nextRetryAt: '2026-05-25T13:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Artist reconciliation is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
  }));
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createOperatorArtistReconciliationWorker({
    acquireLease,
    executeOperatorArtistReconciliation,
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

  await worker.startWorkerRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    runId: 'run-paused',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
  });

  const pausedArgs = await paused;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(executeOperatorArtistReconciliation.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.deepEqual(pausedArgs, {
    nextAttemptAt: '2026-05-25T13:30:00.000Z',
    runId: 'run-paused',
    summary: {
      appUserId: 'user-1',
      artistName: 'Autechre',
      currentStep: 'Artist reconciliation paused by maintenance lock',
      metadataArtistId: 'artist-1',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Artist reconciliation is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      snapshotId: 'snapshot-4',
      snapshotRevision: 4,
      triggerSource: 'save',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

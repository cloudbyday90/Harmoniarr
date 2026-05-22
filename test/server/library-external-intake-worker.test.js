import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';

test('startWorkerRun requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createLibraryExternalIntakeWorker({
    acquireLease,
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'External provider ingest planning is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    }),
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    planExternalMediaRequest: t.mock.fn(async () => ({
      normalizedSource: {},
      plannedAt: '2026-05-02T00:00:00.000Z',
      providerIngestRequests: [],
    })),
    releaseLease,
    renewLease: null,
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
    canonicalUrl: 'https://open.spotify.com/playlist/abc',
    mediaRequestId: 'req-paused',
    resourceType: 'playlist',
    runId: 'run-paused',
    sourceIdentifier: 'abc',
    sourceProvider: 'spotify',
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
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      currentStep: 'External provider ingest planning paused by maintenance lock',
      mediaRequestId: 'req-paused',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'External provider ingest planning is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
      sourceProvider: 'spotify',
      triggerSource: 'request_submit',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('startWorkerRun queues planning via microtask and completes run on success', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const planExternalMediaRequest = t.mock.fn(async () => ({
    mediaRequestId: 'req-1',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
      storefront: null,
    },
    plannedAt: '2026-05-02T00:00:00.000Z',
    providerIngestRequests: [{ id: 'ingest-1' }],
  }));

  const worker = createLibraryExternalIntakeWorker({
    acquireLease,
    isCancellationRequested: async () => false,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    planExternalMediaRequest,
    releaseLease,
    renewLease: null,
  });

  worker.startWorkerRun({
    canonicalUrl: 'https://open.spotify.com/playlist/abc',
    mediaRequestId: 'req-1',
    resourceType: 'playlist',
    runId: 'run-1',
    sourceIdentifier: 'abc',
    sourceProvider: 'spotify',
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(planExternalMediaRequest.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(releaseLease.mock.callCount(), 1);
  assert.equal(releaseLease.mock.calls[0].arguments[0].status, 'completed');
});

test('startWorkerRun marks run failed on planning error', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});

  const worker = createLibraryExternalIntakeWorker({
    acquireLease,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    planExternalMediaRequest: async () => {
      throw new Error('planning failed');
    },
    releaseLease,
    renewLease: null,
  });

  worker.startWorkerRun({
    canonicalUrl: 'https://open.spotify.com/album/xyz',
    mediaRequestId: 'req-2',
    resourceType: 'release',
    runId: 'run-2',
    sourceIdentifier: 'xyz',
    sourceProvider: 'spotify',
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  assert.equal(markRunFailed.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(releaseLease.mock.calls[0].arguments[0].status, 'failed');
});

test('startWorkerRun is idempotent for the same runId', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});

  const worker = createLibraryExternalIntakeWorker({
    acquireLease,
    isCancellationRequested: async () => false,
    markRunCancelled: async () => {},
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    planExternalMediaRequest: async () => ({
      mediaRequestId: 'req-3',
      normalizedSource: { canonicalUrl: 'x', provider: 'spotify', relatedIdentifier: null, resourceType: 'release', sourceIdentifier: 'z', storefront: null },
      plannedAt: '2026-05-02T00:00:00.000Z',
      providerIngestRequests: [],
    }),
    releaseLease: async () => {},
    renewLease: null,
  });

  worker.startWorkerRun({ canonicalUrl: 'x', mediaRequestId: 'req-3', resourceType: 'release', runId: 'run-3', sourceIdentifier: 'z', sourceProvider: 'spotify' });
  worker.startWorkerRun({ canonicalUrl: 'x', mediaRequestId: 'req-3', resourceType: 'release', runId: 'run-3', sourceIdentifier: 'z', sourceProvider: 'spotify' });

  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
});

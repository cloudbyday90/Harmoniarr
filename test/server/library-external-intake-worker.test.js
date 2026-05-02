import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';

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

  await new Promise((resolve) => setTimeout(resolve, 10));

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

  await new Promise((resolve) => setTimeout(resolve, 10));

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

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
});

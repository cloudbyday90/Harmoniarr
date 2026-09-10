import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunCancellationError } from '../../src/server/operation-run-cancellation.js';
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';
import { createLibraryProviderIngestExecutionWorker } from '../../src/server/library/library-provider-ingest-execution-worker.js';

const run = {
  canonicalUrl: 'https://open.spotify.com/album/album-1',
  mediaRequestId: 'child-1',
  resourceType: 'release',
  runId: 'run-1',
  sourceIdentifier: 'album-1',
  sourceProvider: 'spotify',
};

function createWorkerFixture(t, factory, options) {
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  let resolveReleased;
  const released = new Promise((resolve) => { resolveReleased = resolve; });
  const worker = factory({
    acquireLease: async () => {},
    isCancellationRequested: async () => false,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted: async () => {},
    releaseLease: async (value) => { resolveReleased(value); },
    ...options,
  });
  return { worker, released, markRunCancelled, markRunCompleted, markRunFailed };
}

const plannedResult = {
  normalizedSource: { canonicalUrl: run.canonicalUrl, provider: 'spotify', resourceType: 'release', sourceIdentifier: 'album-1' },
  plannedAt: '2026-09-10T00:00:00.000Z',
  providerIngestRequests: [{ id: 'ingest-1' }],
};

test('planning worker marks cancellation before execution queueing as cancelled, never completed', async (t) => {
  const fixture = createWorkerFixture(t, createLibraryExternalIntakeWorker, {
    planExternalMediaRequest: async () => plannedResult,
    queueExternalMediaRequestExecution: async () => { throw createOperationRunCancellationError({ runId: 'run-1' }); },
  });
  await fixture.worker.startWorkerRun(run);
  assert.deepEqual(await fixture.released, { runId: 'run-1', status: 'cancelled' });
  assert.equal(fixture.markRunCancelled.mock.callCount(), 1);
  assert.equal(fixture.markRunCompleted.mock.callCount(), 0);
  assert.equal(fixture.markRunFailed.mock.callCount(), 0);
});

test('planning worker rechecks operation cancellation before scheduling execution', async (t) => {
  let cancelled = false;
  const queueExternalMediaRequestExecution = t.mock.fn(async () => {});
  const fixture = createWorkerFixture(t, createLibraryExternalIntakeWorker, {
    isCancellationRequested: async () => cancelled,
    planExternalMediaRequest: async () => {
      cancelled = true;
      return plannedResult;
    },
    queueExternalMediaRequestExecution,
  });
  await fixture.worker.startWorkerRun(run);
  assert.equal((await fixture.released).status, 'cancelled');
  assert.equal(queueExternalMediaRequestExecution.mock.callCount(), 0);
  assert.equal(fixture.markRunCompleted.mock.callCount(), 0);
});

test('execution worker preserves cancellation after partial provider work', async (t) => {
  const fixture = createWorkerFixture(t, createLibraryProviderIngestExecutionWorker, {
    executeProviderIngestRequests: async () => { throw createOperationRunCancellationError({ runId: 'run-1' }); },
  });
  await fixture.worker.startWorkerRun(run);
  assert.equal((await fixture.released).status, 'cancelled');
  assert.equal(fixture.markRunCancelled.mock.callCount(), 1);
  assert.equal(fixture.markRunCompleted.mock.callCount(), 0);
  assert.equal(fixture.markRunFailed.mock.callCount(), 0);
});

test('execution worker rechecks operation cancellation before reporting completion', async (t) => {
  let cancelled = false;
  const fixture = createWorkerFixture(t, createLibraryProviderIngestExecutionWorker, {
    isCancellationRequested: async () => cancelled,
    executeProviderIngestRequests: async () => {
      cancelled = true;
      return { executedCount: 1, failedCount: 0 };
    },
  });
  await fixture.worker.startWorkerRun(run);
  assert.equal((await fixture.released).status, 'cancelled');
  assert.equal(fixture.markRunCompleted.mock.callCount(), 0);
});

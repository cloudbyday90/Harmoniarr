import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryDiscoveryRediscoveryService } from '../../src/server/library/library-discovery-rediscovery-service.js';

test('scheduleDownloadRecoveryRediscovery delays discovery and queues a matching operation run', async (t) => {
  const scheduleDownloadRecoveryRediscovery = t.mock.fn(async () => ({
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    researchAttemptCount: 1,
    searchAttemptCount: 1,
  }));
  const createDiscoveryRun = t.mock.fn(async ({ nextAttemptAt, summary }) => ({
    id: 'discovery-run-1',
    nextAttemptAt,
    summary,
  }));
  const service = createLibraryDiscoveryRediscoveryService({
    createDiscoveryRun,
    getNow: () => new Date('2026-05-01T00:00:00.000Z'),
    libraryDiscoveryRequestStore: {
      getDownloadRecoveryRediscoveryState: async () => null,
      markDownloadRecoveryRediscoveryExhausted: async () => null,
      scheduleDownloadRecoveryRediscovery,
    },
  });

  const result = await service.scheduleDownloadRecoveryRediscovery({
    failedCandidateId: 'candidate-1',
    failureReason: 'Download enqueue failed.',
    metadataReleaseId: 'release-1',
    operationRunId: 'source-run-1',
    sourceSearchId: 'search-1',
  });

  assert.deepEqual(scheduleDownloadRecoveryRediscovery.mock.calls[0].arguments[0], {
    failureReason: 'Download enqueue failed.',
    maxResearchAttemptCount: 2,
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    searchAttemptCount: 1,
    sourceOperationRunId: 'source-run-1',
    sourceSearchId: 'search-1',
    triggeredByFailedCandidateId: 'candidate-1',
  });
  assert.equal(createDiscoveryRun.mock.callCount(), 1);
  assert.equal(createDiscoveryRun.mock.calls[0].arguments[0].nextAttemptAt, '2026-05-01T02:00:00.000Z');
  assert.equal(createDiscoveryRun.mock.calls[0].arguments[0].summary.triggerSource, 'download_recovery');
  assert.deepEqual(result, {
    discoveryRunId: 'discovery-run-1',
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    reason: 'rediscovery_scheduled',
    researchAttemptCount: 1,
    scheduled: true,
    searchAttemptCount: 1,
  });
});

test('scheduleDownloadRecoveryRediscovery does not create a run without a schedulable request', async (t) => {
  const createDiscoveryRun = t.mock.fn(async () => {
    throw new Error('run should not be created');
  });
  const service = createLibraryDiscoveryRediscoveryService({
    createDiscoveryRun,
    libraryDiscoveryRequestStore: {
      getDownloadRecoveryRediscoveryState: async () => null,
      markDownloadRecoveryRediscoveryExhausted: async () => null,
      scheduleDownloadRecoveryRediscovery: async () => null,
    },
  });

  const result = await service.scheduleDownloadRecoveryRediscovery({
    failedCandidateId: 'candidate-1',
    metadataReleaseId: 'release-1',
  });

  assert.equal(createDiscoveryRun.mock.callCount(), 0);
  assert.deepEqual(result, {
    metadataReleaseId: 'release-1',
    reason: 'rediscovery_not_scheduled',
    scheduled: false,
  });
});

test('scheduleDownloadRecoveryRediscovery returns pending state without notifying when rediscovery is already delayed', async (t) => {
  const onDownloadRecoveryExhaustedFn = t.mock.fn(async () => {});
  const createDiscoveryRun = t.mock.fn(async () => {
    throw new Error('run should not be created');
  });
  const service = createLibraryDiscoveryRediscoveryService({
    createDiscoveryRun,
    getNow: () => new Date('2026-05-01T00:00:00.000Z'),
    libraryDiscoveryRequestStore: {
      getDownloadRecoveryRediscoveryState: async () => ({
        evidence: {
          downloadRecoveryRediscovery: {
            nextSearchAfter: '2026-05-01T01:00:00.000Z',
          },
        },
        metadataReleaseId: 'release-1',
        nextSearchAfter: '2026-05-01T01:00:00.000Z',
        requestStatus: 'ready',
        researchAttemptCount: 2,
        searchAttemptCount: 1,
      }),
      markDownloadRecoveryRediscoveryExhausted: async () => {
        throw new Error('pending rediscovery must not be marked exhausted');
      },
      scheduleDownloadRecoveryRediscovery: async () => null,
    },
    onDownloadRecoveryExhaustedFn,
  });

  const result = await service.scheduleDownloadRecoveryRediscovery({
    failedCandidateId: 'candidate-1',
    metadataReleaseId: 'release-1',
  });

  assert.equal(createDiscoveryRun.mock.callCount(), 0);
  assert.equal(onDownloadRecoveryExhaustedFn.mock.callCount(), 0);
  assert.deepEqual(result, {
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T01:00:00.000Z',
    reason: 'rediscovery_already_pending',
    researchAttemptCount: 2,
    scheduled: false,
    searchAttemptCount: 1,
  });
});

test('scheduleDownloadRecoveryRediscovery marks and notifies final exhaustion after research budget is spent', async (t) => {
  const onDownloadRecoveryExhaustedFn = t.mock.fn(async () => {});
  const createDiscoveryRun = t.mock.fn(async () => {
    throw new Error('run should not be created');
  });
  const markDownloadRecoveryRediscoveryExhausted = t.mock.fn(async () => ({
    artistName: 'Autechre',
    blockedReason: 'download_recovery_exhausted',
    metadataReleaseId: 'release-1',
    releaseTitle: 'Amber',
    requestStatus: 'blocked',
    researchAttemptCount: 2,
  }));
  const service = createLibraryDiscoveryRediscoveryService({
    createDiscoveryRun,
    libraryDiscoveryRequestStore: {
      getDownloadRecoveryRediscoveryState: async () => ({
        metadataReleaseId: 'release-1',
        requestStatus: 'ready',
        researchAttemptCount: 2,
      }),
      markDownloadRecoveryRediscoveryExhausted,
      scheduleDownloadRecoveryRediscovery: async () => null,
    },
    onDownloadRecoveryExhaustedFn,
  });

  const result = await service.scheduleDownloadRecoveryRediscovery({
    failedCandidateId: 'candidate-1',
    failureReason: 'Download enqueue failed.',
    metadataReleaseId: 'release-1',
    operationRunId: 'run-1',
    sourceSearchId: 'search-1',
  });

  assert.equal(createDiscoveryRun.mock.callCount(), 0);
  assert.deepEqual(markDownloadRecoveryRediscoveryExhausted.mock.calls[0].arguments[0], {
    failureReason: 'Download enqueue failed.',
    maxResearchAttemptCount: 2,
    metadataReleaseId: 'release-1',
    sourceOperationRunId: 'run-1',
    sourceSearchId: 'search-1',
    triggeredByFailedCandidateId: 'candidate-1',
  });
  assert.equal(onDownloadRecoveryExhaustedFn.mock.callCount(), 1);
  assert.deepEqual(onDownloadRecoveryExhaustedFn.mock.calls[0].arguments[0], {
    artistName: 'Autechre',
    maxResearchAttemptCount: 2,
    metadataReleaseId: 'release-1',
    releaseTitle: 'Amber',
    researchAttemptCount: 2,
  });
  assert.deepEqual(result, {
    exhausted: true,
    metadataReleaseId: 'release-1',
    reason: 'rediscovery_exhausted',
    researchAttemptCount: 2,
    scheduled: false,
  });
});

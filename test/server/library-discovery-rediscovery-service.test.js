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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateRecoveryService } from '../../src/server/import-candidates/import-candidate-recovery-service.js';

test('import candidate recovery promotes the next scoped candidate and records a follow-up run when requested', async (t) => {
  const incrementImportCandidateDownloadAttemptCountFn = t.mock.fn(async () => ({
    id: 'failed-candidate',
    downloadAttemptCount: 1,
    normalizedPayload: {
      requestOwnership: {
        metadataReleaseId: 'release-1',
      },
    },
    sourceSearchId: 'search-1',
  }));
  const findNextCandidateForRecoveryFn = t.mock.fn(async () => ({
    id: 'next-candidate',
  }));
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
  }));
  const createRecoveryExecutionRun = t.mock.fn(async ({ summary }) => ({
    id: 'recovery-run-1',
    summary,
  }));
  const service = createImportCandidateRecoveryService({
    createRecoveryExecutionRun,
    findNextCandidateForRecoveryFn,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      normalizedPayload: {
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn,
    promoteImportCandidateForRecoveryFn,
  });

  const result = await service.handleImportCandidateDownloadFailure({
    failedCandidateId: 'failed-candidate',
    failureReason: 'Download enqueue failed.',
    operationRunId: 'source-run-1',
    scheduleFollowUpRun: true,
  });

  assert.deepEqual(findNextCandidateForRecoveryFn.mock.calls[0].arguments[0], {
    excludeCandidateId: 'failed-candidate',
    maxDownloadAttemptCount: 3,
    metadataReleaseId: 'release-1',
    sourceSearchId: 'search-1',
  });
  assert.deepEqual(promoteImportCandidateForRecoveryFn.mock.calls[0].arguments[0], {
    importCandidateId: 'next-candidate',
    maxDownloadAttemptCount: 3,
    reason: 'Download enqueue failed.',
    triggeredByFailedCandidateId: 'failed-candidate',
  });
  assert.equal(createRecoveryExecutionRun.mock.callCount(), 1);
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].requestedCandidateCount, 1);
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].summary.recoveryCascade.nextCandidateId, 'next-candidate');
  assert.deepEqual(result, {
    attemptedCandidateId: 'next-candidate',
    failedAttemptCount: 1,
    failedCandidateId: 'failed-candidate',
    metadataReleaseId: 'release-1',
    nextCandidateId: 'next-candidate',
    reason: 'candidate_promoted',
    recovered: true,
    recoveryRunId: 'recovery-run-1',
    sourceSearchId: 'search-1',
  });
});

test('import candidate recovery reports exhaustion when no scoped candidate remains', async (t) => {
  const createRecoveryExecutionRun = t.mock.fn(async () => ({
    id: 'unexpected-run',
  }));
  const service = createImportCandidateRecoveryService({
    createRecoveryExecutionRun,
    findNextCandidateForRecoveryFn: async () => null,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      id: 'failed-candidate',
      downloadAttemptCount: 3,
      sourceSearchId: 'search-1',
    }),
  });

  const result = await service.handleImportCandidateDownloadFailure({
    failedCandidateId: 'failed-candidate',
    scheduleFollowUpRun: true,
  });

  assert.equal(createRecoveryExecutionRun.mock.callCount(), 0);
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'no_recovery_candidate_available');
  assert.equal(result.failedAttemptCount, 3);
});

test('import candidate recovery schedules rediscovery when candidate cascade is exhausted', async (t) => {
  const scheduleDownloadRecoveryRediscovery = t.mock.fn(async () => ({
    discoveryRunId: 'discovery-run-1',
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    reason: 'rediscovery_scheduled',
    researchAttemptCount: 1,
    scheduled: true,
    searchAttemptCount: 1,
  }));
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn: async () => null,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      normalizedPayload: {
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      id: 'failed-candidate',
      downloadAttemptCount: 3,
      normalizedPayload: {
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    scheduleDownloadRecoveryRediscovery,
  });

  const result = await service.handleImportCandidateDownloadFailure({
    failedCandidateId: 'failed-candidate',
    failureReason: 'Download enqueue failed.',
    operationRunId: 'source-run-1',
    scheduleFollowUpRun: true,
  });

  assert.deepEqual(scheduleDownloadRecoveryRediscovery.mock.calls[0].arguments[0], {
    failedCandidateId: 'failed-candidate',
    failureReason: 'Download enqueue failed.',
    metadataReleaseId: 'release-1',
    operationRunId: 'source-run-1',
    sourceSearchId: 'search-1',
  });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'rediscovery_scheduled');
  assert.equal(result.rediscovery.discoveryRunId, 'discovery-run-1');
});

test('import candidate recovery schedules delayed same-candidate retry for rejected transfers', async (t) => {
  const createRecoveryExecutionRun = t.mock.fn(async ({ nextAttemptAt, summary }) => ({
    id: 'retry-run-1',
    nextAttemptAt,
    summary,
  }));
  const retryImportCandidateDownload = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: {
      id: importCandidateId,
    },
  }));
  const service = createImportCandidateRecoveryService({
    createRecoveryExecutionRun,
    getNow: () => new Date('2026-05-01T00:00:00.000Z'),
    getImportCandidate: async () => ({
      id: 'candidate-rejected',
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      id: 'candidate-rejected',
      downloadAttemptCount: 1,
      sourceSearchId: 'search-1',
    }),
    retryImportCandidateDownload,
  });

  const result = await service.handleImportCandidateRejectedTransfer({
    failedCandidateId: 'candidate-rejected',
    failureReason: 'Remote peer rejected the transfer.',
    operationRunId: 'run-1',
    scheduleFollowUpRun: true,
  });

  assert.equal(retryImportCandidateDownload.mock.callCount(), 1);
  assert.equal(createRecoveryExecutionRun.mock.callCount(), 1);
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].nextAttemptAt, '2026-05-01T00:10:00.000Z');
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].summary.recoveryCascade.reason, 'retry_rejected_transfer');
  assert.equal(result.retrySameCandidate, true);
  assert.equal(result.nextCandidateId, 'candidate-rejected');
  assert.equal(result.retryAt, '2026-05-01T00:10:00.000Z');
});

test('import candidate recovery cascades rejected transfers after retry budget is exhausted', async (t) => {
  const markImportCandidateDownloadFailed = t.mock.fn(async () => ({
    candidate: {
      id: 'candidate-rejected',
      status: 'failed',
    },
  }));
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
  }));
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn: async () => ({
      id: 'candidate-next',
    }),
    getImportCandidate: async () => ({
      id: 'candidate-rejected',
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      id: 'candidate-rejected',
      downloadAttemptCount: 3,
      sourceSearchId: 'search-1',
    }),
    markImportCandidateDownloadFailed,
    promoteImportCandidateForRecoveryFn,
    retryImportCandidateDownload: t.mock.fn(async () => {
      throw new Error('retry should not run after exhaustion');
    }),
  });

  const result = await service.handleImportCandidateRejectedTransfer({
    failedCandidateId: 'candidate-rejected',
    failureReason: 'Remote peer rejected the transfer.',
  });

  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(promoteImportCandidateForRecoveryFn.mock.callCount(), 1);
  assert.equal(result.retrySameCandidate, undefined);
  assert.equal(result.recovered, true);
  assert.equal(result.nextCandidateId, 'candidate-next');
});

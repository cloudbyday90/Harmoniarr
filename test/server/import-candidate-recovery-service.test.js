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

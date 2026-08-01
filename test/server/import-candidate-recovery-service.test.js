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
        discoveryScope: {
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
    terminalOutcome: 'download_failed',
  });
});

test('import candidate recovery skips below-profile matches before promoting next acceptable match', async (t) => {
  const candidates = new Map([
    ['candidate-mp3', {
      id: 'candidate-mp3',
      normalizedPayload: {
        bitrateKbps: 320,
        extensions: ['mp3'],
      },
    }],
    ['candidate-flac', {
      id: 'candidate-flac',
      normalizedPayload: {
        extensions: ['flac'],
      },
    }],
  ]);
  const findNextCandidateForRecoveryFn = t.mock.fn(async ({ excludeCandidateIds = [] }) => {
    const excluded = new Set(excludeCandidateIds);
    if (!excluded.has('candidate-mp3')) return candidates.get('candidate-mp3');
    if (!excluded.has('candidate-flac')) return candidates.get('candidate-flac');
    return null;
  });
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
  }));
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      normalizedPayload: {
        musicQueue: {
          profileCode: 'lossless_archive',
        },
        discoveryScope: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      id: 'failed-candidate',
      downloadAttemptCount: 1,
      normalizedPayload: {
        musicQueue: {
          profileCode: 'lossless_archive',
        },
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    promoteImportCandidateForRecoveryFn,
    qualityPolicyService: {
      evaluateQualityEvidence: ({ candidate }) => candidate.normalizedPayload.extensions.includes('flac')
        ? { autoDownloadEligible: true, code: 'accepted', formats: ['flac'] }
        : { autoDownloadEligible: false, code: 'below_minimum', formats: ['mp3'] },
    },
  });

  const result = await service.handleImportCandidateDownloadFailure({
    failedCandidateId: 'failed-candidate',
    failureReason: 'Download enqueue failed.',
  });

  assert.equal(findNextCandidateForRecoveryFn.mock.callCount(), 2);
  assert.deepEqual(findNextCandidateForRecoveryFn.mock.calls[1].arguments[0].excludeCandidateIds, [
    'failed-candidate',
    'candidate-mp3',
  ]);
  assert.deepEqual(promoteImportCandidateForRecoveryFn.mock.calls[0].arguments[0], {
    importCandidateId: 'candidate-flac',
    maxDownloadAttemptCount: 3,
    reason: 'Download enqueue failed.',
    triggeredByFailedCandidateId: 'failed-candidate',
  });
  assert.equal(result.recovered, true);
  assert.equal(result.nextCandidateId, 'candidate-flac');
  assert.equal(result.skippedCandidateCount, 1);
  assert.deepEqual(result.skippedCandidates, [{
    candidateId: 'candidate-mp3',
    formats: ['mp3'],
    qualityCode: 'below_minimum',
    reason: 'quality_below_minimum',
  }]);
});

test('import candidate recovery fails quality-blocked downloads and promotes the next scoped match', async (t) => {
  const markImportCandidateQualityFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: {
      id: importCandidateId,
      downloadAttemptCount: 0,
      normalizedPayload: {
        musicQueue: {
          profileCode: 'lossless_archive',
        },
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    },
  }));
  const incrementImportCandidateDownloadAttemptCountFn = t.mock.fn(async () => ({
    id: 'failed-candidate',
    downloadAttemptCount: 1,
    normalizedPayload: {
      musicQueue: {
        profileCode: 'lossless_archive',
      },
      requestOwnership: {
        metadataReleaseId: 'release-1',
      },
    },
    sourceSearchId: 'search-1',
  }));
  const findNextCandidateForRecoveryFn = t.mock.fn(async () => ({
    id: 'next-candidate',
    normalizedPayload: {
      extensions: ['flac'],
    },
  }));
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
  }));
  const createRecoveryExecutionRun = t.mock.fn(async ({ summary }) => ({
    id: 'quality-recovery-run-1',
    summary,
  }));
  const service = createImportCandidateRecoveryService({
    createRecoveryExecutionRun,
    findNextCandidateForRecoveryFn,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      normalizedPayload: {
        musicQueue: {
          profileCode: 'lossless_archive',
        },
        requestOwnership: {
          metadataReleaseId: 'release-1',
        },
      },
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn,
    markImportCandidateQualityFailed,
    promoteImportCandidateForRecoveryFn,
    qualityPolicyService: {
      evaluateQualityEvidence: () => ({ autoDownloadEligible: true, code: 'accepted', formats: ['flac'] }),
    },
  });

  const result = await service.handleImportCandidateQualityFailure({
    failedCandidateId: 'failed-candidate',
    failureReason: '1 file did not pass verified lossless checks before automatic add.',
    operationRunId: 'apply-run-1',
    scheduleFollowUpRun: true,
  });

  assert.deepEqual(markImportCandidateQualityFailed.mock.calls[0].arguments[0], {
    importCandidateId: 'failed-candidate',
    qualityLabel: 'quality_blocked',
    qualityWeight: 0,
    reason: '1 file did not pass verified lossless checks before automatic add.',
  });
  assert.deepEqual(findNextCandidateForRecoveryFn.mock.calls[0].arguments[0], {
    excludeCandidateId: 'failed-candidate',
    maxDownloadAttemptCount: 3,
    metadataReleaseId: 'release-1',
    sourceSearchId: 'search-1',
  });
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].summary.recoveryCascade.reason, 'quality_stop_recovery_cascade');
  assert.equal(createRecoveryExecutionRun.mock.calls[0].arguments[0].summary.recoveryCascade.sourceOperationRunId, 'apply-run-1');
  assert.equal(result.recovered, true);
  assert.equal(result.nextCandidateId, 'next-candidate');
  assert.equal(result.recoveryRunId, 'quality-recovery-run-1');
});

test('import candidate quality recovery keeps the release stopped when no quality-eligible successor remains', async (t) => {
  const markImportCandidateQualityFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: {
      id: importCandidateId,
      downloadAttemptCount: 0,
      normalizedPayload: {
        musicQueue: { profileCode: 'lossless_archive' },
        requestOwnership: { metadataReleaseId: 'release-1' },
      },
      sourceSearchId: 'search-1',
    },
  }));
  const incrementImportCandidateDownloadAttemptCountFn = t.mock.fn(async () => ({
    id: 'failed-candidate',
    downloadAttemptCount: 1,
    normalizedPayload: {
      musicQueue: { profileCode: 'lossless_archive' },
      requestOwnership: { metadataReleaseId: 'release-1' },
    },
    sourceSearchId: 'search-1',
  }));
  const createRecoveryExecutionRun = t.mock.fn(async () => ({ id: 'unexpected-recovery-run' }));
  const scheduleDownloadRecoveryRediscovery = t.mock.fn(async () => ({
    scheduled: true,
  }));
  const service = createImportCandidateRecoveryService({
    createRecoveryExecutionRun,
    findNextCandidateForRecoveryFn: async () => null,
    getImportCandidate: async () => ({
      id: 'failed-candidate',
      normalizedPayload: {
        musicQueue: { profileCode: 'lossless_archive' },
        requestOwnership: { metadataReleaseId: 'release-1' },
      },
      sourceSearchId: 'search-1',
    }),
    incrementImportCandidateDownloadAttemptCountFn,
    markImportCandidateQualityFailed,
    scheduleDownloadRecoveryRediscovery,
  });

  const result = await service.handleImportCandidateQualityFailure({
    failedCandidateId: 'failed-candidate',
    failureReason: 'Downloaded audio did not pass verified lossless checks.',
    operationRunId: 'apply-run-1',
  });

  assert.deepEqual(markImportCandidateQualityFailed.mock.calls[0].arguments[0], {
    importCandidateId: 'failed-candidate',
    qualityLabel: 'quality_blocked',
    qualityWeight: 0,
    reason: 'Downloaded audio did not pass verified lossless checks.',
  });
  assert.equal(createRecoveryExecutionRun.mock.callCount(), 0);
  assert.equal(scheduleDownloadRecoveryRediscovery.mock.callCount(), 0);
  assert.deepEqual(result, {
    attemptedCandidateId: null,
    failedAttemptCount: 1,
    failedCandidateId: 'failed-candidate',
    metadataReleaseId: 'release-1',
    nextCandidateId: null,
    reason: 'no_recovery_candidate_available',
    recovered: false,
    recoveryRunId: null,
    sourceSearchId: 'search-1',
    terminalOutcome: 'quality_failed',
  });
});

test('import candidate recovery records a terminal timeout while promoting the next quality-eligible match', async (t) => {
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({ id: importCandidateId }));
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn: async () => ({ id: 'candidate-next' }),
    getImportCandidate: async () => ({ id: 'candidate-timeout', sourceSearchId: 'search-1' }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      downloadAttemptCount: 1,
      id: 'candidate-timeout',
      sourceSearchId: 'search-1',
    }),
    promoteImportCandidateForRecoveryFn,
  });

  const result = await service.handleImportCandidateDownloadFailure({
    failedCandidateId: 'candidate-timeout',
    failureReason: 'The download did not progress before the timeout.',
    terminalOutcome: 'download_timed_out',
  });

  assert.equal(promoteImportCandidateForRecoveryFn.mock.callCount(), 1);
  assert.equal(result.recovered, true);
  assert.equal(result.terminalOutcome, 'download_timed_out');
});

test('import candidate recovery promotes another match when a completed candidate source disappears', async (t) => {
  const markImportCandidateImportBlocked = t.mock.fn(async () => ({
    candidate: {
      downloadAttemptCount: 0,
      id: 'candidate-missing-source',
      sourceSearchId: 'search-1',
      status: 'failed',
    },
  }));
  const promoteImportCandidateForRecoveryFn = t.mock.fn(async ({ importCandidateId }) => ({ id: importCandidateId }));
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn: async () => ({ id: 'candidate-next' }),
    getImportCandidate: async () => ({
      id: 'candidate-missing-source',
      sourceSearchId: 'search-1',
      status: 'import_pending',
    }),
    incrementImportCandidateDownloadAttemptCountFn: async () => ({
      downloadAttemptCount: 1,
      id: 'candidate-missing-source',
      sourceSearchId: 'search-1',
      status: 'failed',
    }),
    markImportCandidateImportBlocked,
    promoteImportCandidateForRecoveryFn,
  });

  const result = await service.handleImportCandidateImportBlocker({
    canRecover: true,
    failedCandidateId: 'candidate-missing-source',
    failureReason: 'The expected source file is not reachable from the resolved download path.',
  });

  assert.deepEqual(markImportCandidateImportBlocked.mock.calls[0].arguments[0], {
    importCandidateId: 'candidate-missing-source',
    recordSourceFailure: true,
    reason: 'The expected source file is not reachable from the resolved download path.',
  });
  assert.equal(promoteImportCandidateForRecoveryFn.mock.callCount(), 1);
  assert.equal(result.recovered, true);
  assert.equal(result.terminalOutcome, 'source_disappeared');
});

test('import candidate recovery keeps import collisions available for a manual safe-add decision', async (t) => {
  const markImportCandidateImportBlocked = t.mock.fn(async () => ({
    candidate: {
      id: 'candidate-collision',
      sourceSearchId: 'search-1',
      status: 'failed',
    },
  }));
  const findNextCandidateForRecoveryFn = t.mock.fn(async () => {
    throw new Error('a collision must not trigger automatic match selection');
  });
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn,
    getImportCandidate: async () => ({
      id: 'candidate-collision',
      sourceSearchId: 'search-1',
      status: 'import_pending',
    }),
    markImportCandidateImportBlocked,
  });

  const result = await service.handleImportCandidateImportBlocker({
    canRecover: false,
    failedCandidateId: 'candidate-collision',
  });

  assert.deepEqual(markImportCandidateImportBlocked.mock.calls[0].arguments[0], {
    importCandidateId: 'candidate-collision',
    recordSourceFailure: false,
    reason: null,
  });
  assert.equal(findNextCandidateForRecoveryFn.mock.callCount(), 0);
  assert.deepEqual(result, {
    attemptedCandidateId: null,
    failedAttemptCount: null,
    failedCandidateId: 'candidate-collision',
    metadataReleaseId: null,
    nextCandidateId: null,
    reason: 'import_blocker_requires_operator',
    recovered: false,
    recoveryRunId: null,
    requiresOperator: true,
    sourceSearchId: 'search-1',
    terminalOutcome: 'import_blocked',
  });
});

test('import candidate recovery persists an audio-tooling stop without selecting another download', async (t) => {
  const markImportCandidateImportBlocked = t.mock.fn(async () => ({
    candidate: {
      id: 'candidate-media-tooling',
      sourceSearchId: 'search-1',
      status: 'failed',
    },
  }));
  const findNextCandidateForRecoveryFn = t.mock.fn(async () => {
    throw new Error('media-tooling recovery must not select another remote match');
  });
  const service = createImportCandidateRecoveryService({
    findNextCandidateForRecoveryFn,
    getImportCandidate: async () => ({
      id: 'candidate-media-tooling',
      sourceSearchId: 'search-1',
      status: 'import_pending',
    }),
    markImportCandidateImportBlocked,
  });

  const result = await service.handleImportCandidateImportBlocker({
    addBlockerCode: 'media_verification',
    canRecover: false,
    failedCandidateId: 'candidate-media-tooling',
    recoveryReasonCode: 'audio_check_failed',
  });

  assert.deepEqual(markImportCandidateImportBlocked.mock.calls[0].arguments[0], {
    addBlockerCode: 'media_verification',
    importCandidateId: 'candidate-media-tooling',
    recordSourceFailure: false,
    reason: null,
    recoveryReasonCode: 'audio_check_failed',
  });
  assert.equal(findNextCandidateForRecoveryFn.mock.callCount(), 0);
  assert.equal(result.reason, 'environmental_prerequisite_unavailable');
  assert.equal(result.recoveryReasonCode, 'audio_check_failed');
  assert.equal(result.requiresOperator, undefined);
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';

test('createImportCandidateTranscodeWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createImportCandidateTranscodeWorker({
    acquireLease,
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Transcode orchestration is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    }),
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
    requestedCandidateCount: 3,
    runId: 'run-paused',
    transcodeCandidateFileCount: 2,
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
      currentStep: 'Transcode orchestration paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Transcode orchestration is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      requestedCandidateCount: 3,
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('createImportCandidateTranscodeWorker executes transcode preflight for transcode candidates', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const renewLease = t.mock.fn(async () => {});
  const startLeaseHeartbeat = t.mock.fn(() => {});
  const stopLeaseHeartbeat = t.mock.fn(() => {});
  const createOperationRunLeaseHeartbeatFn = t.mock.fn(() => ({
    start: startLeaseHeartbeat,
    stop: stopLeaseHeartbeat,
  }));
  const executeTranscodeCandidate = t.mock.fn(async ({ sourcePath }) => {
    if (sourcePath.endsWith('01.flac')) {
      return {
        mode: 'preflight_only',
        status: 'preflight_passed',
        warnings: [],
      };
    }

    return {
      mode: 'preflight_only',
      status: 'tooling_unavailable',
      warnings: [{
        code: 'media_transcode_execution_tooling_unavailable',
        message: 'ffmpeg unavailable',
      }],
    };
  });

  const worker = createImportCandidateTranscodeWorker({
    acquireLease,
    buildSelectedImportCandidateSummary: async () => ({
      selectedCandidates: [{
        executionStatus: {
          code: 'ready',
        },
        id: 'candidate-1',
      }, {
        executionStatus: {
          code: 'blocked',
        },
        id: 'candidate-2',
      }, {
        executionStatus: {
          code: 'ready_with_warnings',
        },
        id: 'candidate-3',
      }],
    }),
    createOperationRunLeaseHeartbeatFn,
    executeTranscodeCandidate,
    isCancellationRequested: async () => false,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    previewImportCandidateApply: async ({ importCandidateId }) => ({
      files: importCandidateId === 'candidate-1'
        ? [{
          sourceFile: {
            path: '/music/01.flac',
          },
          transcodePlan: {
            recommendedAction: 'transcode_candidate',
          },
        }, {
          sourceFile: {
            path: '/music/keep.flac',
          },
          transcodePlan: {
            recommendedAction: 'keep_original',
          },
        }]
        : [{
          sourceFile: {
            path: '/music/03.flac',
          },
          transcodePlan: {
            recommendedAction: 'transcode_candidate',
          },
        }],
    }),
    releaseLease,
    renewLease,
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
    requestedCandidateCount: 3,
    runId: 'transcode-run-1',
    transcodeCandidateFileCount: 2,
  });

  const completionArgs = await completion;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(createOperationRunLeaseHeartbeatFn.mock.callCount(), 1);
  assert.equal(startLeaseHeartbeat.mock.callCount(), 1);
  assert.equal(stopLeaseHeartbeat.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(executeTranscodeCandidate.mock.callCount(), 2);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.equal(completionArgs.runId, 'transcode-run-1');
  assert.equal(completionArgs.summary.requestedCandidateCount, 3);
  assert.equal(completionArgs.summary.reviewedCandidateCount, 2);
  assert.equal(completionArgs.summary.blockedCandidateCount, 1);
  assert.equal(completionArgs.summary.transcodeCandidateFileCount, 2);
  assert.equal(completionArgs.summary.passedPreflightCount, 1);
  assert.equal(completionArgs.summary.toolingUnavailableCount, 1);
  assert.equal(completionArgs.summary.failedPreflightCount, 0);
  assert.equal(completionArgs.summary.notRequiredCount, 0);
  assert.equal(completionArgs.summary.warningCount, 1);
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'transcode-run-1',
    status: 'completed',
  });
});

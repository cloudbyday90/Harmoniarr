import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';

test('createImportCandidateMediaInspectionWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createImportCandidateMediaInspectionWorker({
    acquireLease,
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Media inspection is paused while the restore maintenance lock is active.',
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
    requestedCandidateCount: 5,
    runId: 'run-paused',
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
      currentStep: 'Media inspection paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Media inspection is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      requestedCandidateCount: 5,
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('createImportCandidateMediaInspectionWorker inspects selected candidates and records summary counts', async (t) => {
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
  const previewImportCandidateApply = t.mock.fn(async ({ importCandidateId }) => ({
    files: importCandidateId === 'candidate-1'
      ? [{
        fileId: 'candidate-1-file-1',
        filename: 'alpha.flac',
        inspection: {
          warnings: [{
            code: 'media_inspection_no_audio_stream',
            message: 'No audio stream',
          }],
        },
      }, {
        fileId: 'candidate-1-file-2',
        filename: 'beta.flac',
        inspection: {
          warnings: [{
            code: 'media_inspection_probe_failed',
            message: 'Probe failed',
          }],
        },
      }]
      : [{
        inspection: {
          warnings: [],
        },
      }],
  }));

  const worker = createImportCandidateMediaInspectionWorker({
    acquireLease,
    buildSelectedImportCandidateSummary: async () => ({
      selectedCandidates: [{
        executionStatus: {
          code: 'ready',
        },
        folderPath: '/private/staging/Boards of Canada/Geogaddi',
        id: 'candidate-1',
        username: 'remote-peer',
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
    isCancellationRequested: async () => false,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    previewImportCandidateApply,
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
    runId: 'inspection-run-1',
  });

  const completionArgs = await completion;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(createOperationRunLeaseHeartbeatFn.mock.callCount(), 1);
  assert.equal(startLeaseHeartbeat.mock.callCount(), 1);
  assert.equal(stopLeaseHeartbeat.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(previewImportCandidateApply.mock.callCount(), 2);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.equal(completionArgs.runId, 'inspection-run-1');
  assert.equal(completionArgs.summary.requestedCandidateCount, 3);
  assert.equal(completionArgs.summary.inspectedCandidateCount, 2);
  assert.equal(completionArgs.summary.blockedCandidateCount, 1);
  assert.equal(completionArgs.summary.inspectedFileCount, 3);
  assert.equal(completionArgs.summary.warningCount, 2);
  assert.equal(completionArgs.summary.inspectionUnavailableCount, 1);
  assert.deepEqual(completionArgs.summary.inspectionDiagnostics, [{
    candidateId: 'candidate-1',
    code: 'media_inspection_no_audio_stream',
    fileId: 'candidate-1-file-1',
    filename: 'alpha.flac',
    folderPath: '/private/staging/Boards of Canada/Geogaddi',
    message: 'No audio stream',
    username: 'remote-peer',
  }, {
    candidateId: 'candidate-1',
    code: 'media_inspection_probe_failed',
    fileId: 'candidate-1-file-2',
    filename: 'beta.flac',
    folderPath: '/private/staging/Boards of Canada/Geogaddi',
    message: 'Probe failed',
    username: 'remote-peer',
  }]);
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'inspection-run-1',
    status: 'completed',
  });
});

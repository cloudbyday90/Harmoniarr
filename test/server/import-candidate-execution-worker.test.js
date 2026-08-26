import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';

test('import execution worker enqueues ready candidates and persists per-item outcomes', async (t) => {
  const markImportCandidateDownloading = t.mock.fn(async () => ({}));
  const recordConfirmedTransfers = t.mock.fn(async () => []);
  const replaceImportExecutionRunItems = t.mock.fn(async () => []);
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  const markRunStarted = t.mock.fn(async () => {});
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async () => {
    resolveCompleted();
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary: async () => ({
      counts: {
        blocked: 1,
        ready: 1,
        readyWithWarnings: 0,
        totalSelected: 2,
      },
      selectedCandidates: [{
        executionStatus: {
          code: 'ready',
          message: 'Ready for download enqueue.',
        },
        fileCount: 1,
        folderPath: 'Autechre/Amber',
        id: 'candidate-1',
        lockedFileCount: 0,
        planning: {
          libraryFolderPath: '/music/Autechre/Amber',
          sourceFolderPath: '/downloads/Autechre/Amber',
          stagingFolderPath: '/staging/import-candidates/candidate-1/Autechre/Amber',
        },
        selectedAt: '2026-04-30T12:00:00.000Z',
        sourceProvider: 'slskd',
        sourceSearchId: 'search-1',
        totalSizeBytes: 123456,
        username: 'source-user',
      }, {
        executionStatus: {
          code: 'blocked',
          message: 'Explicit path mapping is still required.',
        },
        fileCount: 1,
        folderPath: 'Blocked/Candidate',
        id: 'candidate-2',
        lockedFileCount: 0,
        planning: {
          primaryBlocker: 'Explicit path mapping is still required.',
        },
        selectedAt: '2026-04-30T12:00:00.000Z',
        sourceProvider: 'slskd',
        sourceSearchId: 'search-2',
        totalSizeBytes: 10,
        username: 'blocked-user',
      }],
    }),
    enqueueDownloads: t.mock.fn(async () => ({
      enqueued: [{
        id: 'transfer-1',
        filename: 'Autechre\\Amber\\01 Foil.flac',
        state: 'Queued, Remotely',
        username: 'source-user',
      }],
      failed: [],
    })),
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: false,
        rawPayload: {
          filename: 'Autechre\\Amber\\01 Foil.flac',
        },
        sizeBytes: 123456,
      }],
    }),
    markImportCandidateDownloading,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted,
    recordConfirmedTransfers,
    releaseLease: async () => {},
    replaceImportExecutionRunItems,
    updateImportExecutionRunItem,
  });

  await worker.startWorkerRun({
    requestedCandidateCount: 2,
    runId: 'run-1',
  });

  await completed;

  assert.equal(replaceImportExecutionRunItems.mock.callCount(), 1);
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 3);
  assert.equal(markImportCandidateDownloading.mock.callCount(), 1);
  assert.deepEqual(recordConfirmedTransfers.mock.calls[0].arguments, [{
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    transfers: [{
      id: 'transfer-1',
      filename: 'Autechre\\Amber\\01 Foil.flac',
      state: 'Queued, Remotely',
      username: 'source-user',
    }],
  }]);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.equal(
    updateImportExecutionRunItem.mock.calls[1].arguments[0]
      .planningSnapshot.execution.diagnostics.downloadAcceptance.code,
    'provider_accepted',
  );
  assert.equal(
    updateImportExecutionRunItem.mock.calls[2].arguments[0]
      .planningSnapshot.execution.diagnostics.downloadAcceptance.code,
    'planning_blocked',
  );
  assert.deepEqual(markRunCompleted.mock.calls[0].arguments, [{
    runId: 'run-1',
    summary: {
      blockedCount: 1,
      awaitingConfirmationCount: 0,
      currentStep: 'Download enqueue complete',
      executionMode: 'download_enqueue',
      processedCandidateCount: 2,
      queueFailedCount: 0,
      queuedCount: 1,
      queuedWithWarningsCount: 0,
      readyCount: 1,
      readyWithWarningsCount: 0,
      recoveredCandidateCount: 0,
      requestedCandidateCount: 2,
      totalSelected: 2,
    },
  }]);
});

test('import execution worker limits a manually started run to its selected candidate', async (t) => {
  const selectedCandidate = {
    executionStatus: {
      code: 'ready',
      message: 'Ready for download enqueue.',
    },
    fileCount: 1,
    folderPath: 'Autechre/Amber',
    id: 'candidate-amber',
    lockedFileCount: 0,
    planning: {
      libraryFolderPath: '/music/Autechre/Amber',
      sourceFolderPath: '/downloads/Autechre/Amber',
      stagingFolderPath: '/staging/import-candidates/candidate-amber/Autechre/Amber',
    },
    selectedAt: '2026-04-30T12:00:00.000Z',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-amber',
    totalSizeBytes: 123456,
    username: 'source-user',
  };
  const buildSelectedImportCandidateSummary = t.mock.fn(async () => ({
    counts: {
      blocked: 0,
      ready: 1,
      readyWithWarnings: 0,
      totalSelected: 1,
    },
    selectedCandidates: [selectedCandidate],
  }));
  const enqueueDownloads = t.mock.fn(async () => ({
    enqueued: [{
      filename: 'Autechre\\Amber\\01 Foil.flac',
      id: 'transfer-amber',
      state: 'Queued, Remotely',
      username: 'source-user',
    }],
    failed: [],
  }));
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary,
    enqueueDownloads,
    getImportCandidate: async ({ importCandidateId }) => ({
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: false,
        rawPayload: { filename: 'Autechre\\Amber\\01 Foil.flac' },
        sizeBytes: 123456,
      }],
      id: importCandidateId,
    }),
    markImportCandidateDownloading: async () => {},
    markRunCompleted: async () => { resolveCompleted(); },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    recordConfirmedTransfers: async () => [],
    releaseLease: async () => {},
    replaceImportExecutionRunItems: async () => [],
    updateImportExecutionRunItem: async () => null,
  });

  await worker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: 'run-amber',
    selectedCandidateId: 'candidate-amber',
  });
  await completed;

  assert.deepEqual(buildSelectedImportCandidateSummary.mock.calls[0].arguments, [{
    candidateIds: ['candidate-amber'],
    limit: 1000,
  }]);
  assert.equal(enqueueDownloads.mock.callCount(), 1);
  assert.equal(enqueueDownloads.mock.calls[0].arguments[0].username, 'source-user');
});

test('import execution worker leaves a run untouched when another worker holds its lease', async (t) => {
  const leaseUnavailable = Object.assign(
    new Error('Operation run lease is currently held by another worker'),
    { code: 'operation_run_lease_unavailable' },
  );
  const acquireLease = t.mock.fn(async () => {
    throw leaseUnavailable;
  });
  const markRunFailed = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createImportCandidateExecutionWorker({
    acquireLease,
    markRunFailed,
    markRunStarted,
    releaseLease,
  });

  await worker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: 'run-held-by-another-worker',
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(releaseLease.mock.callCount(), 0);
});

test('import execution worker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const enqueueDownloads = t.mock.fn(async () => ({
    enqueued: [],
    failed: [],
  }));
  const isCancellationRequested = t.mock.fn(async () => ({
    kind: 'paused',
    nextRetryAt: '2026-05-04T12:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Import execution is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
  }));
  const markImportCandidateDownloadFailed = t.mock.fn(async () => ({}));
  const markImportCandidateDownloading = t.mock.fn(async () => ({}));
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const replaceImportExecutionRunItems = t.mock.fn(async () => []);
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  const worker = createImportCandidateExecutionWorker({
    acquireLease,
    enqueueDownloads,
    getImportCandidate: t.mock.fn(async () => null),
    isCancellationRequested,
    markImportCandidateDownloadFailed,
    markImportCandidateDownloading,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    releaseLease,
    replaceImportExecutionRunItems,
    updateImportExecutionRunItem,
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
    requestedCandidateCount: 4,
    runId: 'run-paused',
  });

  const pausedArgs = await paused;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(markRunStarted.mock.callCount(), 0);
  assert.equal(replaceImportExecutionRunItems.mock.callCount(), 0);
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 0);
  assert.equal(enqueueDownloads.mock.callCount(), 0);
  assert.equal(markImportCandidateDownloading.mock.callCount(), 0);
  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 0);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(markRunCancelled.mock.callCount(), 0);
  assert.deepEqual(pausedArgs, {
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    runId: 'run-paused',
    summary: {
      currentStep: 'Download enqueue paused by maintenance lock',
      executionMode: 'download_enqueue',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Import execution is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      requestedCandidateCount: 4,
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('import execution worker cascades all-failed enqueue results to the next recovery candidate', async (t) => {
  const initialCandidate = {
    executionStatus: {
      code: 'ready',
      message: 'Ready for download enqueue.',
    },
    fileCount: 1,
    folderPath: 'Autechre/Amber',
    id: 'candidate-1',
    lockedFileCount: 0,
    planning: {
      libraryFolderPath: '/music/Autechre/Amber',
      sourceFolderPath: '/downloads/Autechre/Amber',
      stagingFolderPath: '/staging/import-candidates/candidate-1/Autechre/Amber',
    },
    selectedAt: '2026-04-30T12:00:00.000Z',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    totalSizeBytes: 123456,
    username: 'source-user',
  };
  const recoveryCandidate = {
    ...initialCandidate,
    id: 'candidate-2',
    planning: {
      ...initialCandidate.planning,
      stagingFolderPath: '/staging/import-candidates/candidate-2/Autechre/Amber',
    },
    username: 'recovery-user',
  };
  let summaryCallCount = 0;
  const buildSelectedImportCandidateSummary = t.mock.fn(async () => {
    summaryCallCount += 1;
    return {
      counts: {
        blocked: 0,
        ready: 1,
        readyWithWarnings: 0,
        totalSelected: 1,
      },
      selectedCandidates: summaryCallCount === 1
        ? [initialCandidate]
        : [recoveryCandidate],
    };
  });
  const enqueueDownloads = t.mock.fn(async ({ username }) => username === 'source-user'
    ? {
        enqueued: [],
        failed: ['Autechre\\Amber\\01 Foil.flac'],
      }
    : {
        enqueued: [{
          id: 'transfer-2',
          filename: 'Autechre\\Amber\\01 Foil.flac',
          state: 'Queued, Remotely',
          username,
        }],
        failed: [],
      });
  const markImportCandidateDownloadFailed = t.mock.fn(async () => ({}));
  const markImportCandidateDownloading = t.mock.fn(async () => ({}));
  const recordActivityEventFn = t.mock.fn(async () => {});
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  const upsertImportExecutionRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async (args) => {
    resolveCompleted(args);
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary,
    enqueueDownloads,
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: false,
        rawPayload: {
          filename: 'Autechre\\Amber\\01 Foil.flac',
        },
        sizeBytes: 123456,
      }],
    }),
    handleImportCandidateDownloadFailure: t.mock.fn(async () => ({
      failedCandidateId: 'candidate-1',
      nextCandidateId: 'candidate-2',
      reason: 'candidate_promoted',
      recovered: true,
    })),
    markImportCandidateDownloadFailed,
    markImportCandidateDownloading,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    recordActivityEventFn,
    releaseLease: async () => {},
    replaceImportExecutionRunItems: async () => [],
    updateImportExecutionRunItem,
    upsertImportExecutionRunItem,
  });

  await worker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: 'run-recovery',
  });

  const completedArgs = await completed;

  assert.equal(enqueueDownloads.mock.callCount(), 2);
  assert.equal(enqueueDownloads.mock.calls[0].arguments[0].username, 'source-user');
  assert.equal(enqueueDownloads.mock.calls[1].arguments[0].username, 'recovery-user');
  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(recordActivityEventFn.mock.callCount(), 2);
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].eventType, 'music_queue_match_retrying');
  assert.equal(recordActivityEventFn.mock.calls[1].arguments[0].eventType, 'music_queue_download_started');
  assert.equal(markImportCandidateDownloading.mock.callCount(), 1);
  assert.equal(markImportCandidateDownloading.mock.calls[0].arguments[0].importCandidateId, 'candidate-2');
  assert.equal(upsertImportExecutionRunItem.mock.callCount(), 1);
  assert.equal(upsertImportExecutionRunItem.mock.calls[0].arguments[0].importCandidateId, 'candidate-2');
  const recoveryUpdate = updateImportExecutionRunItem.mock.calls
    .map((call) => call.arguments[0])
    .find((item) => item.planningSnapshot.execution.recovery?.nextCandidateId === 'candidate-2');
  assert.equal(recoveryUpdate.planningSnapshot.execution.recovery.nextCandidateId, 'candidate-2');
  const rejectedUpdate = updateImportExecutionRunItem.mock.calls
    .map((call) => call.arguments[0])
    .find((item) => item.planningSnapshot.execution.diagnostics.downloadAcceptance.code === 'provider_rejected_all_files');
  assert.equal(
    rejectedUpdate
      .planningSnapshot.execution.diagnostics.downloadAcceptance.code,
    'provider_rejected_all_files',
  );
  assert.equal(completedArgs.summary.queueFailedCount, 1);
  assert.equal(completedArgs.summary.queuedCount, 1);
  assert.equal(completedArgs.summary.recoveredCandidateCount, 1);
  assert.equal(completedArgs.summary.processedCandidateCount, 2);
});

test('import execution worker persists no-file diagnostics before provider enqueue', async (t) => {
  const enqueueDownloads = t.mock.fn(async () => ({
    enqueued: [],
    failed: [],
  }));
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary: async () => ({
      counts: {
        blocked: 0,
        ready: 1,
        readyWithWarnings: 0,
        totalSelected: 1,
      },
      selectedCandidates: [{
        executionStatus: {
          code: 'ready',
          message: 'Ready for download enqueue.',
        },
        fileCount: 2,
        folderPath: 'Autechre/Amber',
        id: 'candidate-no-files',
        lockedFileCount: 2,
        planning: {
          libraryFolderPath: '/music/Autechre/Amber',
          sourceFolderPath: '/downloads/Autechre/Amber',
          stagingFolderPath: '/staging/import-candidates/candidate-no-files/Autechre/Amber',
        },
        selectedAt: '2026-04-30T12:00:00.000Z',
        sourceProvider: 'slskd',
        sourceSearchId: 'search-1',
        totalSizeBytes: 123456,
        username: 'source-user',
      }],
    }),
    enqueueDownloads,
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: true,
        sizeBytes: 123456,
      }],
    }),
    markRunCompleted: t.mock.fn(async (args) => {
      resolveCompleted(args);
    }),
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    releaseLease: async () => {},
    replaceImportExecutionRunItems: async () => [],
    updateImportExecutionRunItem,
  });

  await worker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: 'run-no-files',
  });

  const completedArgs = await completed;
  const itemUpdate = updateImportExecutionRunItem.mock.calls[0].arguments[0];

  assert.equal(enqueueDownloads.mock.callCount(), 0);
  assert.equal(itemUpdate.itemStatus, 'blocked');
  assert.equal(itemUpdate.statusMessage, 'No unlocked files are available to enqueue from this candidate.');
  assert.equal(itemUpdate.planningSnapshot.execution.diagnostics.downloadAcceptance.code, 'no_unlocked_files');
  assert.equal(completedArgs.summary.blockedCount, 1);
});

test('import execution worker confirms an interrupted handoff without sending a second provider request', async (t) => {
  const candidate = {
    executionStatus: { code: 'ready', message: 'Ready for download enqueue.' },
    fileCount: 1,
    folderPath: 'Autechre/Amber',
    id: 'candidate-confirmed-handoff',
    lockedFileCount: 0,
    planning: {},
    selectedAt: '2026-08-25T12:00:00.000Z',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-confirmed-handoff',
    totalSizeBytes: 123,
    username: 'source-user',
  };
  const enqueueDownloads = t.mock.fn(async () => ({ enqueued: [], failed: [] }));
  const markImportCandidateDownloading = t.mock.fn(async () => ({}));
  const recordConfirmedTransfers = t.mock.fn(async () => []);
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalSelected: 1 },
      selectedCandidates: [candidate],
    }),
    enqueueDownloads,
    findMatchingTransfers: async () => ({
      allRequestedFilesMatched: true,
      matchedTransfers: [{
        filename: 'Autechre\\Amber\\01 Foil.flac',
        id: 'transfer-confirmed',
        size: 123,
        username: 'source-user',
      }],
      requestedFileCount: 1,
    }),
    getImportCandidate: async () => ({
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: false,
        sizeBytes: 123,
      }],
    }),
    listImportExecutionRunItems: async () => [{
      id: 'run-item-confirmed-handoff',
      importCandidateId: candidate.id,
      itemStatus: 'awaiting_confirmation',
      operationRunId: 'run-confirmed-handoff',
      planningSnapshot: {
        candidate,
        execution: {
          handoff: { state: 'dispatching' },
          requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }],
        },
      },
      position: 1,
      statusMessage: 'Confirming earlier request.',
    }],
    markImportCandidateDownloading,
    markRunCompleted: async (args) => resolveCompleted(args),
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    recordConfirmedTransfers,
    releaseLease: async () => {},
    updateImportExecutionRunItem,
    upsertImportExecutionRunItem: async () => null,
  });

  await worker.startWorkerRun({ requestedCandidateCount: 1, runId: 'run-confirmed-handoff' });
  const completedArgs = await completed;

  assert.equal(enqueueDownloads.mock.callCount(), 0);
  assert.deepEqual(recordConfirmedTransfers.mock.calls[0].arguments, [{
    importCandidateId: candidate.id,
    operationRunId: 'run-confirmed-handoff',
    transfers: [{
      filename: 'Autechre\\Amber\\01 Foil.flac',
      id: 'transfer-confirmed',
      size: 123,
      username: 'source-user',
    }],
  }]);
  assert.equal(markImportCandidateDownloading.mock.callCount(), 1);
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].itemStatus, 'queued');
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.handoff.state, 'confirmed');
  assert.equal(completedArgs.summary.awaitingConfirmationCount, 0);
});

test('import execution worker retains an unconfirmed handoff instead of retrying the provider request', async (t) => {
  const candidate = {
    executionStatus: { code: 'ready', message: 'Ready for download enqueue.' },
    fileCount: 1,
    folderPath: 'Autechre/Amber',
    id: 'candidate-pending-handoff',
    lockedFileCount: 0,
    planning: {},
    selectedAt: '2026-08-25T12:00:00.000Z',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-pending-handoff',
    totalSizeBytes: 123,
    username: 'source-user',
  };
  const enqueueDownloads = t.mock.fn(async () => ({ enqueued: [], failed: [] }));
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => {},
    buildSelectedImportCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalSelected: 1 },
      selectedCandidates: [candidate],
    }),
    enqueueDownloads,
    findMatchingTransfers: async () => ({
      allRequestedFilesMatched: false,
      matchedTransfers: [],
      requestedFileCount: 1,
    }),
    getImportCandidate: async () => ({
      files: [{
        filename: '01 Foil.flac',
        folderPath: 'Autechre/Amber',
        isLocked: false,
        sizeBytes: 123,
      }],
    }),
    listImportExecutionRunItems: async () => [{
      id: 'run-item-pending-handoff',
      importCandidateId: candidate.id,
      itemStatus: 'awaiting_confirmation',
      operationRunId: 'run-pending-handoff',
      planningSnapshot: {
        candidate,
        execution: {
          handoff: { state: 'dispatching' },
          requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }],
        },
      },
      position: 1,
      statusMessage: 'Confirming earlier request.',
    }],
    markRunCompleted: async (args) => resolveCompleted(args),
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    releaseLease: async () => {},
    updateImportExecutionRunItem,
    upsertImportExecutionRunItem: async () => null,
  });

  await worker.startWorkerRun({ requestedCandidateCount: 1, runId: 'run-pending-handoff' });
  const completedArgs = await completed;

  assert.equal(enqueueDownloads.mock.callCount(), 0);
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].itemStatus, 'awaiting_confirmation');
  assert.equal(
    updateImportExecutionRunItem.mock.calls[0].arguments[0]
      .planningSnapshot.execution.diagnostics.downloadAcceptance.code,
    'provider_confirmation_pending',
  );
  assert.equal(completedArgs.summary.awaitingConfirmationCount, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';

function createReadyImportCandidate(overrides = {}) {
  return {
    applyPreview: {
      counts: { totalFiles: 1 },
      summary: { status: 'ready' },
    },
    fileCount: 1,
    folderPath: 'Artist/Album',
    id: 'candidate-ready-1',
    importPendingAt: '2026-04-30T12:00:00.000Z',
    importStatus: { code: 'ready', message: 'Ready.' },
    lockedFileCount: 0,
    planning: {},
    sourceProvider: 'slskd',
    sourceSearchId: 'search-ready-1',
    totalSizeBytes: 50000,
    username: 'source-user',
    ...overrides,
  };
}

function createVerifiedApplyPreview() {
  return {
    counts: { totalFiles: 1 },
    files: [{
      fileId: 'file-ready-1',
      filename: '01 Track.flac',
      inspection: {
        metadata: {
          bitDepth: 16,
          bitRate: 850000,
          channelCount: 2,
          containerFormatName: 'flac',
          primaryAudioCodec: 'flac',
          sampleRate: 44100,
          tags: {
            album: 'Album',
            artist: 'Artist',
            title: 'Track',
          },
        },
        warnings: [],
      },
      status: { code: 'ready', message: 'Ready.' },
    }],
    summary: { status: 'ready' },
  };
}

test('import apply worker applies ready candidates and persists per-item outcomes', async (t) => {
  const markImportCandidateApplied = t.mock.fn(async () => ({}));
  const replaceImportApplyRunItems = t.mock.fn(async () => []);
  const updateImportApplyRunItem = t.mock.fn(async () => null);
  const markRunStarted = t.mock.fn(async () => {});
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async () => {
    resolveCompleted();
  });
  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: t.mock.fn(async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    })),
    buildImportPendingCandidateSummary: async () => ({
      counts: {
        blocked: 1,
        ready: 1,
        readyWithWarnings: 0,
        totalImportPending: 2,
      },
      importPendingCandidates: [{
        applyPreview: {
          counts: {
            totalFiles: 1,
          },
          summary: {
            status: 'ready',
          },
        },
        fileCount: 1,
        folderPath: 'Autechre/Amber',
        id: 'candidate-1',
        importPendingAt: '2026-04-30T12:30:00.000Z',
        importStatus: {
          code: 'ready',
          message: 'Ready for import apply.',
        },
        lockedFileCount: 0,
        planning: {
          libraryFolderPath: '/music/Autechre/Amber',
          sourceFolderPath: '/downloads/Autechre/Amber',
          stagingFolderPath: '/staging/import-candidates/candidate-1/Autechre/Amber',
        },
        sourceProvider: 'slskd',
        sourceSearchId: 'search-1',
        totalSizeBytes: 123456,
        username: 'source-user',
      }, {
        applyPreview: {
          counts: {
            totalFiles: 1,
          },
          summary: {
            status: 'blocked',
          },
        },
        fileCount: 1,
        folderPath: 'Blocked/Candidate',
        id: 'candidate-2',
        importPendingAt: '2026-04-30T12:40:00.000Z',
        importStatus: {
          code: 'blocked',
          message: 'Collision review is required.',
        },
        lockedFileCount: 0,
        planning: {
          primaryBlocker: 'Collision review is required.',
        },
        sourceProvider: 'slskd',
        sourceSearchId: 'search-2',
        totalSizeBytes: 10,
        username: 'blocked-user',
      }],
    }),
    markImportCandidateApplied,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted,
    previewImportCandidateApply: t.mock.fn(async () => ({
      counts: {
        totalFiles: 1,
      },
      files: [],
      summary: {
        status: 'ready',
      },
    })),
    releaseLease: async () => {},
    replaceImportApplyRunItems,
    updateImportApplyRunItem,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 2,
    runId: 'run-apply-1',
  });

  await completed;

  assert.equal(replaceImportApplyRunItems.mock.callCount(), 1);
  assert.equal(updateImportApplyRunItem.mock.callCount(), 2);
  assert.equal(markImportCandidateApplied.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.deepEqual(markRunCompleted.mock.calls[0].arguments, [{
    runId: 'run-apply-1',
    summary: {
      appliedCount: 1,
      appliedWithWarningsCount: 0,
      applyFailedCount: 0,
      blockedCount: 1,
      currentStep: 'Import apply complete',
      executionMode: 'move',
      processedCandidateCount: 2,
      readyCount: 1,
      readyWithWarningsCount: 0,
      requestedCandidateCount: 2,
      totalImportPending: 2,
    },
  }]);
});

test('import apply worker safe-auto mode skips warning and blocked candidates', async (t) => {
  const markImportCandidateApplied = t.mock.fn(async () => ({}));
  const replaceImportApplyRunItems = t.mock.fn(async () => []);
  const updateImportApplyRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async () => {
    resolveCompleted();
  });
  const readyCandidate = createReadyImportCandidate({ id: 'candidate-ready-auto' });
  const warningCandidate = createReadyImportCandidate({
    id: 'candidate-warning-auto',
    importStatus: { code: 'ready_with_warnings', message: 'Review warnings before adding.' },
  });
  const blockedCandidate = createReadyImportCandidate({
    id: 'candidate-blocked-auto',
    importStatus: { code: 'blocked', message: 'Collision review is required.' },
  });
  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: {
        blocked: 1,
        ready: 1,
        readyWithWarnings: 1,
        totalImportPending: 3,
      },
      importPendingCandidates: [readyCandidate, warningCandidate, blockedCandidate],
    }),
    markImportCandidateApplied,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => createVerifiedApplyPreview(),
    safeAutoAddQualityGateService: {
      evaluateSafeAutoAddQuality: async () => ({
        eligible: true,
        blockers: [],
        checkedFileCount: 1,
        message: 'Verified.',
        profileCode: 'lossless_archive',
        status: 'eligible',
      }),
    },
    releaseLease: async () => {},
    replaceImportApplyRunItems,
    updateImportApplyRunItem,
  });

  await worker.startWorkerRun({
    applySafetyMode: 'safe_auto',
    executableCandidateCount: 1,
    requestedCandidateCount: 3,
    runId: 'run-safe-auto-1',
    triggerSource: 'download_completed',
  });

  await completed;

  assert.equal(replaceImportApplyRunItems.mock.callCount(), 1);
  assert.equal(replaceImportApplyRunItems.mock.calls[0].arguments[1].length, 1);
  assert.equal(replaceImportApplyRunItems.mock.calls[0].arguments[1][0].importCandidateId, 'candidate-ready-auto');
  assert.equal(updateImportApplyRunItem.mock.callCount(), 1);
  assert.equal(updateImportApplyRunItem.mock.calls[0].arguments[0].importCandidateId, 'candidate-ready-auto');
  assert.equal(markImportCandidateApplied.mock.callCount(), 1);
  assert.deepEqual(markRunCompleted.mock.calls[0].arguments, [{
    runId: 'run-safe-auto-1',
    summary: {
      appliedCount: 1,
      appliedWithWarningsCount: 0,
      applyFailedCount: 0,
      applySafetyMode: 'safe_auto',
      blockedCount: 0,
      currentStep: 'Import apply complete',
      executionMode: 'move',
      processedCandidateCount: 1,
      readyCount: 1,
      readyWithWarningsCount: 1,
      requestedCandidateCount: 3,
      skippedUnsafeCandidateCount: 2,
      totalImportPending: 3,
      triggerSource: 'download_completed',
    },
  }]);
});

test('import apply worker keeps the Music Queue release correlation when it records a library add', async (t) => {
  const activityEvents = [];
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async () => {
    resolveCompleted();
  });
  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [createReadyImportCandidate({
        id: 'candidate-forest-frank',
        musicQueueContext: { wantedReleaseId: 'wanted-forest-frank' },
        releaseIdentity: { artistName: 'Forest Frank', releaseTitle: 'Child of God' },
      })],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => createVerifiedApplyPreview(),
    recordActivityEventFn: async (payload) => {
      activityEvents.push(payload);
    },
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-forest-frank-library-add',
  });

  await completed;

  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'release_added');
  assert.equal(activityEvents[0].entityId, 'candidate-forest-frank');
  assert.equal(activityEvents[0].extraPayload.wantedReleaseId, 'wanted-forest-frank');
});

test('import apply worker safe-auto mode blocks strict lossless candidates without verified quality evidence', async (t) => {
  const applyImportCandidatePreview = t.mock.fn(async () => ({
    executionMode: 'move',
    fileOperations: [{ status: 'applied' }],
    summary: {
      appliedFileCount: 1,
      failedFileCount: 0,
      notAttemptedCount: 0,
      stagedFromSourceCount: 1,
      totalFiles: 1,
    },
  }));
  const markImportCandidateApplied = t.mock.fn(async () => ({}));
  const handleImportCandidateQualityFailure = t.mock.fn(async () => ({
    failedCandidateId: 'candidate-fake-flac',
    nextCandidateId: 'candidate-next-flac',
    recovered: true,
    recoveryRunId: 'quality-recovery-run-1',
  }));
  const activityEvents = [];
  const updateImportApplyRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const markRunCompleted = t.mock.fn(async () => {
    resolveCompleted();
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview,
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [createReadyImportCandidate({
        id: 'candidate-fake-flac',
        musicQueueContext: {
          profileCode: 'lossless_archive',
          qualityOverride: null,
          wantedReleaseId: 'wanted-1',
        },
        releaseIdentity: {
          artistName: 'Artist',
          releaseTitle: 'Album',
        },
      })],
    }),
    handleImportCandidateQualityFailure,
    markImportCandidateApplied,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [{
        fileId: 'file-fake-flac',
        filename: '01 Fake.flac',
        inspection: {
          metadata: {
            bitRate: 192000,
            channelCount: 2,
            containerFormatName: 'mp3',
            primaryAudioCodec: 'mp3',
            sampleRate: 44100,
            tags: {
              album: 'Album',
              artist: 'Artist',
              title: 'Fake',
            },
          },
          warnings: [],
        },
        status: { code: 'ready', message: 'Ready.' },
      }],
      summary: { status: 'ready' },
    }),
    recordActivityEventFn: async (payload) => {
      activityEvents.push(payload);
    },
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem,
  });

  await worker.startWorkerRun({
    applySafetyMode: 'safe_auto',
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-safe-auto-quality-block',
    triggerSource: 'download_completed',
  });

  await completed;

  assert.equal(applyImportCandidatePreview.mock.callCount(), 0);
  assert.equal(markImportCandidateApplied.mock.callCount(), 0);
  assert.deepEqual(handleImportCandidateQualityFailure.mock.calls[0].arguments[0], {
    failedCandidateId: 'candidate-fake-flac',
    failureReason: '1 file did not pass verified lossless checks before automatic add.',
    operationRunId: 'run-safe-auto-quality-block',
    profileCode: 'lossless_archive',
    qualityLabel: 'blocked',
    qualityWeight: 0,
    scheduleFollowUpRun: true,
  });
  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'music_queue_import_blocked');
  assert.equal(activityEvents[0].entityId, 'wanted-1');
  assert.equal(activityEvents[0].entityTitle, 'Album');
  assert.equal(activityEvents[0].entityArtist, 'Artist');
  assert.equal(activityEvents[0].extraPayload.addBlockerCode, 'media_verification');
  assert.equal(Object.hasOwn(activityEvents[0].extraPayload, 'blockers'), false);
  assert.equal(updateImportApplyRunItem.mock.callCount(), 1);
  assert.equal(updateImportApplyRunItem.mock.calls[0].arguments[0].itemStatus, 'blocked');
  assert.match(updateImportApplyRunItem.mock.calls[0].arguments[0].statusMessage, /verified lossless checks/);
  assert.deepEqual(markRunCompleted.mock.calls[0].arguments, [{
    runId: 'run-safe-auto-quality-block',
    summary: {
      appliedCount: 0,
      appliedWithWarningsCount: 0,
      applyFailedCount: 0,
      applySafetyMode: 'safe_auto',
      blockedCount: 1,
      currentStep: 'Import apply complete',
      executionMode: 'move',
      processedCandidateCount: 1,
      qualityBlockedCount: 1,
      qualityRecoveryExhaustedCount: 0,
      qualityRecoveryRediscoveryCount: 0,
      qualityRecoveryStartedCount: 1,
      readyCount: 1,
      readyWithWarningsCount: 0,
      requestedCandidateCount: 1,
      skippedUnsafeCandidateCount: 0,
      totalImportPending: 1,
      triggerSource: 'download_completed',
    },
  }]);
});

test('import apply worker schedules one library scan after a completed run with applied candidates', async (t) => {
  const callOrder = [];
  let resolveScheduled;
  const scheduled = new Promise((resolve) => {
    resolveScheduled = resolve;
  });
  const scheduleLibraryScan = t.mock.fn(async (payload) => {
    callOrder.push('schedule');
    resolveScheduled(payload);
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [createReadyImportCandidate()],
    }),
    buildPostApplyReleaseHints: t.mock.fn(async ({ applyResult, summaryCandidate }) => {
      assert.equal(summaryCandidate.id, 'candidate-ready-1');
      assert.equal(applyResult.summary.appliedFileCount, 1);
      return [{
        canonicalPath: '/library/Artist/Album/01 Track.flac',
        metadataReleaseId: 'release-ready-1',
      }];
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => {
      callOrder.push('completed');
    },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'ready' },
    }),
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    scheduleLibraryScan,
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-auto-scan-1',
  });

  assert.deepEqual(await scheduled, {
    releaseHints: [{
      canonicalPath: '/library/Artist/Album/01 Track.flac',
      metadataReleaseId: 'release-ready-1',
    }],
    triggeredByRunId: 'run-auto-scan-1',
  });
  assert.equal(scheduleLibraryScan.mock.callCount(), 1);
  assert.deepEqual(callOrder, ['completed', 'schedule']);
});

test('import apply worker does not schedule a library scan when every candidate fails or is blocked', async (t) => {
  const scheduleLibraryScan = t.mock.fn(async () => {});
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'failed' }],
      summary: {
        appliedFileCount: 0,
        failedFileCount: 1,
        notAttemptedCount: 0,
        stagedFromSourceCount: 0,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 1, ready: 1, readyWithWarnings: 0, totalImportPending: 2 },
      importPendingCandidates: [
        createReadyImportCandidate({ id: 'candidate-failed-1' }),
        createReadyImportCandidate({
          id: 'candidate-blocked-1',
          importStatus: { code: 'blocked', message: 'Collision review is required.' },
        }),
      ],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => {
      resolveCompleted();
    },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'ready' },
    }),
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    scheduleLibraryScan,
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 2,
    runId: 'run-auto-scan-none',
  });

  await completed;

  assert.equal(scheduleLibraryScan.mock.callCount(), 0);
});

test('import apply worker swallows library scan scheduling errors after successful apply', async (t) => {
  const markRunFailed = t.mock.fn(async () => {});
  const scheduleLibraryScan = t.mock.fn(async () => {
    const error = new Error('A library scan is already running or queued');
    error.status = 409;
    error.code = 'library_scan_in_progress';
    throw error;
  });
  let resolveReleased;
  const released = new Promise((resolve) => {
    resolveReleased = resolve;
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [createReadyImportCandidate()],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => {},
    markRunFailed,
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'ready' },
    }),
    releaseLease: async (payload) => {
      resolveReleased(payload);
    },
    replaceImportApplyRunItems: async () => [],
    scheduleLibraryScan,
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-auto-scan-error',
  });

  assert.deepEqual(await released, {
    runId: 'run-auto-scan-error',
    status: 'completed',
  });
  assert.equal(scheduleLibraryScan.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
});

test('import apply worker does not schedule a library scan after cancellation', async (t) => {
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const scheduleLibraryScan = t.mock.fn(async () => {});
  let resolveReleased;
  const released = new Promise((resolve) => {
    resolveReleased = resolve;
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    isCancellationRequested: async () => true,
    markRunCancelled,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    releaseLease: async (payload) => {
      resolveReleased(payload);
    },
    replaceImportApplyRunItems: async () => [],
    scheduleLibraryScan,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-auto-scan-cancelled',
  });

  assert.deepEqual(await released, {
    runId: 'run-auto-scan-cancelled',
    status: 'cancelled',
  });
  assert.equal(markRunCancelled.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 0);
  assert.equal(scheduleLibraryScan.mock.callCount(), 0);
});

test('import apply worker upgrades skipped-file applies to applied_with_warnings', async (t) => {
  const updateImportApplyRunItem = t.mock.fn(async () => null);
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });
  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'skipped' }],
      summary: {
        appliedFileCount: 0,
        failedFileCount: 0,
        notAttemptedCount: 0,
        skippedFileCount: 1,
        stagedFromSourceCount: 0,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: {
        blocked: 0,
        ready: 1,
        readyWithWarnings: 0,
        totalImportPending: 1,
      },
      importPendingCandidates: [{
        applyPreview: {
          counts: { totalFiles: 1 },
          summary: { status: 'attention' },
        },
        fileCount: 1,
        folderPath: 'Autechre/Amber',
        id: 'candidate-1',
        importPendingAt: '2026-04-30T12:30:00.000Z',
        importStatus: {
          code: 'ready',
          message: 'Ready for import apply.',
        },
        lockedFileCount: 0,
        planning: {
          libraryFolderPath: '/music/Autechre/Amber',
          sourceFolderPath: '/downloads/Autechre/Amber',
          stagingFolderPath: '/staging/import-candidates/candidate-1/Autechre/Amber',
        },
        sourceProvider: 'slskd',
        sourceSearchId: 'search-1',
        totalSizeBytes: 123456,
        username: 'source-user',
      }],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => {
      resolveCompleted();
    },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'attention' },
    }),
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-apply-2',
  });

  await completed;

  assert.equal(updateImportApplyRunItem.mock.calls[0].arguments[0].itemStatus, 'applied_with_warnings');
  assert.match(updateImportApplyRunItem.mock.calls[0].arguments[0].statusMessage, /skipped by saved operator decision/);
});

test('import apply worker fires sendFulfillmentNotificationFn fire-and-forget when candidate has requestOwnership', async (t) => {
  let notifiedUserId = null;
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [{
        applyPreview: {
          counts: { totalFiles: 1 },
          summary: { status: 'ready' },
        },
        fileCount: 1,
        folderPath: 'Artist/Album',
        id: 'candidate-notify-1',
        importPendingAt: '2026-04-30T12:00:00.000Z',
        importStatus: { code: 'ready', message: 'Ready.' },
        lockedFileCount: 0,
        planning: {},
        requestOwnership: {
          sourceMediaRequestId: 'request-uuid-1',
          sourceRequestedByUserId: 'user-by-uuid',
          sourceRequestedForUserId: 'user-for-uuid',
          sourceType: 'media_request',
        },
        sourceProvider: 'slskd',
        sourceSearchId: 'search-notify-1',
        totalSizeBytes: 50000,
        username: 'source-user',
      }],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => { resolveCompleted(); },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'ready' },
    }),
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    sendFulfillmentNotificationFn: async ({ userId }) => {
      notifiedUserId = userId;
    },
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-notify-1',
  });

  await completed;

  assert.equal(notifiedUserId, 'user-for-uuid', 'should notify sourceRequestedForUserId');
});

test('import apply worker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});

  const worker = createImportCandidateApplyWorker({
    acquireLease,
    isCancellationRequested: async () => ({
      kind: 'paused',
      nextRetryAt: '2026-05-04T12:30:00.000Z',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Import apply is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    }),
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    releaseLease,
    replaceImportApplyRunItems: t.mock.fn(async () => []),
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
    executableCandidateCount: 3,
    requestedCandidateCount: 4,
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
      currentStep: 'Import apply paused by maintenance lock',
      executionMode: 'move',
      executableCandidateCount: 3,
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Import apply is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
      requestedCandidateCount: 4,
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('import apply worker does not call sendFulfillmentNotificationFn when candidate has no requestOwnership', async (t) => {
  let notifyCallCount = 0;
  let resolveCompleted;
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    applyImportCandidatePreview: async () => ({
      executionMode: 'move',
      fileOperations: [{ status: 'applied' }],
      summary: {
        appliedFileCount: 1,
        failedFileCount: 0,
        notAttemptedCount: 0,
        stagedFromSourceCount: 1,
        totalFiles: 1,
      },
    }),
    buildImportPendingCandidateSummary: async () => ({
      counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
      importPendingCandidates: [{
        applyPreview: { counts: { totalFiles: 1 }, summary: { status: 'ready' } },
        fileCount: 1,
        folderPath: 'Artist/Album',
        id: 'candidate-no-ownership',
        importPendingAt: '2026-04-30T12:00:00.000Z',
        importStatus: { code: 'ready', message: 'Ready.' },
        lockedFileCount: 0,
        planning: {},
        requestOwnership: null,
        sourceProvider: 'slskd',
        sourceSearchId: 'search-no-own',
        totalSizeBytes: 50000,
        username: 'source-user',
      }],
    }),
    markImportCandidateApplied: async () => ({}),
    markRunCompleted: async () => { resolveCompleted(); },
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    previewImportCandidateApply: async () => ({
      counts: { totalFiles: 1 },
      files: [],
      summary: { status: 'ready' },
    }),
    releaseLease: async () => {},
    replaceImportApplyRunItems: async () => [],
    sendFulfillmentNotificationFn: async () => {
      notifyCallCount += 1;
    },
    updateImportApplyRunItem: async () => null,
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-no-notify-1',
  });

  await completed;

  assert.equal(notifyCallCount, 0, 'should not call sendFulfillmentNotificationFn when no requestOwnership');
});

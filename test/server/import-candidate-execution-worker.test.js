import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';

test('import execution worker enqueues ready candidates and persists per-item outcomes', async (t) => {
  const markImportCandidateDownloading = t.mock.fn(async () => ({}));
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
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 2);
  assert.equal(markImportCandidateDownloading.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.deepEqual(markRunCompleted.mock.calls[0].arguments, [{
    runId: 'run-1',
    summary: {
      blockedCount: 1,
      currentStep: 'Download enqueue complete',
      executionMode: 'download_enqueue',
      processedCandidateCount: 2,
      queueFailedCount: 0,
      queuedCount: 1,
      queuedWithWarningsCount: 0,
      readyCount: 1,
      readyWithWarningsCount: 0,
      requestedCandidateCount: 2,
      totalSelected: 2,
    },
  }]);
});
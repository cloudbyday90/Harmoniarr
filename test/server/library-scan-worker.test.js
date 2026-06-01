import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createLibraryScanWorker,
  shouldExtractLibraryFileTags,
} from '../../src/server/library/library-scan-worker.js';

test('shouldExtractLibraryFileTags skips observed files with unchanged tag extraction stamps', () => {
  assert.equal(shouldExtractLibraryFileTags({
    fileState: 'observed',
    modifiedAt: '2026-04-30T18:00:00.000Z',
    sizeBytes: 123,
    tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
    tagExtractedSizeBytes: 123,
    tagPayload: { title: 'Foil' },
  }), false);
  assert.equal(shouldExtractLibraryFileTags({
    fileState: 'observed',
    modifiedAt: '2026-04-30T18:01:00.000Z',
    sizeBytes: 123,
    tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
    tagExtractedSizeBytes: 123,
    tagPayload: { title: 'Foil' },
  }), true);
  assert.equal(shouldExtractLibraryFileTags({
    fileState: 'observed',
    modifiedAt: '2026-04-30T18:00:00.000Z',
    sizeBytes: 124,
    tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
    tagExtractedSizeBytes: 123,
    tagPayload: { title: 'Foil' },
  }), true);
  assert.equal(shouldExtractLibraryFileTags({
    fileState: 'observed',
    modifiedAt: '2026-04-30T18:00:00.000Z',
    sizeBytes: 123,
    tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
    tagExtractedSizeBytes: 123,
    tagPayload: null,
  }), true);
  assert.equal(shouldExtractLibraryFileTags({
    fileState: 'ignored',
  }), false);
});

test('createLibraryScanWorker executes a scan and records completion summary', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'harmoniarr-library-scan-'));
  const artistDir = join(rootDir, 'Artist');
  await mkdir(artistDir, { recursive: true });
  await writeFile(join(artistDir, 'track-01.flac'), 'audio-data');
  await writeFile(join(artistDir, 'cover.jpg'), 'image-data');

  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const acquireLease = t.mock.fn(async () => {});
  const renewLease = t.mock.fn(async () => {});
  const startLeaseHeartbeat = t.mock.fn(() => {});
  const stopLeaseHeartbeat = t.mock.fn(() => {});
  const createOperationRunLeaseHeartbeatFn = t.mock.fn(() => ({
    start: startLeaseHeartbeat,
    stop: stopLeaseHeartbeat,
  }));
  const recordLibraryFiles = t.mock.fn(async () => ({
    files: [{
      canonicalPath: join(rootDir, 'Artist', 'cover.jpg'),
      fileState: 'ignored',
      id: 'file-image-1',
      relativePath: 'Artist/cover.jpg',
    }, {
      canonicalPath: join(rootDir, 'Artist', 'track-01.flac'),
      fileState: 'observed',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: null,
      tagExtractedSizeBytes: null,
      tagPayload: {
        title: 'Foil',
      },
    }],
    libraryRootId: 'root-1',
    observedFileCount: 2,
  }));
  const captureLibrarySidecarArtwork = t.mock.fn(async () => {});
  const extractLibraryFileTags = t.mock.fn(async () => {});
  const matchLibraryFiles = t.mock.fn(async () => {});
  const reconcileDiscoveryRequests = t.mock.fn(async () => {});
  const reconcileLibraryReleases = t.mock.fn(async () => {});
  const reconcileWantedReleases = t.mock.fn(async () => {});
  const worker = createLibraryScanWorker({
    acquireLease,
    captureLibrarySidecarArtwork,
    createOperationRunLeaseHeartbeatFn,
    extractLibraryFileTags,
    matchLibraryFiles,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    reconcileDiscoveryRequests,
    reconcileLibraryReleases,
    reconcileWantedReleases,
    recordLibraryFiles,
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
    libraryRoot: rootDir,
    runId: 'run-1',
    triggeredByRunId: 'apply-run-1',
    triggerReason: 'import_candidate_apply',
  });

  const completionArgs = await completion;
  const releasedLeaseArgs = await leaseReleased;

  assert.equal(acquireLease.mock.callCount(), 1);
  assert.deepEqual(createOperationRunLeaseHeartbeatFn.mock.calls[0].arguments, [{
    renewLease,
    runId: 'run-1',
  }]);
  assert.equal(startLeaseHeartbeat.mock.callCount(), 1);
  assert.deepEqual(markRunStarted.mock.calls[0].arguments, [{
    runId: 'run-1',
    summary: {
      libraryRoot: rootDir,
      triggeredByRunId: 'apply-run-1',
      triggerReason: 'import_candidate_apply',
    },
  }]);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(recordLibraryFiles.mock.callCount(), 1);
  assert.equal(recordLibraryFiles.mock.calls[0].arguments[0].libraryRootPath, rootDir);
  assert.equal(recordLibraryFiles.mock.calls[0].arguments[0].files.length, 2);
  assert.equal(extractLibraryFileTags.mock.callCount(), 1);
  assert.deepEqual(extractLibraryFileTags.mock.calls[0].arguments[0], {
    files: [{
      canonicalPath: join(rootDir, 'Artist', 'track-01.flac'),
      fileState: 'observed',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: null,
      tagExtractedSizeBytes: null,
      tagPayload: {
        title: 'Foil',
      },
    }],
  });
  assert.equal(captureLibrarySidecarArtwork.mock.callCount(), 1);
  assert.deepEqual(captureLibrarySidecarArtwork.mock.calls[0].arguments[0], {
    files: [{
      canonicalPath: join(rootDir, 'Artist', 'cover.jpg'),
      fileState: 'ignored',
      id: 'file-image-1',
      relativePath: 'Artist/cover.jpg',
    }, {
      canonicalPath: join(rootDir, 'Artist', 'track-01.flac'),
      fileState: 'observed',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: null,
      tagExtractedSizeBytes: null,
      tagPayload: {
        title: 'Foil',
      },
    }],
  });
  assert.equal(matchLibraryFiles.mock.callCount(), 1);
  assert.deepEqual(matchLibraryFiles.mock.calls[0].arguments[0], {
    files: [{
      canonicalPath: join(rootDir, 'Artist', 'track-01.flac'),
      fileState: 'observed',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: null,
      tagExtractedSizeBytes: null,
      tagPayload: {
        title: 'Foil',
      },
    }],
  });
  assert.equal(reconcileLibraryReleases.mock.callCount(), 1);
  assert.deepEqual(reconcileLibraryReleases.mock.calls[0].arguments, []);
  assert.equal(reconcileWantedReleases.mock.callCount(), 1);
  assert.deepEqual(reconcileWantedReleases.mock.calls[0].arguments, []);
  assert.equal(reconcileDiscoveryRequests.mock.callCount(), 1);
  assert.deepEqual(reconcileDiscoveryRequests.mock.calls[0].arguments, []);
  assert.deepEqual(
    recordLibraryFiles.mock.calls[0].arguments[0].files
      .map((file) => ({
        fileState: file.fileState,
        relativePath: file.relativePath,
      }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    [
      {
        fileState: 'ignored',
        relativePath: 'Artist/cover.jpg',
      },
      {
        fileState: 'observed',
        relativePath: 'Artist/track-01.flac',
      },
    ],
  );
  assert.equal(completionArgs.runId, 'run-1');
  assert.equal(completionArgs.summary.filesSeen, 2);
  assert.equal(completionArgs.summary.filesMatched, 1);
  assert.equal(completionArgs.summary.filesUnmatched, 1);
  assert.equal(completionArgs.summary.libraryRoot, rootDir);
  assert.equal(completionArgs.summary.triggeredByRunId, 'apply-run-1');
  assert.equal(completionArgs.summary.triggerReason, 'import_candidate_apply');
  assert.equal(releaseLease.mock.callCount(), 1);
  assert.equal(stopLeaseHeartbeat.mock.callCount(), 1);
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-1',
    status: 'completed',
  });
});

test('createLibraryScanWorker ignores sidecar artwork failures and still completes the scan', async (t) => {
  const executeScan = t.mock.fn(async () => ({
    filesMatched: 1,
    filesSeen: 2,
    filesUnmatched: 1,
    libraryRoot: '/library',
  }));
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const acquireLease = t.mock.fn(async () => {});
  const recordLibraryFiles = t.mock.fn(async () => ({
    files: [{
      canonicalPath: '/library/Artist/cover.jpg',
      fileState: 'ignored',
      id: 'file-image-1',
      relativePath: 'Artist/cover.jpg',
    }, {
      canonicalPath: '/library/Artist/track-01.flac',
      fileState: 'observed',
      id: 'file-1',
      relativePath: 'Artist/track-01.flac',
    }],
    libraryRootId: 'root-1',
    observedFileCount: 2,
  }));
  const captureLibrarySidecarArtwork = t.mock.fn(async () => {
    throw new Error('invalid sidecar');
  });

  const worker = createLibraryScanWorker({
    acquireLease,
    captureLibrarySidecarArtwork,
    executeScan,
    extractLibraryFileTags: t.mock.fn(async () => {}),
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    matchLibraryFiles: t.mock.fn(async () => {}),
    recordLibraryFiles,
    releaseLease,
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    libraryRoot: '/library',
    runId: 'run-2',
  });

  const completionArgs = await completion;

  assert.equal(captureLibrarySidecarArtwork.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(completionArgs.runId, 'run-2');
});

test('createLibraryScanWorker requeues the run when a maintenance pause is requested', async (t) => {
  const acquireLease = t.mock.fn(async () => {});
  const createOperationRunLeaseHeartbeatFn = t.mock.fn(() => ({
    start: t.mock.fn(() => {}),
    stop: t.mock.fn(() => {}),
  }));
  const isCancellationRequested = t.mock.fn(async () => ({
    kind: 'paused',
    nextRetryAt: '2026-05-04T12:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Library scan is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
  }));
  const markRunCancelled = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const markRunPaused = t.mock.fn(async () => {});
  const markRunStarted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const renewLease = t.mock.fn(async () => {});
  const worker = createLibraryScanWorker({
    acquireLease,
    createOperationRunLeaseHeartbeatFn,
    isCancellationRequested,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunPaused,
    markRunStarted,
    releaseLease,
    renewLease,
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
    libraryRoot: '/library',
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
      currentStep: 'Library scan paused by maintenance lock',
      libraryRoot: '/library',
      pauseCode: 'recovery_lock_conflict',
      pauseMessage: 'Library scan is paused while the restore maintenance lock is active.',
      pauseProvider: 'restore',
    },
  });
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-paused',
    status: 'paused',
  });
});

test('createLibraryScanWorker skips extraction and matching for unchanged files', async (t) => {
  const executeScan = t.mock.fn(async () => ({
    filesMatched: 1,
    filesSeen: 1,
    filesUnmatched: 0,
    libraryRoot: '/library',
  }));
  const extractLibraryFileTags = t.mock.fn(async () => {});
  const matchLibraryFiles = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const worker = createLibraryScanWorker({
    acquireLease: async () => {},
    executeScan,
    extractLibraryFileTags,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    matchLibraryFiles,
    recordLibraryFiles: async () => ({
      files: [{
        canonicalPath: '/library/Artist/track-01.flac',
        fileState: 'observed',
        id: 'file-1',
        modifiedAt: '2026-04-30T18:00:00.000Z',
        relativePath: 'Artist/track-01.flac',
        sizeBytes: 123,
        tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
        tagExtractedSizeBytes: 123,
        tagPayload: { title: 'Foil' },
      }],
      libraryRootId: 'root-1',
      observedFileCount: 1,
    }),
    releaseLease,
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    libraryRoot: '/library',
    runId: 'run-skip-tags',
  });

  await completion;

  assert.equal(extractLibraryFileTags.mock.callCount(), 0);
  assert.equal(matchLibraryFiles.mock.callCount(), 0);
});

test('createLibraryScanWorker matches freshly extracted tag payloads in the same scan', async (t) => {
  const extractLibraryFileTags = t.mock.fn(async ({ files }) => ({
    files: files.map((file) => ({
      ...file,
      tagPayload: { title: 'Freshly Extracted Title' },
    })),
  }));
  const matchLibraryFiles = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const worker = createLibraryScanWorker({
    acquireLease: async () => {},
    executeScan: async () => ({
      filesMatched: 1,
      filesSeen: 1,
      filesUnmatched: 0,
      libraryRoot: '/library',
    }),
    extractLibraryFileTags,
    markRunCompleted,
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    matchLibraryFiles,
    recordLibraryFiles: async () => ({
      files: [{
        canonicalPath: '/library/Artist/track-01.flac',
        fileState: 'observed',
        id: 'file-1',
        modifiedAt: '2026-04-30T18:00:00.000Z',
        relativePath: 'Artist/track-01.flac',
        sizeBytes: 123,
        tagExtractedModifiedAt: null,
        tagExtractedSizeBytes: null,
        tagPayload: null,
      }],
      libraryRootId: 'root-1',
      observedFileCount: 1,
    }),
    releaseLease: async () => {},
  });

  const completion = new Promise((resolve) => {
    markRunCompleted.mock.mockImplementation(async (args) => {
      resolve(args);
    });
  });

  await worker.startWorkerRun({
    libraryRoot: '/library',
    runId: 'run-fresh-tags',
  });

  await completion;

  assert.equal(extractLibraryFileTags.mock.callCount(), 1);
  assert.deepEqual(matchLibraryFiles.mock.calls[0].arguments[0], {
    files: [{
      canonicalPath: '/library/Artist/track-01.flac',
      fileState: 'observed',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: null,
      tagExtractedSizeBytes: null,
      tagPayload: { title: 'Freshly Extracted Title' },
    }],
  });
});

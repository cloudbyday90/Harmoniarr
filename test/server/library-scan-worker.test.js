import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';

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
      relativePath: 'Artist/track-01.flac',
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
      relativePath: 'Artist/track-01.flac',
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
      relativePath: 'Artist/track-01.flac',
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
      relativePath: 'Artist/track-01.flac',
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
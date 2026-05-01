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
  const recordLibraryFiles = t.mock.fn(async () => ({
    files: [{
      canonicalPath: join(rootDir, 'Artist', 'track-01.flac'),
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        title: 'Foil',
      },
    }],
    libraryRootId: 'root-1',
    observedFileCount: 2,
  }));
  const extractLibraryFileTags = t.mock.fn(async () => {});
  const matchLibraryFiles = t.mock.fn(async () => {});
  const reconcileDiscoveryRequests = t.mock.fn(async () => {});
  const reconcileLibraryReleases = t.mock.fn(async () => {});
  const reconcileWantedReleases = t.mock.fn(async () => {});
  const worker = createLibraryScanWorker({
    acquireLease,
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
  assert.deepEqual(releasedLeaseArgs, {
    runId: 'run-1',
    status: 'completed',
  });
});
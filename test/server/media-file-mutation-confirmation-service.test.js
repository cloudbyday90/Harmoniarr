import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaFileMutationConfirmationService } from '../../src/server/media/media-file-mutation-confirmation-service.js';

function createMissingPathError(pathValue) {
  const error = new Error(`ENOENT: no such file or directory, stat '${pathValue}'`);
  error.code = 'ENOENT';
  return error;
}

function createService(paths) {
  return createMediaFileMutationConfirmationService({
    statFn: async (pathValue) => {
      const entry = paths.get(pathValue);
      if (!entry) {
        throw createMissingPathError(pathValue);
      }

      return {
        isFile: () => true,
        size: entry.size,
      };
    },
  });
}

test('file mutation confirmation proves a completed move from destination size and source removal', async () => {
  const service = createService(new Map([
    ['/library/Artist/Album/01 Track.flac', { size: 42 }],
  ]));

  const result = await service.confirmMutation({
    destinationPath: '/library/Artist/Album/01 Track.flac',
    expectedSizeBytes: 42,
    removeSourceAfterSuccess: true,
    sourcePath: '/staging/Artist/Album/01 Track.flac',
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.destination.sizeBytes, 42);
  assert.equal(result.source.exists, false);
});

test('file mutation confirmation allows a retry only when the source is intact and no destination exists', async () => {
  const service = createService(new Map([
    ['/downloads/Artist/Album/01 Track.flac', { size: 42 }],
  ]));

  const result = await service.confirmMutation({
    destinationPath: '/staging/Artist/Album/01 Track.flac',
    expectedSizeBytes: 42,
    removeSourceAfterSuccess: true,
    sourcePath: '/downloads/Artist/Album/01 Track.flac',
  });

  assert.equal(result.status, 'safe_to_retry');
  assert.equal(result.source.sizeBytes, 42);
  assert.equal(result.destination.exists, false);
});

test('file mutation confirmation holds an incomplete move instead of deleting the source automatically', async () => {
  const service = createService(new Map([
    ['/staging/Artist/Album/01 Track.flac', { size: 42 }],
    ['/library/Artist/Album/01 Track.flac', { size: 42 }],
  ]));

  const result = await service.confirmMutation({
    destinationPath: '/library/Artist/Album/01 Track.flac',
    expectedSizeBytes: 42,
    removeSourceAfterSuccess: true,
    sourcePath: '/staging/Artist/Album/01 Track.flac',
  });

  assert.equal(result.status, 'ambiguous');
  assert.match(result.message, /No further file changes/);
});

test('file mutation confirmation accepts a hardlink-style result when the source should remain', async () => {
  const service = createService(new Map([
    ['/library/other-user/Artist/Album/01 Track.flac', { size: 42 }],
    ['/library/target-user/Artist/Album/01 Track.flac', { size: 42 }],
  ]));

  const result = await service.confirmMutation({
    destinationPath: '/library/target-user/Artist/Album/01 Track.flac',
    expectedSizeBytes: 42,
    removeSourceAfterSuccess: false,
    sourcePath: '/library/other-user/Artist/Album/01 Track.flac',
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.source.exists, true);
});

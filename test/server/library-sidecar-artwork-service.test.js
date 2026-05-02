import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibrarySidecarArtworkService } from '../../src/server/library/library-sidecar-artwork-service.js';

test('captureSidecarArtwork assigns preferred folder art to observed files without existing preferred artwork', async (t) => {
  const artworkAssignmentService = {
    clearArtworkSource: t.mock.fn(async () => ({ clearedCount: 0, promotedArtworkAssetId: null })),
    reconcilePreferredArtwork: t.mock.fn(async ({ ownerId }) => ({
      assignment: { id: `assignment-${ownerId}` },
      promotedToPreferred: ownerId === 'file-1',
    })),
  };
  const artworkIngestionService = {
    ingestArtworkFile: t.mock.fn(async () => ({ asset: { id: 'asset-1' }, stored: true })),
  };
  const service = createLibrarySidecarArtworkService({
    artworkAssignmentService,
    artworkIngestionService,
  });

  const result = await service.captureSidecarArtwork({
    files: [
      {
        canonicalPath: '/library/Artist/Album/cover.jpg',
        extension: '.jpg',
        fileState: 'ignored',
        filename: 'cover.jpg',
        id: 'image-1',
        relativePath: 'Artist/Album/cover.jpg',
      },
      {
        canonicalPath: '/library/Artist/Album/track-01.flac',
        extension: '.flac',
        fileState: 'observed',
        filename: 'track-01.flac',
        id: 'file-1',
        relativePath: 'Artist/Album/track-01.flac',
      },
      {
        canonicalPath: '/library/Artist/Album/track-02.flac',
        extension: '.flac',
        fileState: 'observed',
        filename: 'track-02.flac',
        id: 'file-2',
        relativePath: 'Artist/Album/track-02.flac',
      },
    ],
  });

  assert.deepEqual(result, { assignedCount: 1, candidateCount: 1 });
  assert.equal(artworkIngestionService.ingestArtworkFile.mock.callCount(), 1);
  assert.deepEqual(artworkIngestionService.ingestArtworkFile.mock.calls[0].arguments[0], {
    filePath: '/library/Artist/Album/cover.jpg',
    sourceProvider: 'sidecar',
    storageClass: 'provider_original',
  });
  assert.equal(artworkAssignmentService.reconcilePreferredArtwork.mock.callCount(), 2);
  assert.deepEqual(artworkAssignmentService.reconcilePreferredArtwork.mock.calls[0].arguments[0], {
    artworkAssetId: 'asset-1',
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 10,
    sourceProvider: 'sidecar',
    sourceReference: 'cover.jpg',
  });
});

test('captureSidecarArtwork ignores unsupported sidecar names and image extensions', async () => {
  const clearArtworkSource = test.mock.fn(async () => ({ clearedCount: 1, promotedArtworkAssetId: null }));
  const service = createLibrarySidecarArtworkService({
    artworkAssignmentService: {
      clearArtworkSource,
      assignPreferredArtwork: async () => {
        throw new Error('should not assign');
      },
    },
    artworkIngestionService: {
      ingestArtworkFile: async () => {
        throw new Error('should not ingest');
      },
    },
  });

  assert.deepEqual(await service.captureSidecarArtwork({
    files: [
      {
        canonicalPath: '/library/Artist/Album/back.jpg',
        extension: '.jpg',
        fileState: 'ignored',
        filename: 'back.jpg',
        id: 'image-1',
        relativePath: 'Artist/Album/back.jpg',
      },
      {
        canonicalPath: '/library/Artist/Album/track-01.flac',
        extension: '.flac',
        fileState: 'observed',
        filename: 'track-01.flac',
        id: 'file-1',
        relativePath: 'Artist/Album/track-01.flac',
      },
    ],
  }), { assignedCount: 0, candidateCount: 0 });
  assert.deepEqual(clearArtworkSource.mock.calls[0].arguments[0], {
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    sourceProvider: 'sidecar',
  });
});
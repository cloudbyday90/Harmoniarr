import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryEmbeddedArtworkService } from '../../src/server/library/library-embedded-artwork-service.js';

test('captureEmbeddedArtwork ingests the selected embedded cover and assigns it to the library file', async (t) => {
  const artworkAssignmentService = {
    reconcilePreferredArtwork: t.mock.fn(async () => ({
      assignment: { id: 'assignment-1' },
      promotedToPreferred: true,
    })),
  };
  const artworkIngestionService = {
    ingestArtworkBuffer: t.mock.fn(async () => ({
      absolutePath: '/app/data/artwork/extracted/example.jpg',
      asset: { id: 'asset-1', relativePath: 'extracted/example.jpg' },
      stored: true,
    })),
  };
  const libraryEmbeddedArtworkService = createLibraryEmbeddedArtworkService({
    artworkAssignmentService,
    artworkIngestionService,
    selectEmbeddedCover: (pictures) => pictures[1],
  });

  const result = await libraryEmbeddedArtworkService.captureEmbeddedArtwork({
    libraryFileId: 'file-1',
    metadata: {
      common: {
        picture: [
          { data: Buffer.from('small'), format: 'image/png', type: 'Leaflet' },
          { data: Buffer.from('cover'), description: 'Front cover', format: 'image/jpeg', type: 'Cover (front)' },
        ],
      },
    },
  });

  assert.equal(artworkIngestionService.ingestArtworkBuffer.mock.callCount(), 1);
  assert.deepEqual(artworkIngestionService.ingestArtworkBuffer.mock.calls[0].arguments[0], {
    buffer: Buffer.from('cover'),
    sourceProvider: 'embedded',
    storageClass: 'extracted_embedded',
  });
  assert.deepEqual(artworkAssignmentService.reconcilePreferredArtwork.mock.calls[0].arguments[0], {
    artworkAssetId: 'asset-1',
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 0,
    sourceProvider: 'embedded',
    sourceReference: 'Cover (front)',
  });
  assert.equal(result.assignment.id, 'assignment-1');
});

test('captureEmbeddedArtwork returns null when no embedded pictures are available', async () => {
  const clearArtworkSource = test.mock.fn(async () => ({ clearedCount: 1, promotedArtworkAssetId: 'asset-sidecar-1' }));
  const libraryEmbeddedArtworkService = createLibraryEmbeddedArtworkService({
    artworkAssignmentService: {
      assignPreferredArtwork: async () => {
        throw new Error('should not assign');
      },
      clearArtworkSource,
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => {
        throw new Error('should not ingest');
      },
    },
  });

  assert.equal(await libraryEmbeddedArtworkService.captureEmbeddedArtwork({
    libraryFileId: 'file-1',
    metadata: { common: { picture: [] } },
  }), null);
  assert.deepEqual(clearArtworkSource.mock.calls[0].arguments[0], {
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    sourceProvider: 'embedded',
  });
});
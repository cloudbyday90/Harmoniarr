import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateArtworkCleanupCutoff,
  createArtworkCleanupService,
} from '../../src/server/artwork/artwork-cleanup-service.js';

test('calculateArtworkCleanupCutoff subtracts the configured retention days from the current instant', () => {
  assert.equal(
    calculateArtworkCleanupCutoff({
      now: '2026-05-01T12:00:00.000Z',
      retentionDays: 90,
    }),
    '2026-01-31T12:00:00.000Z',
  );
});

test('cleanupUnassignedArtwork deletes expired unassigned assets while tolerating missing files', async (t) => {
  const deleteArtworkAssetById = t.mock.fn(async () => ({}));
  const listArtworkCleanupCandidates = t.mock.fn(async () => ([
    {
      id: 'asset-1',
      relativePath: 'originals/aa/bb/asset-1.jpg',
    },
    {
      id: 'asset-2',
      relativePath: 'extracted/aa/bb/asset-2.jpg',
    },
  ]));
  const removeFile = t.mock.fn(async (absolutePath) => {
    if (absolutePath.endsWith('asset-2.jpg')) {
      const error = new Error('missing file');
      error.code = 'ENOENT';
      throw error;
    }
  });
  const artworkCleanupService = createArtworkCleanupService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
        storage: {
          root: '/app/data/artwork',
        },
      }),
    },
    deleteArtworkAssetByIdFn: deleteArtworkAssetById,
    listArtworkCleanupCandidatesFn: listArtworkCleanupCandidates,
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
    removeFileFn: removeFile,
  });

  const summary = await artworkCleanupService.cleanupUnassignedArtwork({ limit: 25 });

  assert.deepEqual(listArtworkCleanupCandidates.mock.calls[0].arguments[0], {
    limit: 25,
    unassignedBefore: '2026-01-31T12:00:00.000Z',
  });
  assert.deepEqual(deleteArtworkAssetById.mock.calls.map((call) => call.arguments[0]), ['asset-1', 'asset-2']);
  assert.equal(summary.scannedAssetCount, 2);
  assert.equal(summary.deletedAssetCount, 2);
  assert.equal(summary.deletedFileCount, 1);
  assert.equal(summary.missingFileCount, 1);
  assert.equal(summary.failedAssetCount, 0);
});

test('cleanupUnassignedArtwork leaves the asset row intact when file deletion fails unexpectedly', async (t) => {
  const deleteArtworkAssetById = t.mock.fn(async () => ({}));
  const removeFile = t.mock.fn(async () => {
    const error = new Error('permission denied');
    error.code = 'EACCES';
    throw error;
  });
  const artworkCleanupService = createArtworkCleanupService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
        storage: {
          root: '/app/data/artwork',
        },
      }),
    },
    deleteArtworkAssetByIdFn: deleteArtworkAssetById,
    listArtworkCleanupCandidatesFn: async () => ([{
      id: 'asset-1',
      relativePath: 'originals/aa/bb/asset-1.jpg',
    }]),
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
    removeFileFn: removeFile,
  });

  const summary = await artworkCleanupService.cleanupUnassignedArtwork();

  assert.equal(deleteArtworkAssetById.mock.callCount(), 0);
  assert.equal(summary.deletedAssetCount, 0);
  assert.equal(summary.failedAssetCount, 1);
  assert.equal(summary.failures[0].artworkAssetId, 'asset-1');
  assert.equal(summary.failures[0].code, 'EACCES');
});
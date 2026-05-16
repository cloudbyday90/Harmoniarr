import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createArtworkServeService } from '../../src/server/artwork/artwork-serve-service.js';

test('serveArtworkFile throws 400 for empty assetId', async () => {
  const serve = createArtworkServeService();

  await assert.rejects(
    () => serve.serveArtworkFile({ assetId: '' }),
    (error) => error.status === 400 && error.code === 'validation_error',
  );
});

test('serveArtworkFile throws 400 for non-string assetId', async () => {
  const serve = createArtworkServeService();

  await assert.rejects(
    () => serve.serveArtworkFile({ assetId: null }),
    (error) => error.status === 400 && error.code === 'validation_error',
  );
});

test('serveArtworkFile throws 404 when asset is not found in database', async () => {
  const serve = createArtworkServeService({
    getArtworkAssetByIdFn: async () => null,
  });

  await assert.rejects(
    () => serve.serveArtworkFile({ assetId: 'nonexistent-id' }),
    (error) => error.status === 404 && error.code === 'artwork_asset_not_found',
  );
});

test('serveArtworkFile throws 404 when file is not found on disk', async () => {
  const serve = createArtworkServeService({
    getArtworkAssetByIdFn: async () => ({
      id: 'asset-1',
      relativePath: 'originals/ab/cd/abcdef.jpg',
      mimeType: 'image/jpeg',
    }),
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        storage: { root: '/app/data/artwork' },
      }),
    },
    statFn: async () => { throw new Error('ENOENT'); },
  });

  await assert.rejects(
    () => serve.serveArtworkFile({ assetId: 'asset-1' }),
    (error) => error.status === 404 && error.code === 'artwork_asset_not_found',
  );
});

test('serveArtworkFile returns file metadata for a valid asset', async () => {
  const fakeStats = { size: 2048 };
  const serve = createArtworkServeService({
    getArtworkAssetByIdFn: async () => ({
      id: 'asset-1',
      relativePath: 'originals/ab/cd/abcdef.jpg',
      mimeType: 'image/jpeg',
    }),
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        storage: { root: '/app/data/artwork' },
      }),
    },
    statFn: async () => fakeStats,
  });

  const result = await serve.serveArtworkFile({ assetId: 'asset-1' });

  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.fileSize, 2048);
  assert.equal(result.absolutePath, path.resolve('/app/data/artwork', 'originals/ab/cd/abcdef.jpg'));
});

test('serveArtworkFile rejects path traversal attempts', async () => {
  const serve = createArtworkServeService({
    getArtworkAssetByIdFn: async () => ({
      id: 'asset-evil',
      relativePath: '../../etc/passwd',
      mimeType: 'text/plain',
    }),
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        storage: { root: '/app/data/artwork' },
      }),
    },
  });

  await assert.rejects(
    () => serve.serveArtworkFile({ assetId: 'asset-evil' }),
    (error) => error.status === 404 && error.code === 'artwork_asset_not_found',
  );
});

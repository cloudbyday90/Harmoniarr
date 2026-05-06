import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  buildArtworkRelativePath,
  createArtworkIngestionService,
  prepareArtworkAsset,
} from '../../src/server/artwork/artwork-ingestion-service.js';

test('buildArtworkRelativePath places extracted and original assets into the expected subtrees', () => {
  assert.equal(
    buildArtworkRelativePath({ extension: 'jpg', sha256: 'abcdef123456', storageClass: 'provider_original' }),
    'originals/ab/cd/abcdef123456.jpg',
  );
  assert.equal(
    buildArtworkRelativePath({ extension: 'png', sha256: 'abcdef123456', storageClass: 'extracted_embedded' }),
    'extracted/ab/cd/abcdef123456.png',
  );
});

test('prepareArtworkAsset validates and rewrites a supported image using the shared policy', async () => {
  const buffer = await sharp({
    create: {
      background: { alpha: 1, b: 25, g: 50, r: 75 },
      channels: 3,
      height: 300,
      width: 200,
    },
  }).png().toBuffer();

  const prepared = await prepareArtworkAsset({
    buffer,
    fetchedAt: '2026-05-01T12:00:00.000Z',
    policy: {
      limits: {
        maxOriginalDimensionPixels: 1024,
        maxOriginalFileSizeBytes: 1024 * 1024,
      },
      storage: {
        root: '/app/data/artwork',
      },
    },
    sourceProvider: 'coverArtArchive',
    sourceUrl: 'https://coverartarchive.org/release/example/front.png',
    storageClass: 'provider_original',
  });

  assert.equal(prepared.asset.storageNamespace, 'artwork');
  assert.equal(prepared.asset.mimeType, 'image/png');
  assert.equal(prepared.asset.width, 200);
  assert.equal(prepared.asset.height, 300);
  assert.equal(prepared.asset.sourceProvider, 'coverArtArchive');
  assert.match(prepared.asset.relativePath, /^originals\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.png$/);
  assert.ok(prepared.data.length > 0);
});

test('prepareArtworkAsset rejects unsupported or oversized artwork before persistence', async () => {
  await assert.rejects(
    () => prepareArtworkAsset({
      buffer: Buffer.from('<svg></svg>'),
      inspectArtworkBufferFn: async () => ({ format: 'svg', height: 10, width: 10 }),
      policy: {
        limits: {
          maxOriginalDimensionPixels: 1024,
          maxOriginalFileSizeBytes: 1024 * 1024,
        },
        storage: {
          root: '/app/data/artwork',
        },
      },
    }),
    { code: 'artwork_format_unsupported', status: 400 },
  );

  await assert.rejects(
    () => prepareArtworkAsset({
      buffer: Buffer.alloc(32),
      inspectArtworkBufferFn: async () => ({ format: 'png', height: 5000, width: 5000 }),
      policy: {
        limits: {
          maxOriginalDimensionPixels: 1024,
          maxOriginalFileSizeBytes: 1024 * 1024,
        },
        storage: {
          root: '/app/data/artwork',
        },
      },
      sanitizeArtworkBufferFn: async () => ({
        data: Buffer.from('ignored'),
        info: { height: 5000, size: 7, width: 5000 },
      }),
    }),
    { code: 'artwork_dimensions_too_large', status: 400 },
  );
});

test('createArtworkIngestionService persists sanitized artwork into the configured storage tree', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'harmoniarr-artwork-ingestion-'));
  const buffer = await sharp({
    create: {
      background: { alpha: 1, b: 30, g: 20, r: 10 },
      channels: 3,
      height: 64,
      width: 64,
    },
  }).jpeg().toBuffer();
  const upsertArtworkAsset = t.mock.fn(async (asset) => ({ id: 'asset-1', ...asset }));
  const artworkIngestionService = createArtworkIngestionService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        limits: {
          maxOriginalDimensionPixels: 1024,
          maxOriginalFileSizeBytes: 1024 * 1024,
        },
        storage: {
          root,
        },
      }),
    },
    getArtworkAssetBySha256Fn: async () => null,
    upsertArtworkAssetFn: upsertArtworkAsset,
  });

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  const result = await artworkIngestionService.ingestArtworkBuffer({
    buffer,
    sourceProvider: 'embedded',
    storageClass: 'extracted_embedded',
  });

  assert.equal(result.stored, true);
  assert.equal(upsertArtworkAsset.mock.callCount(), 1);
  assert.match(result.asset.relativePath, /^extracted\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.jpg$/);
  await access(result.absolutePath);
});

test('prepareArtworkAsset extracts dominant color for vibrant artwork', async () => {
  const buffer = await sharp({
    create: {
      // Pure saturated red — high chroma, well above VIBRANCY_THRESHOLD
      background: { alpha: 1, b: 0, g: 0, r: 255 },
      channels: 3,
      height: 64,
      width: 64,
    },
  }).png().toBuffer();

  const prepared = await prepareArtworkAsset({
    buffer,
    policy: {
      limits: {
        maxOriginalDimensionPixels: 1024,
        maxOriginalFileSizeBytes: 1024 * 1024,
      },
      storage: { root: '/app/data/artwork' },
    },
    sharpStatsFn: async () => ({ dominant: { r: 255, g: 0, b: 0 } }),
    storageClass: 'provider_original',
  });

  assert.ok(prepared.asset.dominantHue !== null, 'dominantHue should be set for vibrant color');
  assert.ok(prepared.asset.dominantChroma !== null, 'dominantChroma should be set for vibrant color');
  assert.ok(prepared.asset.dominantLightness !== null, 'dominantLightness should be set for vibrant color');
  assert.ok(prepared.asset.dominantChroma > 0.05, `Expected chroma > 0.05, got ${prepared.asset.dominantChroma}`);
});

test('prepareArtworkAsset leaves dominant color fields null for achromatic artwork', async () => {
  const buffer = await sharp({
    create: {
      // Pure neutral grey — chroma near zero, below VIBRANCY_THRESHOLD
      background: { alpha: 1, b: 128, g: 128, r: 128 },
      channels: 3,
      height: 64,
      width: 64,
    },
  }).png().toBuffer();

  const prepared = await prepareArtworkAsset({
    buffer,
    policy: {
      limits: {
        maxOriginalDimensionPixels: 1024,
        maxOriginalFileSizeBytes: 1024 * 1024,
      },
      storage: { root: '/app/data/artwork' },
    },
    // Grey: chroma ≈ 0 → below vibrancy threshold → all dominant fields null
    sharpStatsFn: async () => ({ dominant: { r: 128, g: 128, b: 128 } }),
    storageClass: 'provider_original',
  });

  assert.equal(prepared.asset.dominantHue, null, 'dominantHue should be null for grey');
  assert.equal(prepared.asset.dominantChroma, null, 'dominantChroma should be null for grey');
  assert.equal(prepared.asset.dominantLightness, null, 'dominantLightness should be null for grey');
});

test('prepareArtworkAsset leaves dominant color fields null when sharpStatsFn throws (non-fatal)', async () => {
  const buffer = await sharp({
    create: {
      background: { alpha: 1, b: 100, g: 100, r: 100 },
      channels: 3,
      height: 64,
      width: 64,
    },
  }).png().toBuffer();

  const prepared = await prepareArtworkAsset({
    buffer,
    policy: {
      limits: {
        maxOriginalDimensionPixels: 1024,
        maxOriginalFileSizeBytes: 1024 * 1024,
      },
      storage: { root: '/app/data/artwork' },
    },
    sharpStatsFn: async () => { throw new Error('stats unavailable'); },
    storageClass: 'provider_original',
  });

  assert.equal(prepared.asset.dominantHue, null, 'dominantHue should be null on error');
  assert.equal(prepared.asset.dominantChroma, null, 'dominantChroma should be null on error');
  assert.equal(prepared.asset.dominantLightness, null, 'dominantLightness should be null on error');
});
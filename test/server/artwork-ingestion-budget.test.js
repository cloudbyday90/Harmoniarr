import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createArtworkIngestionService, inspectArtworkBuffer } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { readArtworkFile } from '../../src/server/artwork/artwork-file-reader.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createLibraryEmbeddedArtworkService } from '../../src/server/library/library-embedded-artwork-service.js';
import { createLibrarySidecarArtworkService } from '../../src/server/library/library-sidecar-artwork-service.js';
import { getArtworkBufferStats } from '../../src/server/artwork/artwork-image-processing.js';

test('native dominant-color statistics obey the same input-pixel policy', async () => {
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(getArtworkBufferStats(buffer, { maxDimensionPixels: 1 }));
  const stats = await getArtworkBufferStats(buffer, { maxDimensionPixels: 8 });
  assert.ok(stats.dominant.r > stats.dominant.g); assert.ok(stats.dominant.r > stats.dominant.b);
});

test('one default ingestion budget covers buffers, files, embedded, sidecar and provider work through asset publication', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-ingestion-budget-'));
  const held = Promise.withResolvers(); const entered = Promise.withResolvers(); const tasks = [];
  let inspections = 0; let reads = 0; let upserts = 0; let assignments = 0;
  const artworkPolicyService = { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true },
    limits: { maxOriginalDimensionPixels: 64, maxOriginalFileSizeBytes: 1024 * 1024 }, storage: { root } }) };
  const ingestion = createArtworkIngestionService({ artworkPolicyService,
    readFileFn: (...args) => { reads++; return readArtworkFile(...args); },
    inspectArtworkBufferFn: (...args) => { inspections++; return inspectArtworkBuffer(...args); },
    getArtworkAssetBySha256Fn: async () => null,
    upsertArtworkAssetFn: async asset => { upserts++; const id = `asset-${upserts}`;
      if (upserts === 2) entered.resolve(); if (upserts <= 2) await held.promise; return { ...asset, id }; },
  });
  const artworkAssignmentService = { assignPreferredArtwork: async () => { assignments++; return {}; } };
  try {
    const buffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'red' } }).png().toBuffer();
    const source = join(root, 'source.png'); await writeFile(source, buffer);
    const embedded = createLibraryEmbeddedArtworkService({ artworkIngestionService: ingestion, artworkAssignmentService, selectEmbeddedCover: pictures => pictures[0] });
    const sidecar = createLibrarySidecarArtworkService({ artworkIngestionService: ingestion, artworkAssignmentService });
    const fetch = createArtworkFetchService({ artworkIngestionService: ingestion, artworkPolicyService, artworkAssignmentService,
      listArtworkAssignmentsFn: async () => [], downloadImageFn: async () => buffer,
      fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/image.png' }] } });
    tasks.push(ingestion.ingestArtworkBuffer({ buffer }), ingestion.ingestArtworkFile({ filePath: source }),
      embedded.captureEmbeddedArtwork({ libraryFileId: 'file-1', metadata: { common: { picture: [{ data: buffer, format: 'image/png' }] } } }),
      sidecar.captureSidecarArtwork({ files: [
        { id: 'cover', filename: 'cover.png', extension: '.png', relativePath: 'album/cover.png', canonicalPath: source, fileState: 'sidecar' },
        { id: 'track', filename: 'song.mp3', extension: '.mp3', relativePath: 'album/song.mp3', fileState: 'observed' },
      ] }), fetch.resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'artist', artworkRole: 'artist_thumbnail' }));
    await Promise.race([entered.promise, Promise.all(tasks).then(() => assert.fail('completed before hold'))]);
    assert.equal(inspections, 2); assert.equal(reads, 1); assert.equal(upserts, 2); assert.equal(assignments, 0);
    held.resolve(); await Promise.all(tasks);
    assert.equal(inspections, 5); assert.equal(reads, 2); assert.equal(upserts, 5); assert.equal(assignments, 3);
  } finally { held.resolve(); await Promise.allSettled(tasks); await rm(root, { recursive: true, force: true }); }
});

test('file ingestion acquires once, waits before reading, cancels queued reads and observes fresh policy', async () => {
  const gate = createArtworkIngestionAdmission({ concurrency: 1 }); const held = Promise.withResolvers(); const entered = Promise.withResolvers();
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  let limit = 1024; let reads = 0; let writes = 0;
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits: { maxOriginalFileSizeBytes: limit, maxOriginalDimensionPixels: 8 }, storage: { root: '/owned' } }) },
    inspectArtworkBufferFn: async (...args) => { entered.resolve(); await held.promise; return inspectArtworkBuffer(...args); },
    readFileFn: async () => { reads++; return buffer; }, mkdirFn: async () => {}, writeFileFn: async () => { writes++; },
    getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => ({ ...asset, id: 'asset' }),
  });
  const active = service.ingestArtworkBuffer({ buffer }); await entered.promise;
  const controller = new AbortController();
  const cancelled = service.ingestArtworkFile({ filePath: 'never-read', signal: controller.signal });
  const cancelledCheck = assert.rejects(cancelled, { code: 'artwork_ingestion_cancelled' });
  const next = service.ingestArtworkFile({ filePath: 'read-after-admission' }); const nextCheck = assert.rejects(next, { code: 'artwork_file_too_large' });
  try { controller.abort(); await cancelledCheck; assert.equal(reads, 0); limit = 1; }
  finally { held.resolve(); await Promise.allSettled([active, nextCheck]); }
  await active; await nextCheck; assert.equal(reads, 1); assert.equal(writes, 1);
  assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
});

test('ingestion capacity is preserved through the real fetch batch and does not publish absence backoff', async () => {
  const gate = createArtworkIngestionAdmission({ concurrency: 1, maxQueued: 0 }); const held = Promise.withResolvers();
  const active = gate.run(() => held.promise); let backoffs = 0;
  const ingestion = createArtworkIngestionService({ artworkIngestionAdmission: gate });
  const fetch = createArtworkFetchService({ artworkIngestionService: ingestion,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) },
    listArtworkAssignmentsFn: async () => [], downloadImageFn: async () => Buffer.from('image'),
    fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/image.png' }] },
    artworkFetchBackoffService: { shouldBackoff: async () => ({ active: false }), recordFailure: async () => { backoffs++; }, clearFailure: async () => {} },
  });
  try { await assert.rejects(fetch.resolveArtworkBatch([{ ownerType: 'musicbrainz_artist', ownerId: 'artist', artworkRole: 'artist_thumbnail' }]), { code: 'artwork_ingestion_capacity', status: 503 }); }
  finally { held.resolve(); await active; }
  assert.equal(backoffs, 0);
});

test('ingestion releases its permit after Error/null persistence failures', async () => {
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  const gate = createArtworkIngestionAdmission({ concurrency: 1 }); let count = 0; const original = new Error('owned');
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits: { maxOriginalDimensionPixels: 8 }, storage: { root: '/owned' } }) },
    getArtworkAssetBySha256Fn: async () => null, mkdirFn: async () => {}, writeFileFn: async () => {},
    upsertArtworkAssetFn: async asset => { count++; if (count === 1) throw original; if (count === 2) throw null; return { ...asset, id: 'healthy' }; },
  });
  await assert.rejects(service.ingestArtworkBuffer({ buffer }), error => error === original);
  await assert.rejects(service.ingestArtworkBuffer({ buffer }), error => error === null);
  assert.equal((await service.ingestArtworkBuffer({ buffer })).asset.id, 'healthy');
  assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
});

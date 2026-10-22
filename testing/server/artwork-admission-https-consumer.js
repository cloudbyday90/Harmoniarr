/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createArtworkFetchAdmission } from '../../src/server/artwork/artwork-fetch-admission.js';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createArtworkIngestionService } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';
import { createArtworkEgressFixture } from './artwork-egress-fixture.js';

const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-admission-'));
const admission = createArtworkFetchAdmission();
const entered = Promise.withResolvers(); const held = Promise.withResolvers();
const assets = []; const publications = []; const tasks = [];
let downloads = 0; let rewrites = 0; let peakActive = 0;
const policy = { fetch: { enabled: true }, limits: { maxOriginalFileSizeBytes: 1024 * 1024,
  maxOriginalDimensionPixels: 128 }, storage: { root } };
const artworkPolicyService = { getArtworkRuntimePolicy: async () => policy };
const egress = createArtworkEgressFixture();
const transport = createArtworkImageDownloadService({ fetchImpl: egress.fetchImpl });
const ingestion = createArtworkIngestionService({ artworkPolicyService,
  getArtworkAssetBySha256Fn: async () => null,
  upsertArtworkAssetFn: async asset => { const saved = { ...asset, id: `asset-${assets.length}` }; assets.push(saved); return saved; } });
const service = createArtworkFetchService({ artworkPolicyService, artworkFetchAdmission: admission,
  listArtworkAssignmentsFn: async () => [],
  coverArtArchiveClient: createCoverArtArchiveClient({ maxRetries: 0, fetchImpl: egress.fetchImpl }),
  theAudioDbClient: { fetchArtistImages: async ({ mbid }) => mbid.endsWith('audio')
    ? [{ imageType: 'artistthumb', url: 'https://www.theaudiodb.com/images/normal.png' }] : [] },
  fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/normal.png' }] },
  downloadImageFn: async (...args) => { downloads++; return transport.downloadImageBuffer(...args); },
  artworkIngestionService: { ingestArtworkBuffer: async input => {
    const result = await ingestion.ingestArtworkBuffer(input); rewrites++; return result;
  } },
  artworkAssignmentService: { assignPreferredArtwork: async input => {
    publications.push(input); peakActive = Math.max(peakActive, admission.getState().active);
    if (publications.length === 2) entered.resolve();
    if (publications.length <= 2) await held.promise;
  } },
});
const request = ownerId => ({ ownerId, ownerType: 'musicbrainz_artist', artworkRole: 'artist_thumbnail' });
try {
  const batch = service.resolveArtworkBatch(Array.from({ length: 6 }, (_, i) => request(`${i}-${i % 2 ? 'audio' : 'fanart'}`)));
  tasks.push(batch);
  await Promise.race([entered.promise, batch.then(() => assert.fail('completed before publication hold'))]);
  assert.equal(downloads, 2); assert.equal(rewrites, 2); assert.equal(publications.length, 2);
  assert.deepEqual(admission.getState(), { active: 2, queued: 0 });
  const single = service.resolveArtwork({ ownerId: 'release', ownerType: 'musicbrainz_release' }); tasks.push(single);
  const controller = new AbortController();
  const cancelled = service.resolveArtwork({ ...request('never-contacted'), signal: controller.signal });
  const cancelledCheck = assert.rejects(cancelled, { code: 'artwork_fetch_cancelled' }); tasks.push(cancelledCheck);
  controller.abort(); await cancelledCheck;
  assert.deepEqual(admission.getState(), { active: 2, queued: 1 });
  assert.equal(egress.pins.length, 2);
  held.resolve();
  assert.equal(Object.keys(await batch).length, 6); assert.equal((await single).sourceProvider, 'coverArtArchive');
  assert.equal(assets.length, 7); assert.equal(publications.length, 7); assert.equal(rewrites, 7); assert.equal(peakActive, 2);
  assert.deepEqual(admission.getState(), { active: 0, queued: 0 });
  for (const asset of assets) {
    const metadata = await sharp(await readFile(join(root, asset.relativePath))).metadata();
    assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 16); assert.equal(metadata.height, 16);
  }
  assert.deepEqual(new Set(publications.map(row => row.sourceProvider)), new Set(['fanartTv', 'theAudioDb', 'coverArtArchive']));
  console.log(JSON.stringify({ scenario: process.argv[2], node: process.versions.node, admissionPassed: true,
    images: 7, peakActive, queuedCancelled: true, publications: publications.length,
    tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
} finally {
  held.resolve(); await Promise.allSettled(tasks);
  await rm(root, { recursive: true, force: true });
}

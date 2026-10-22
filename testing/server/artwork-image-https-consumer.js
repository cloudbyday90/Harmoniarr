/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createArtworkIngestionService } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';

const host = 'https://assets.fanart.tv/';
const get = createArtworkImageDownloadService({ requestTimeoutMs: 1200 }).downloadImage;
const options = { sourceProvider: 'fanartTv', limits: { maxOriginalFileSizeBytes: 256 } };
async function refused(path, diagnosticCode) {
  await assert.rejects(get(new URL(path, host), options), error => {
    assert.equal(error.diagnosticCode, diagnosticCode);
    assert.equal(inspect(error).includes('PRIVATE-image-fixture'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false); return true;
  });
}

async function normal() {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-native-image-'));
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  const policy = { fetch: { enabled: true }, limits: { maxOriginalFileSizeBytes: 1024 * 1024, maxOriginalDimensionPixels: 128 }, storage: { root } };
  const artworkPolicyService = { getArtworkRuntimePolicy: async () => policy };
  const assets = []; const assignments = [];
  const artworkIngestionService = createArtworkIngestionService({ artworkPolicyService,
    getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => { assets.push(asset); return { ...asset, id: `asset-${assets.length}` }; } });
  try {
    for (const sourceProvider of ['fanartTv', 'theAudioDb', 'coverArtArchive']) {
      const clients = sourceProvider === 'coverArtArchive' ? { coverArtArchiveClient: createCoverArtArchiveClient({ maxRetries: 0 }) }
        : sourceProvider === 'fanartTv' ? { fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: `${host}normal.png` }] } }
          : { theAudioDbClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://www.theaudiodb.com/images/normal.png' }] } };
      const service = createArtworkFetchService({ ...clients, artworkPolicyService, artworkIngestionService,
        listArtworkAssignmentsFn: async () => [], artworkAssignmentService: { assignPreferredArtwork: async input => { assignments.push(input); } } });
      const ownerType = sourceProvider === 'coverArtArchive' ? 'musicbrainz_release_group' : 'musicbrainz_artist';
      const artworkRole = sourceProvider === 'coverArtArchive' ? 'cover_front' : 'artist_thumbnail';
      const result = await service.resolveArtwork({ ownerType, ownerId: sourceProvider, artworkRole });
      assert.equal(result.sourceProvider, sourceProvider); assert.equal(result.assetId, `asset-${assets.length}`);
    }
    assert.equal(assets.length, 3); assert.equal(assignments.length, 3);
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      const bytes = await readFile(join(root, asset.relativePath));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 16); assert.equal(metadata.height, 16);
      assert.equal(assignments[index].ownerId, asset.sourceProvider);
    }
    assert.equal(assets[2].sourceUrl, 'https://s3.us.archive.org/mbid-fixture/image.png');
  } finally { await rm(root, { recursive: true, force: true }); }
}

const scenario = process.argv[2];
if (scenario === 'normal') await normal();
else if (scenario === 'bounds') {
  assert.equal((await get(new URL('exact', host), options)).buffer.length, 256);
  for (const [path, kind] of [['large', 'body_too_large'], ['declared', 'body_too_large'], ['gzip', 'encoding_refused'],
    ['svg', 'format_refused'], ['redirect', 'redirect_refused']]) await refused(path, kind);
  assert.ok((await get(new URL('healthy', host), options)).buffer.length > 0);
} else if (scenario === 'adverse') {
  for (const path of ['headers-stall', 'body-stall', 'trickle']) await refused(path, 'timeout');
  assert.ok((await get(new URL('healthy', host), options)).buffer.length > 0);
} else throw new Error('Unknown artwork fixture scenario');
console.log(JSON.stringify({ scenario, node: process.versions.node, imageBoundaryPassed: true,
  tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));

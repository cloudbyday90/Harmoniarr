import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';

test('resolveArtwork returns null when fetch is disabled', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: false } }),
    },
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release_group',
  });

  assert.equal(result.url, null);
  assert.equal(result.assetId, null);
  assert.equal(result.cached, false);
});

test('resolveArtwork returns cached assignment when one exists', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    listArtworkAssignmentsFn: async () => [
      {
        artworkAssetId: 'asset-1',
        artworkRole: 'cover_front',
        isPreferred: true,
        sourceProvider: 'coverArtArchive',
      },
    ],
  });

  const result = await fetchService.resolveArtwork({
    artworkRole: 'cover_front',
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release_group',
  });

  assert.equal(result.url, '/api/v1/artwork/assets/asset-1/file');
  assert.equal(result.assetId, 'asset-1');
  assert.equal(result.cached, true);
  assert.equal(result.sourceProvider, 'coverArtArchive');
});

test('resolveArtwork returns null when no CAA client is configured', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: null,
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release_group',
  });

  assert.equal(result.url, null);
  assert.equal(result.assetId, null);
});

test('resolveArtwork fetches from CAA and creates assignment', async () => {
  const fakeImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
  const fakeAsset = {
    id: 'new-asset-1',
    dominantChroma: 0.05,
    dominantHue: 210,
    dominantLightness: 0.45,
  };

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => ({
        buffer: fakeImageBuffer,
        contentType: 'image/jpeg',
        sourceUrl: 'https://archive.org/download/test/image.jpg',
      }),
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => ({
        absolutePath: '/tmp/test.jpg',
        asset: fakeAsset,
      }),
    },
    artworkAssignmentService: {
      assignPreferredArtwork: async () => ({}),
    },
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release_group',
    artworkRole: 'cover_front',
  });

  assert.equal(result.url, '/api/v1/artwork/assets/new-asset-1/file');
  assert.equal(result.assetId, 'new-asset-1');
  assert.equal(result.cached, false);
  assert.equal(result.sourceProvider, 'coverArtArchive');
  assert.equal(result.dominantColor.hue, 210);
});

test('resolveArtwork returns null when CAA has no artwork', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release_group',
  });

  assert.equal(result.url, null);
  assert.equal(result.assetId, null);
});

test('resolveArtwork returns null for unsupported owner types', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => { throw new Error('should not be called'); },
    },
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'artist-1',
    ownerType: 'metadata_artist',
  });

  assert.equal(result.url, null);
});

test('resolveArtworkBatch resolves multiple requests', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    listArtworkAssignmentsFn: async ({ ownerId }) => {
      if (ownerId === 'cached-mbid') {
        return [{
          artworkAssetId: 'cached-asset',
          artworkRole: 'cover_front',
          isPreferred: true,
          sourceProvider: 'coverArtArchive',
        }];
      }
      return [];
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
  });

  const results = await fetchService.resolveArtworkBatch([
    { ownerType: 'musicbrainz_release_group', ownerId: 'cached-mbid' },
    { ownerType: 'musicbrainz_release_group', ownerId: 'uncached-mbid' },
  ]);

  const cachedKey = 'musicbrainz_release_group:cached-mbid:cover_front';
  const uncachedKey = 'musicbrainz_release_group:uncached-mbid:cover_front';

  assert.equal(results[cachedKey].cached, true);
  assert.equal(results[cachedKey].url, '/api/v1/artwork/assets/cached-asset/file');
  assert.equal(results[uncachedKey].url, null);
});

test('resolveArtworkBatch handles errors gracefully', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    listArtworkAssignmentsFn: async () => {
      throw new Error('DB error');
    },
  });

  const results = await fetchService.resolveArtworkBatch([
    { ownerType: 'musicbrainz_release_group', ownerId: 'mbid-1' },
  ]);

  const key = 'musicbrainz_release_group:mbid-1:cover_front';
  assert.equal(results[key].url, null);
});

test('resolveArtwork fetches artist thumbnail from Fanart.tv', async () => {
  const fakeAsset = { id: 'fanart-asset-1', dominantChroma: null, dominantHue: null, dominantLightness: null };
  const fakeImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    listArtworkAssignmentsFn: async () => [],
    fanartTvClient: {
      fetchArtistImages: async () => [
        { imageType: 'artistthumb', url: 'https://assets.fanart.tv/thumb.jpg', id: '100', likes: 10 },
      ],
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => ({ absolutePath: '/tmp/thumb.jpg', asset: fakeAsset }),
    },
    artworkAssignmentService: {
      assignPreferredArtwork: async () => ({}),
    },
    downloadImageFn: async () => fakeImageBuffer,
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'artist-mbid-1',
    ownerType: 'musicbrainz_artist',
    artworkRole: 'artist_thumbnail',
  });

  assert.equal(result.url, '/api/v1/artwork/assets/fanart-asset-1/file');
  assert.equal(result.assetId, 'fanart-asset-1');
  assert.equal(result.sourceProvider, 'fanartTv');
  assert.equal(result.cached, false);
});

test('resolveArtwork falls through to Fanart.tv for release groups when CAA returns nothing', async () => {
  const fakeAsset = { id: 'fanart-album-1', dominantChroma: null, dominantHue: null, dominantLightness: null };
  const fakeImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    listArtworkAssignmentsFn: async () => [],
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
    fanartTvClient: {
      fetchAlbumImages: async () => [
        { imageType: 'albumcover', url: 'https://assets.fanart.tv/album.jpg', id: '200', likes: 5 },
      ],
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => ({ absolutePath: '/tmp/album.jpg', asset: fakeAsset }),
    },
    artworkAssignmentService: {
      assignPreferredArtwork: async () => ({}),
    },
    downloadImageFn: async () => fakeImageBuffer,
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'rg-mbid-1',
    ownerType: 'musicbrainz_release_group',
    artworkRole: 'cover_front',
  });

  assert.equal(result.sourceProvider, 'fanartTv');
  assert.equal(result.url, '/api/v1/artwork/assets/fanart-album-1/file');
});

test('resolveArtwork skips CAA when quota is exceeded', async () => {
  const quotaService = {
    isQuotaExceeded: async (provider) => provider === 'coverArtArchive',
    incrementQuota: async () => {},
  };
  let caaCalled = false;

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    artworkQuotaService: quotaService,
    coverArtArchiveClient: {
      fetchFrontImage: async () => { caaCalled = true; return null; },
    },
    listArtworkAssignmentsFn: async () => [],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release',
    artworkRole: 'cover_front',
  });

  assert.equal(caaCalled, false);
  assert.equal(result.url, null);
  assert.equal(result.quotaExceeded, true);
});

test('resolveArtwork increments quota after successful CAA fetch', async (t) => {
  const incrementFn = t.mock.fn(async () => 1);
  const fakeAsset = { id: 'asset-1', dominantChroma: null, dominantHue: null, dominantLightness: null };

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    artworkQuotaService: {
      isQuotaExceeded: async () => false,
      incrementQuota: incrementFn,
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => ({ buffer: Buffer.from([0xFF]), sourceUrl: 'https://example.com/img.jpg' }),
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => ({ asset: fakeAsset }),
    },
    artworkAssignmentService: {
      assignPreferredArtwork: async () => ({}),
    },
    listArtworkAssignmentsFn: async () => [],
  });

  await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release',
    artworkRole: 'cover_front',
  });

  assert.equal(incrementFn.mock.callCount(), 1);
  assert.equal(incrementFn.mock.calls[0].arguments[0], 'coverArtArchive');
});

test('resolveArtwork increments Fanart.tv quota after successful fetch', async (t) => {
  const incrementFn = t.mock.fn(async () => 1);
  const fakeAsset = { id: 'asset-2', dominantChroma: null, dominantHue: null, dominantLightness: null };

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    artworkQuotaService: {
      isQuotaExceeded: async () => false,
      incrementQuota: incrementFn,
    },
    fanartTvClient: {
      fetchArtistImages: async () => [
        { imageType: 'artistthumb', url: 'https://fanart.tv/thumb.jpg', id: '10', likes: 5 },
      ],
    },
    artworkIngestionService: {
      ingestArtworkBuffer: async () => ({ asset: fakeAsset }),
    },
    artworkAssignmentService: {
      assignPreferredArtwork: async () => ({}),
    },
    downloadImageFn: async () => Buffer.from([0xFF]),
    listArtworkAssignmentsFn: async () => [],
  });

  await fetchService.resolveArtwork({
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
    artworkRole: 'artist_thumbnail',
  });

  assert.equal(incrementFn.mock.callCount(), 1);
  assert.equal(incrementFn.mock.calls[0].arguments[0], 'fanartTv');
});

test('resolveArtwork does not increment quota when cached', async (t) => {
  const incrementFn = t.mock.fn(async () => {});

  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    artworkQuotaService: {
      isQuotaExceeded: async () => false,
      incrementQuota: incrementFn,
    },
    listArtworkAssignmentsFn: async () => [
      { artworkAssetId: 'cached-1', artworkRole: 'cover_front', isPreferred: true, sourceProvider: 'coverArtArchive' },
    ],
  });

  await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release',
    artworkRole: 'cover_front',
  });

  assert.equal(incrementFn.mock.callCount(), 0);
});

test('resolveArtwork with refresh=true skips cached assignment', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
    listArtworkAssignmentsFn: async () => [
      {
        artworkAssetId: 'cached-asset',
        artworkRole: 'cover_front',
        isPreferred: true,
        sourceProvider: 'coverArtArchive',
      },
    ],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release',
    artworkRole: 'cover_front',
    refresh: true,
  });

  assert.equal(result.cached, false);
  assert.equal(result.url, null);
});

test('resolveArtwork with refresh=false returns cached assignment', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
    listArtworkAssignmentsFn: async () => [
      {
        artworkAssetId: 'cached-asset',
        artworkRole: 'cover_front',
        isPreferred: true,
        sourceProvider: 'coverArtArchive',
      },
    ],
  });

  const result = await fetchService.resolveArtwork({
    ownerId: 'mbid-1',
    ownerType: 'musicbrainz_release',
    artworkRole: 'cover_front',
    refresh: false,
  });

  assert.equal(result.cached, true);
  assert.equal(result.url, '/api/v1/artwork/assets/cached-asset/file');
});

test('resolveArtworkBatch forwards refresh=true to resolveArtwork', async () => {
  const fetchService = createArtworkFetchService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }),
    },
    coverArtArchiveClient: {
      fetchFrontImage: async () => null,
    },
    listArtworkAssignmentsFn: async () => [
      { artworkAssetId: 'cached-1', artworkRole: 'cover_front', isPreferred: true, sourceProvider: 'coverArtArchive' },
    ],
  });

  const results = await fetchService.resolveArtworkBatch([
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-refresh', artworkRole: 'cover_front', refresh: true },
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-norefresh', artworkRole: 'cover_front', refresh: false },
  ]);

  assert.equal(results['musicbrainz_release:mbid-refresh:cover_front'].cached, false);
  assert.equal(results['musicbrainz_release:mbid-refresh:cover_front'].url, null);
  assert.equal(results['musicbrainz_release:mbid-norefresh:cover_front'].cached, true);
  assert.equal(results['musicbrainz_release:mbid-norefresh:cover_front'].url, '/api/v1/artwork/assets/cached-1/file');
});

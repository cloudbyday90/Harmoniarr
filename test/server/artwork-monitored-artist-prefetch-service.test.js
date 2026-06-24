import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkMonitoredArtistPrefetchService } from '../../src/server/artwork/artwork-monitored-artist-prefetch-service.js';

test('prefetchMonitoredArtistArtwork reuses the shared artwork fetch service for monitored artists', async (t) => {
  const resolveArtwork = t.mock.fn(async ({ ownerId, artworkRole }) => {
    if (ownerId === 'mbid-cached') {
      return { assetId: `cached-${artworkRole}`, cached: true, quotaExceeded: false, url: `/cached/${artworkRole}` };
    }

    if (ownerId === 'mbid-fetched' && artworkRole === 'artist_thumbnail') {
      return { assetId: 'new-thumb', cached: false, quotaExceeded: false, url: '/new-thumb' };
    }

    if (ownerId === 'mbid-fetched' && artworkRole === 'artist_background') {
      return { assetId: null, cached: false, quotaExceeded: true, url: null };
    }

    return { assetId: null, cached: false, quotaExceeded: false, url: null };
  });

  const service = createArtworkMonitoredArtistPrefetchService({
    artworkFetchService: { resolveArtwork },
    defaultLimit: 10,
    getPoolFn: () => 'pool-token',
    listMonitoredArtistsQuery: t.mock.fn(async ({ limit }) => {
      assert.equal(limit, 10);

      return [
        { metadataArtistId: 1, musicbrainzArtistId: 'mbid-cached' },
        { metadataArtistId: 2, musicbrainzArtistId: 'mbid-fetched' },
        { metadataArtistId: 3, musicbrainzArtistId: null },
      ];
    }),
  });

  const summary = await service.prefetchMonitoredArtistArtwork();

  assert.equal(resolveArtwork.mock.callCount(), 4);
  assert.deepEqual(summary, {
    artworkRoles: ['artist_thumbnail', 'artist_background'],
    cachedCount: 2,
    eligibleArtistCount: 2,
    failedCount: 0,
    fetchedCount: 1,
    limit: 10,
    missingCount: 0,
    processedArtistCount: 2,
    quotaExceededCount: 1,
    requestCount: 4,
    skippedArtistCount: 1,
    totalMonitoredCount: 3,
  });
});

test('prefetchMonitoredArtistArtwork counts per-role failures without aborting the run', async (t) => {
  const service = createArtworkMonitoredArtistPrefetchService({
    artworkFetchService: {
      resolveArtwork: t.mock.fn(async ({ artworkRole }) => {
        if (artworkRole === 'artist_background') {
          throw new Error('fanart failed');
        }

        return { assetId: null, cached: false, quotaExceeded: false, url: null };
      }),
    },
    artworkRoles: ['artist_thumbnail', 'artist_background'],
    defaultLimit: 5,
    getPoolFn: () => 'pool-token',
    listMonitoredArtistsQuery: async () => [
      { metadataArtistId: 9, musicbrainzArtistId: 'mbid-1' },
    ],
  });

  const summary = await service.prefetchMonitoredArtistArtwork({ limit: 5 });

  assert.equal(summary.requestCount, 2);
  assert.equal(summary.missingCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.processedArtistCount, 1);
});

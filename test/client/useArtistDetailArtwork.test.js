import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, ref } from 'vue';
import {
  buildArtistDetailDiscographyArtworkRequests,
  buildArtistDetailRelatedArtworkRequests,
  useArtistDetailArtwork,
} from '../../src/client/composables/useArtistDetailArtwork.js';

test('buildArtistDetailDiscographyArtworkRequests deduplicates release-group ids and skips cached artwork', () => {
  const requests = buildArtistDetailDiscographyArtworkRequests([
    {
      releases: [
        { musicbrainzReleaseGroupId: 'rg-1' },
        { musicbrainzReleaseGroupId: 'rg-2' },
        { musicbrainzReleaseGroupId: 'rg-1' },
      ],
    },
  ], {
    'musicbrainz_release_group:rg-2:cover_front': { url: '/art/rg-2.webp' },
  });

  assert.deepEqual(requests, [
    { artworkRole: 'cover_front', ownerId: 'rg-1', ownerType: 'musicbrainz_release_group' },
  ]);
});

test('buildArtistDetailRelatedArtworkRequests deduplicates artist ids and skips cached artwork', () => {
  const requests = buildArtistDetailRelatedArtworkRequests([
    { id: 'artist-1' },
    { id: 'artist-2' },
    { id: 'artist-1' },
  ], {
    'musicbrainz_artist:artist-2:artist_thumbnail': { url: '/art/artist-2.webp' },
  });

  assert.deepEqual(requests, [
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-1', ownerType: 'musicbrainz_artist' },
  ]);
});

test('useArtistDetailArtwork loads hero artwork and batches discography plus related artwork', async (t) => {
  const artistMbid = ref('artist-1');
  const discographySections = ref([
    { releases: [{ musicbrainzReleaseGroupId: 'rg-1' }] },
  ]);
  const relatedArtists = ref([{ id: 'related-1', name: 'Autechre', score: 0.91 }]);

  const resolveArtworkFn = t.mock.fn(async ({ artworkRole }) => ({
    url: artworkRole === 'artist_background' ? '/art/hero-bg.webp' : '/art/hero-thumb.webp',
  }));
  const batchResolveArtworkFn = t.mock.fn(async (requests) => ({
    resolved: Object.fromEntries(
      requests.map((request) => [
        `${request.ownerType}:${request.ownerId}:${request.artworkRole}`,
        { url: `/art/${request.ownerId}.webp` },
      ]),
    ),
  }));

  const artwork = useArtistDetailArtwork({
    artistMbid,
    discographySections,
    relatedArtists,
    batchResolveArtworkFn,
    resolveArtworkFn,
  });

  await settleArtwork();

  assert.equal(resolveArtworkFn.mock.callCount(), 2);
  assert.equal(artwork.heroBackgroundUrl.value, '/art/hero-bg.webp');
  assert.equal(artwork.heroThumbnailUrl.value, '/art/hero-thumb.webp');
  assert.equal(batchResolveArtworkFn.mock.callCount(), 2);
  assert.equal(artwork.getReleaseArtwork('rg-1')?.url, '/art/rg-1.webp');
  assert.equal(artwork.getRelatedArtwork('related-1')?.url, '/art/related-1.webp');
});

test('useArtistDetailArtwork refresh forwards refresh=true to hero artwork resolution', async (t) => {
  const resolveArtworkFn = t.mock.fn(async () => ({ url: '/art/value.webp' }));

  const artwork = useArtistDetailArtwork({
    artistMbid: ref('artist-1'),
    discographySections: ref([]),
    relatedArtists: ref([]),
    resolveArtworkFn,
    batchResolveArtworkFn: async () => ({ resolved: {} }),
  });

  await settleArtwork();
  await artwork.loadArtistArtwork(true);

  const lastCall = resolveArtworkFn.mock.calls.at(-1)?.arguments[0];
  assert.equal(lastCall.refresh, true);
});

async function settleArtwork() {
  for (let index = 0; index < 15; index += 1) await Promise.resolve();
  await nextTick();
}

test('artist hero keeps successful roles and previous artwork when a refresh role fails', async () => {
  let failBackground = false;
  const scope = effectScope();
  const artwork = scope.run(() => useArtistDetailArtwork({
    artistMbid: ref('artist'), discographySections: ref([]), relatedArtists: ref([]),
    batchResolveArtworkFn: async () => ({ resolved: {} }),
    resolveArtworkFn: ({ artworkRole }) => {
      if (failBackground && artworkRole === 'artist_background') throw new Error('unavailable');
      return Promise.resolve({ url: `/art/${artworkRole}${failBackground ? '-new' : ''}` });
    },
  }));
  await settleArtwork();
  failBackground = true;
  await artwork.loadArtistArtwork(true);
  assert.equal(artwork.heroBackgroundUrl.value, '/art/artist_background');
  assert.equal(artwork.heroThumbnailUrl.value, '/art/artist_thumbnail-new');
  scope.stop();
});

test('artist artwork invalidates pending work when identity disappears or scope stops', async () => {
  const artistMbid = ref('artist');
  const pending = [];
  const scope = effectScope();
  const artwork = scope.run(() => useArtistDetailArtwork({
    artistMbid, discographySections: ref([{ releases: [{ musicbrainzReleaseGroupId: 'rg' }] }]),
    relatedArtists: ref([]),
    batchResolveArtworkFn: () => new Promise((resolve) => { pending.push(resolve); }),
    resolveArtworkFn: () => new Promise((resolve) => { pending.push(resolve); }),
  }));
  await settleArtwork();
  artistMbid.value = null;
  await nextTick();
  scope.stop();
  for (const resolve of pending) resolve({ url: '/late', resolved: { 'musicbrainz_release_group:rg:cover_front': { url: '/late' } } });
  await settleArtwork();
  assert.equal(artwork.heroBackgroundUrl.value, null);
  assert.equal(artwork.heroThumbnailUrl.value, null);
  assert.equal(artwork.getReleaseArtwork('rg'), null);
  assert.equal(artwork.isRefreshingArtwork.value, false);
});

test('artist discography uses bounded batches and retains a successful sibling batch', async () => {
  const scope = effectScope();
  const sizes = [];
  const artwork = scope.run(() => useArtistDetailArtwork({
    artistMbid: ref('artist'), relatedArtists: ref([]),
    discographySections: ref([{ releases: Array.from({ length: 101 }, (_, index) => ({ musicbrainzReleaseGroupId: `rg-${index}` })) }]),
    resolveArtworkFn: async () => null,
    batchResolveArtworkFn: async (requests) => {
      sizes.push(requests.length);
      if (requests[0].ownerId === 'rg-0') throw new Error('one batch failed');
      return { resolved: Object.fromEntries(requests.map(({ ownerId }) => [`musicbrainz_release_group:${ownerId}:cover_front`, { url: `/art/${ownerId}` }])) };
    },
  }));
  await settleArtwork();
  assert.deepEqual(sizes, [50, 50, 1]);
  assert.equal(artwork.getReleaseArtwork('rg-0'), null);
  assert.equal(artwork.getReleaseArtwork('rg-50').url, '/art/rg-50');
  assert.equal(artwork.getReleaseArtwork('rg-100').url, '/art/rg-100');
  scope.stop();
});

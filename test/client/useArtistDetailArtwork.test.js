import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, ref } from 'vue';
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

  await nextTick();
  await Promise.resolve();

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

  await nextTick();
  await Promise.resolve();
  await artwork.loadArtistArtwork(true);

  const lastCall = resolveArtworkFn.mock.calls.at(-1)?.arguments[0];
  assert.equal(lastCall.refresh, true);
});

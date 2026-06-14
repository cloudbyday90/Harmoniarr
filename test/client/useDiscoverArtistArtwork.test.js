import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, ref } from 'vue';
import {
  buildDiscoverArtistArtworkRequests,
  useDiscoverArtistArtwork,
} from '../../src/client/composables/useDiscoverArtistArtwork.js';

test('buildDiscoverArtistArtworkRequests deduplicates ids and skips already resolved artwork', () => {
  const getResolvedArtwork = (ownerType, ownerId, artworkRole) => {
    if (ownerType === 'musicbrainz_artist' && ownerId === 'artist-2' && artworkRole === 'artist_thumbnail') {
      return { url: '/art/artist-2.webp' };
    }
    return null;
  };

  const requests = buildDiscoverArtistArtworkRequests(
    ['artist-1', 'artist-2', 'artist-1', null, 'artist-3'],
    getResolvedArtwork,
  );

  assert.deepEqual(requests, [
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-1', ownerType: 'musicbrainz_artist' },
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-3', ownerType: 'musicbrainz_artist' },
  ]);
});

test('useDiscoverArtistArtwork batches artwork across discover sources', async (t) => {
  const resolvedMap = {};
  const resolve = t.mock.fn(async (requests) => {
    for (const request of requests) {
      resolvedMap[`${request.ownerType}:${request.ownerId}:${request.artworkRole}`] = {
        assetId: `asset-${request.ownerId}`,
        url: `/art/${request.ownerId}.webp`,
      };
    }
  });
  const getResolved = (ownerType, ownerId, artworkRole) =>
    resolvedMap[`${ownerType}:${ownerId}:${artworkRole}`] ?? null;

  const recommendationInputs = ref([{ id: 'artist-1', name: 'Boards of Canada' }]);
  const suggestions = ref([
    { id: 'artist-2', name: 'Autechre' },
    { id: 'artist-1', name: 'Boards of Canada' },
  ]);
  const results = ref([{ id: 'artist-3', name: 'Tycho' }]);

  const workflow = useDiscoverArtistArtwork({
    artistSources: [recommendationInputs, suggestions, results],
    createArtworkBatchResolve: () => ({
      getResolved,
      isResolving: ref(false),
      resolve,
    }),
  });

  await nextTick();

  assert.equal(resolve.mock.callCount(), 1);
  assert.deepEqual(resolve.mock.calls[0].arguments[0], [
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-1', ownerType: 'musicbrainz_artist' },
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-2', ownerType: 'musicbrainz_artist' },
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-3', ownerType: 'musicbrainz_artist' },
  ]);
  assert.equal(workflow.getArtistArtwork('artist-2')?.url, '/art/artist-2.webp');
});

test('useDiscoverArtistArtwork only requests newly introduced unresolved artists', async (t) => {
  const resolvedMap = {
    'musicbrainz_artist:artist-1:artist_thumbnail': { url: '/art/artist-1.webp' },
  };
  const resolve = t.mock.fn(async (requests) => {
    for (const request of requests) {
      resolvedMap[`${request.ownerType}:${request.ownerId}:${request.artworkRole}`] = {
        url: `/art/${request.ownerId}.webp`,
      };
    }
  });
  const getResolved = (ownerType, ownerId, artworkRole) =>
    resolvedMap[`${ownerType}:${ownerId}:${artworkRole}`] ?? null;

  const results = ref([{ id: 'artist-1', name: 'Boards of Canada' }]);
  useDiscoverArtistArtwork({
    artistSources: [results],
    createArtworkBatchResolve: () => ({
      getResolved,
      isResolving: ref(false),
      resolve,
    }),
  });

  await nextTick();
  assert.equal(resolve.mock.callCount(), 0);

  results.value = [
    { id: 'artist-1', name: 'Boards of Canada' },
    { id: 'artist-4', name: 'Four Tet' },
  ];

  await nextTick();
  assert.equal(resolve.mock.callCount(), 1);
  assert.deepEqual(resolve.mock.calls[0].arguments[0], [
    { artworkRole: 'artist_thumbnail', ownerId: 'artist-4', ownerType: 'musicbrainz_artist' },
  ]);
});

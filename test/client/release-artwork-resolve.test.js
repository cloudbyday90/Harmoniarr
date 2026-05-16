import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseArtworkRequests,
  getPreferredReleaseArtwork,
} from '../../src/client/lib/release-artwork-resolve.js';

test('buildReleaseArtworkRequests includes release and release-group cover requests', () => {
  const requests = buildReleaseArtworkRequests([
    {
      id: 'release-1',
      releaseGroup: {
        id: 'rg-1',
      },
    },
    {
      musicbrainzReleaseId: 'release-2',
      releaseGroupId: 'rg-2',
    },
  ]);

  assert.deepEqual(requests, [
    { artworkRole: 'cover_front', ownerId: 'release-1', ownerType: 'musicbrainz_release' },
    { artworkRole: 'cover_front', ownerId: 'rg-1', ownerType: 'musicbrainz_release_group' },
    { artworkRole: 'cover_front', ownerId: 'release-2', ownerType: 'musicbrainz_release' },
    { artworkRole: 'cover_front', ownerId: 'rg-2', ownerType: 'musicbrainz_release_group' },
  ]);
});

test('buildReleaseArtworkRequests de-duplicates identical requests', () => {
  const requests = buildReleaseArtworkRequests([
    {
      id: 'release-1',
      releaseGroup: {
        id: 'rg-1',
      },
    },
    {
      id: 'release-1',
      releaseGroup: {
        id: 'rg-1',
      },
    },
  ]);

  assert.deepEqual(requests, [
    { artworkRole: 'cover_front', ownerId: 'release-1', ownerType: 'musicbrainz_release' },
    { artworkRole: 'cover_front', ownerId: 'rg-1', ownerType: 'musicbrainz_release_group' },
  ]);
});

test('getPreferredReleaseArtwork prefers release artwork and falls back to release-group artwork', () => {
  const artworkMap = new Map([
    ['musicbrainz_release:release-1:cover_front', { assetId: 'release-asset', url: '/release.jpg' }],
    ['musicbrainz_release_group:rg-1:cover_front', { assetId: 'group-asset', url: '/group.jpg' }],
    ['musicbrainz_release_group:rg-2:cover_front', { assetId: 'group-fallback', url: '/group-fallback.jpg' }],
  ]);

  function getResolvedArtwork(ownerType, ownerId, artworkRole) {
    if (!ownerId) {
      return null;
    }

    return artworkMap.get(`${ownerType}:${ownerId}:${artworkRole}`) ?? null;
  }

  assert.deepEqual(
    getPreferredReleaseArtwork(getResolvedArtwork, {
      id: 'release-1',
      releaseGroup: { id: 'rg-1' },
    }),
    { assetId: 'release-asset', url: '/release.jpg' },
  );

  assert.deepEqual(
    getPreferredReleaseArtwork(getResolvedArtwork, {
      id: 'release-missing',
      releaseGroupId: 'rg-2',
    }),
    { assetId: 'group-fallback', url: '/group-fallback.jpg' },
  );

  assert.equal(
    getPreferredReleaseArtwork(getResolvedArtwork, {
      id: 'missing-release',
      releaseGroupId: 'missing-group',
    }),
    null,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMetadataArtistLocation,
  buildMetadataReleaseLocation,
  buildMetadataRouteHydrationPlan,
  buildMetadataRouteQuery,
  buildMetadataReleaseGroupLocation,
  getMetadataRouteStateKey,
  normalizeMetadataRouteState,
  resolveMetadataRouteReleaseGroupId,
} from '../../src/client/lib/metadata-route-state.js';

test('normalizeMetadataRouteState trims route query values', () => {
  assert.deepEqual(normalizeMetadataRouteState({
    artistId: ' artist-1 ',
    releaseGroupId: ' release-group-1 ',
    releaseId: ' release-1 ',
  }), {
    artistId: 'artist-1',
    releaseGroupId: 'release-group-1',
    releaseId: 'release-1',
  });
});

test('buildMetadataRouteQuery emits only non-empty fields', () => {
  assert.deepEqual(buildMetadataRouteQuery({
    artistId: 'artist-1',
    releaseGroupId: 'release-group-1',
    releaseId: 'release-1',
  }), {
    artistId: 'artist-1',
    releaseGroupId: 'release-group-1',
    releaseId: 'release-1',
  });

  assert.deepEqual(buildMetadataRouteQuery({
    artistId: ' ',
    releaseGroupId: '',
    releaseId: '',
  }), {});
});

test('getMetadataRouteStateKey matches equivalent metadata route states after normalization', () => {
  assert.equal(
    getMetadataRouteStateKey({
      artistId: ' artist-1 ',
      releaseGroupId: ' release-group-1 ',
      releaseId: ' release-1 ',
    }),
    getMetadataRouteStateKey({
      artistId: 'artist-1',
      releaseGroupId: 'release-group-1',
      releaseId: 'release-1',
    }),
  );
});

test('metadata route helpers build drill-through locations', () => {
  assert.deepEqual(buildMetadataArtistLocation('artist-1'), {
    name: 'metadata',
    query: {
      artistId: 'artist-1',
    },
  });

  assert.deepEqual(buildMetadataReleaseGroupLocation({
    artistId: 'artist-1',
    releaseGroupId: 'release-group-1',
  }), {
    name: 'metadata',
    query: {
      artistId: 'artist-1',
      releaseGroupId: 'release-group-1',
    },
  });

  assert.deepEqual(buildMetadataReleaseLocation({
    artistId: ' artist-1 ',
    releaseGroupId: ' release-group-1 ',
    releaseId: ' release-1 ',
  }), {
    name: 'metadata',
    query: {
      artistId: 'artist-1',
      releaseGroupId: 'release-group-1',
      releaseId: 'release-1',
    },
  });
});

test('resolveMetadataRouteReleaseGroupId maps provider release groups onto local canonical ids', () => {
  assert.equal(resolveMetadataRouteReleaseGroupId({
    localReleaseGroups: [
      {
        id: 'local-rg-1',
        source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
      },
    ],
    releaseGroup: { id: 'mb-rg-1' },
  }), 'local-rg-1');

  assert.equal(resolveMetadataRouteReleaseGroupId({
    localReleaseGroups: [
      {
        id: 'local-rg-1',
        source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
      },
    ],
    releaseGroup: { id: 'local-rg-1' },
  }), 'local-rg-1');
});

test('buildMetadataRouteHydrationPlan only requests the ids that changed', () => {
  assert.deepEqual(buildMetadataRouteHydrationPlan({
    currentArtistId: 'artist-1',
    currentReleaseGroupId: 'release-group-1',
    currentReleaseId: '',
    nextState: {
      artistId: 'artist-1',
      releaseGroupId: 'release-group-2',
      releaseId: '',
    },
  }), {
    artistId: '',
    release: null,
    releaseGroupId: 'release-group-2',
  });

  assert.deepEqual(buildMetadataRouteHydrationPlan({
    currentArtistId: '',
    currentReleaseGroupId: '',
    currentReleaseId: '',
    nextState: {
      artistId: 'artist-1',
      releaseGroupId: 'release-group-1',
      releaseId: 'release-1',
    },
  }), {
    artistId: 'artist-1',
    release: {
      releaseGroupId: 'release-group-1',
      releaseId: 'release-1',
    },
    releaseGroupId: '',
  });
});
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArtistReleaseGroupCacheKey,
  createMusicBrainzCatalogService,
} from '../../src/server/metadata/musicbrainz-catalog-service.js';

function createProviderError() {
  const error = new Error('MusicBrainz request failed');
  error.code = 'musicbrainz_request_failed';
  error.details = {
    attempts: 1,
    maxRetries: 1,
    retryable: false,
    status: 400,
    throttled: false,
    url: 'https://musicbrainz.test/ws/2/release-group?fmt=json',
  };
  return error;
}

test('createMusicBrainzCatalogService normalizes artist release-group browse requests and results', async (t) => {
  const browseArtistReleaseGroups = t.mock.fn(async ({
    artistId,
    limit,
    offset,
    type,
    releaseGroupStatus,
  }) => {
    assert.equal(artistId, 'mb-artist-1');
    assert.equal(limit, 5);
    assert.equal(offset, 10);
    assert.equal(type, 'album|ep');
    assert.equal(releaseGroupStatus, 'all');

    return {
      'release-group-count': 1,
      offset: 10,
      'release-groups': [{
        id: 'mb-rg-1',
        title: 'Amber',
        'primary-type': 'Album',
        'secondary-types': ['Live'],
        'first-release-date': '1994-11-07',
        disambiguation: 'original release group',
        'artist-credit': [{
          name: 'Autechre',
          artist: { id: 'mb-artist-1', name: 'Autechre' },
        }],
      }],
    };
  });
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createMusicBrainzCatalogService({
    musicBrainzClient: {
      browseArtistReleaseGroups,
      browseReleaseGroupReleases: async () => ({ releases: [] }),
    },
    providerHealthRecorder,
  });

  const result = await service.browseArtistReleaseGroups({
    artistId: 'mb-artist-1',
    limit: '5',
    offset: '10',
    type: 'Album|EP',
    releaseGroupStatus: 'all',
  });

  assert.equal(browseArtistReleaseGroups.mock.callCount(), 1);
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordSuccess.mock.calls[0].arguments, ['musicbrainz']);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 0);
  assert.deepEqual(result, {
    artistId: 'mb-artist-1',
    limit: 5,
    offset: 10,
    total: 1,
    filters: {
      type: 'album|ep',
      releaseGroupStatus: 'all',
    },
    results: [{
      id: 'mb-rg-1',
      sourceProvider: 'musicbrainz',
      musicbrainzReleaseGroupId: 'mb-rg-1',
      title: 'Amber',
      primaryType: 'Album',
      secondaryTypes: ['Live'],
      firstReleaseDate: '1994-11-07',
      disambiguation: 'original release group',
      artistCredit: 'Autechre',
    }],
  });
});

test('createMusicBrainzCatalogService normalizes release-group release browse results', async (t) => {
  const browseReleaseGroupReleases = t.mock.fn(async ({ releaseGroupId, limit, offset }) => {
    assert.equal(releaseGroupId, 'mb-rg-1');
    assert.equal(limit, 4);
    assert.equal(offset, 2);

    return {
      'release-count': 1,
      offset: 2,
      releases: [{
        id: 'mb-release-1',
        title: 'Amber',
        status: 'Official',
        date: '1994-11-07',
        country: 'GB',
        barcode: '5021603030224',
        disambiguation: null,
        'artist-credit': [{
          name: 'Autechre',
          artist: { id: 'mb-artist-1', name: 'Autechre' },
        }],
        media: [
          { position: 1, 'track-count': 7 },
          { position: 2, 'track-count': 4 },
        ],
      }],
    };
  });
  const service = createMusicBrainzCatalogService({
    musicBrainzClient: {
      browseArtistReleaseGroups: async () => ({ 'release-groups': [] }),
      browseReleaseGroupReleases,
    },
  });

  const result = await service.getReleaseGroupReleases({
    releaseGroupId: 'mb-rg-1',
    limit: '4',
    offset: '2',
  });

  assert.equal(browseReleaseGroupReleases.mock.callCount(), 1);
  assert.deepEqual(result, {
    releaseGroupId: 'mb-rg-1',
    limit: 4,
    offset: 2,
    total: 1,
    results: [{
      id: 'mb-release-1',
      sourceProvider: 'musicbrainz',
      musicbrainzReleaseId: 'mb-release-1',
      title: 'Amber',
      status: 'Official',
      releaseDate: '1994-11-07',
      country: 'GB',
      barcode: '5021603030224',
      disambiguation: null,
      artistCredit: 'Autechre',
      mediumCount: 2,
      trackCount: 11,
    }],
  });
});

test('createMusicBrainzCatalogService validates browse filters before calling the provider client', async (t) => {
  const browseArtistReleaseGroups = t.mock.fn(async () => ({ 'release-groups': [] }));
  const service = createMusicBrainzCatalogService({
    musicBrainzClient: {
      browseArtistReleaseGroups,
      browseReleaseGroupReleases: async () => ({ releases: [] }),
    },
  });

  await assert.rejects(
    () => service.browseArtistReleaseGroups({
      artistId: 'mb-artist-1',
      type: 'unsupported-type',
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'Unsupported release-group type: unsupported-type');
      return true;
    },
  );
  assert.equal(browseArtistReleaseGroups.mock.callCount(), 0);
});

test('createMusicBrainzCatalogService preserves provider failure details', async (t) => {
  const providerError = createProviderError();
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const browseReleaseGroupReleases = t.mock.fn(async () => {
    throw providerError;
  });
  const service = createMusicBrainzCatalogService({
    musicBrainzClient: {
      browseArtistReleaseGroups: async () => ({ 'release-groups': [] }),
      browseReleaseGroupReleases,
    },
    providerHealthRecorder,
  });

  await assert.rejects(
    () => service.getReleaseGroupReleases({ releaseGroupId: 'mb-rg-1' }),
    (error) => {
      assert.equal(error, providerError);
      assert.equal(error.code, 'musicbrainz_request_failed');
      assert.equal(error.details.status, 400);
      assert.equal(error.details.retryable, false);
      return true;
    },
  );
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 0);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordError.mock.calls[0].arguments, ['musicbrainz', providerError]);
});

test('createMusicBrainzCatalogService reads artist discography through the persistent cache service', async (t) => {
  const browseArtistReleaseGroups = t.mock.fn(async () => ({
    count: 1,
    'release-groups': [{
      id: 'mb-rg-1',
      title: 'Amber',
    }],
  }));
  const getOrLoad = t.mock.fn(async (input) => ({
    cache: { refresh: 'foreground', state: 'fresh' },
    payload: await input.load(),
  }));
  const service = createMusicBrainzCatalogService({
    metadataProviderCacheService: { getOrLoad },
    musicBrainzClient: {
      browseArtistReleaseGroups,
      browseReleaseGroupReleases: async () => ({ releases: [] }),
    },
  });

  const result = await service.browseArtistReleaseGroups({ artistId: 'mb-artist-1', limit: 25 });

  assert.equal(browseArtistReleaseGroups.mock.callCount(), 1);
  assert.equal(getOrLoad.mock.callCount(), 1);
  const cacheInput = getOrLoad.mock.calls[0].arguments[0];
  assert.equal(cacheInput.cacheNamespace, 'musicbrainz.artist_release_groups');
  assert.equal(cacheInput.cacheKey, buildArtistReleaseGroupCacheKey({
    artistId: 'mb-artist-1',
    limit: 25,
    offset: 0,
    releaseGroupStatus: 'website-default',
    type: null,
  }));
  assert.deepEqual(result.cache, { refresh: 'foreground', state: 'fresh' });
  assert.equal(result.results[0].musicbrainzReleaseGroupId, 'mb-rg-1');
});

test('buildArtistReleaseGroupCacheKey varies for every provider browse input', () => {
  const base = buildArtistReleaseGroupCacheKey({
    artistId: 'mb-artist-1',
    limit: 25,
    offset: 0,
    releaseGroupStatus: 'website-default',
    type: null,
  });
  const changedOffset = buildArtistReleaseGroupCacheKey({
    artistId: 'mb-artist-1',
    limit: 25,
    offset: 25,
    releaseGroupStatus: 'website-default',
    type: null,
  });
  const changedFilter = buildArtistReleaseGroupCacheKey({
    artistId: 'mb-artist-1',
    limit: 25,
    offset: 0,
    releaseGroupStatus: 'all',
    type: 'album',
  });

  assert.notEqual(base, changedOffset);
  assert.notEqual(base, changedFilter);
});

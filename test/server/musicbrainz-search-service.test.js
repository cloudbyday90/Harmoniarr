import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicBrainzSearchService } from '../../src/server/metadata/musicbrainz-search-service.js';

function createProviderError() {
  const error = new Error('MusicBrainz is throttled');
  error.code = 'musicbrainz_unavailable';
  error.details = {
    attempts: 2,
    maxRetries: 1,
    retryAfterMs: 3000,
    retryable: true,
    status: 503,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
  };
  return error;
}

test('createMusicBrainzSearchService normalizes artist search requests and results', async (t) => {
  const searchArtists = t.mock.fn(async ({ query, limit, dismax }) => {
    assert.equal(query, 'Autechre');
    assert.equal(limit, 3);
    assert.equal(dismax, true);

    return {
      count: 1,
      offset: 0,
      artists: [{
        id: 'mb-artist-1',
        name: 'Autechre',
        'sort-name': 'Autechre',
        disambiguation: 'English electronic duo',
        country: 'GB',
        type: 'Group',
        score: '98',
        area: {
          id: 'area-1',
          name: 'United Kingdom',
          'sort-name': 'United Kingdom',
        },
        'life-span': {
          begin: '1987',
          ended: false,
        },
      }],
    };
  });
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createMusicBrainzSearchService({
    musicBrainzClient: {
      searchArtists,
      searchReleases: async () => ({ releases: [] }),
    },
    providerHealthRecorder,
  });

  const result = await service.searchArtists({ query: '  Autechre  ', limit: '3' });

  assert.equal(searchArtists.mock.callCount(), 1);
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordSuccess.mock.calls[0].arguments, ['musicbrainz']);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 0);
  assert.deepEqual(result, {
    query: 'Autechre',
    limit: 3,
    total: 1,
    offset: 0,
    results: [{
      id: 'mb-artist-1',
      sourceProvider: 'musicbrainz',
      musicbrainzArtistId: 'mb-artist-1',
      name: 'Autechre',
      sortName: 'Autechre',
      disambiguation: 'English electronic duo',
      country: 'GB',
      type: 'Group',
      score: 98,
      area: {
        id: 'area-1',
        name: 'United Kingdom',
        sortName: 'United Kingdom',
      },
      lifeSpan: {
        begin: '1987',
        end: null,
        ended: false,
      },
    }],
  });
});

test('createMusicBrainzSearchService builds release queries through the shared client', async (t) => {
  const searchReleases = t.mock.fn(async ({ query, limit }) => {
    assert.equal(query, 'artist:"Boards of Canada" AND release:"Music Has the Right to Children"');
    assert.equal(limit, 2);

    return {
      count: 1,
      offset: 0,
      releases: [{
        id: 'mb-release-1',
        title: 'Music Has the Right to Children',
        status: 'Official',
        date: '1998-04-20',
        country: 'GB',
        barcode: '5021603064724',
        packaging: 'Jewel Case',
        score: '100',
        'artist-credit': [{
          name: 'Boards of Canada',
          artist: {
            id: 'mb-artist-1',
            name: 'Boards of Canada',
            'sort-name': 'Boards of Canada',
          },
        }],
        'release-group': {
          id: 'mb-rg-1',
          'primary-type': 'Album',
          'secondary-types': [],
        },
        'track-count': 17,
        media: [{ position: 1 }],
      }],
    };
  });
  const service = createMusicBrainzSearchService({
    musicBrainzClient: {
      searchArtists: async () => ({ artists: [] }),
      searchReleases,
    },
  });

  const result = await service.searchReleases({
    artist: 'Boards of Canada',
    release: 'Music Has the Right to Children',
    limit: '2',
  });

  assert.equal(searchReleases.mock.callCount(), 1);
  assert.equal(result.query.artist, 'Boards of Canada');
  assert.equal(result.query.release, 'Music Has the Right to Children');
  assert.equal(result.limit, 2);
  assert.equal(result.results[0].artistCredit, 'Boards of Canada');
  assert.equal(result.results[0].releaseGroup.id, 'mb-rg-1');
  assert.equal(result.results[0].trackCount, 17);
  assert.equal(result.results[0].mediaCount, 1);
});

test('createMusicBrainzSearchService validates before calling the provider client', async (t) => {
  const searchArtists = t.mock.fn(async () => ({ artists: [] }));
  const service = createMusicBrainzSearchService({
    musicBrainzClient: {
      searchArtists,
      searchReleases: async () => ({ releases: [] }),
    },
  });

  await assert.rejects(
    () => service.searchArtists({ query: '   ' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'query is required');
      return true;
    },
  );
  assert.equal(searchArtists.mock.callCount(), 0);
});

test('createMusicBrainzSearchService exposes a lightweight provider health probe', async (t) => {
  const searchArtists = t.mock.fn(async ({ query, limit, dismax }) => {
    assert.equal(query, 'a');
    assert.equal(limit, 1);
    assert.equal(dismax, true);
    return { count: 0, offset: 0, artists: [] };
  });
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createMusicBrainzSearchService({
    musicBrainzClient: {
      searchArtists,
      searchReleases: async () => ({ releases: [] }),
    },
    providerHealthRecorder,
  });

  const status = await service.checkProviderHealth();

  assert.equal(searchArtists.mock.callCount(), 1);
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 1);
  assert.deepEqual(status, {
    provider: 'musicbrainz',
    status: 'healthy',
    message: 'MusicBrainz lookups are reachable.',
  });
});

test('createMusicBrainzSearchService preserves provider failure details', async (t) => {
  const providerError = createProviderError();
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const searchArtists = t.mock.fn(async () => {
    throw providerError;
  });
  const service = createMusicBrainzSearchService({
    musicBrainzClient: {
      searchArtists,
      searchReleases: async () => ({ releases: [] }),
    },
    providerHealthRecorder,
  });

  await assert.rejects(
    () => service.searchArtists({ query: 'Autechre' }),
    (error) => {
      assert.equal(error, providerError);
      assert.equal(error.code, 'musicbrainz_unavailable');
      assert.equal(error.details.throttled, true);
      assert.equal(error.details.retryAfterMs, 3000);
      return true;
    },
  );
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 0);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordError.mock.calls[0].arguments, ['musicbrainz', providerError]);
});

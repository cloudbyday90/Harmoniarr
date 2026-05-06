import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataSearchService } from '../../src/server/metadata/metadata-search-service.js';

test('createMetadataSearchService normalizes and maps artist search results', async (t) => {
  const searchArtistsQuery = t.mock.fn(async ({ query, limit }, pool) => {
    assert.equal(query, 'The Cure');
    assert.equal(limit, 7);
    assert.equal(pool, 'pool-token');

    return [{
      id: 'artist-1',
      name: 'The Cure',
      sort_name: 'Cure, The',
      disambiguation: 'UK band',
      country: 'GB',
      artist_type: 'Group',
      source_provider: 'musicbrainz',
      source_artist_id: 'artist-source-1',
      musicbrainz_artist_id: 'mb-artist-1',
      fetched_at: '2026-04-28T00:00:00.000Z',
      updated_at: '2026-04-28T00:00:00.000Z',
    }];
  });

  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery,
    searchReleaseGroupsQuery: async () => [],
    searchReleasesQuery: async () => [],
  });

  const result = await service.searchArtists({ query: '  The Cure  ', limit: '7' });

  assert.equal(searchArtistsQuery.mock.callCount(), 1);
  assert.deepEqual(result, {
    query: 'The Cure',
    limit: 7,
    results: [{
      id: 'artist-1',
      name: 'The Cure',
      sortName: 'Cure, The',
      disambiguation: 'UK band',
      country: 'GB',
      artistType: 'Group',
      source: {
        provider: 'musicbrainz',
        sourceArtistId: 'artist-source-1',
        musicbrainzArtistId: 'mb-artist-1',
      },
      fetchedAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:00:00.000Z',
    }],
  });
});

test('createMetadataSearchService maps release-group and release search results', async () => {
  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery: async () => [],
    searchReleaseGroupsQuery: async () => [{
      id: 'rg-1',
      metadata_artist_id: 'artist-1',
      artist_name: 'The Cure',
      title: 'Disintegration',
      primary_type: 'Album',
      secondary_types: ['Live'],
      first_release_date: '1989-05-02',
      disambiguation: null,
      release_count: 3,
      source_provider: 'musicbrainz',
      source_release_group_id: 'rg-source-1',
      musicbrainz_release_group_id: 'mb-rg-1',
      fetched_at: '2026-04-28T00:00:00.000Z',
      updated_at: '2026-04-28T00:00:00.000Z',
    }],
    searchReleasesQuery: async () => [{
      id: 'release-1',
      metadata_release_group_id: 'rg-1',
      metadata_artist_id: 'artist-1',
      artist_name: 'The Cure',
      release_group_title: 'Disintegration',
      title: 'Disintegration (Deluxe Edition)',
      status: 'Official',
      release_date: '2010-01-01',
      country: 'GB',
      barcode: '123',
      disambiguation: 'Remaster',
      track_count: 24,
      medium_count: 2,
      source_provider: 'musicbrainz',
      source_release_id: 'release-source-1',
      musicbrainz_release_id: 'mb-release-1',
      fetched_at: '2026-04-28T00:00:00.000Z',
      updated_at: '2026-04-28T00:00:00.000Z',
    }],
  });

  const releaseGroupResult = await service.searchReleaseGroups({ query: 'dis', limit: 5 });
  const releaseResult = await service.searchReleases({ query: 'deluxe', limit: 4 });

  assert.equal(releaseGroupResult.query, 'dis');
  assert.equal(releaseGroupResult.limit, 5);
  assert.equal(releaseGroupResult.results[0].artistName, 'The Cure');
  assert.equal(releaseGroupResult.results[0].source.musicbrainzReleaseGroupId, 'mb-rg-1');

  assert.equal(releaseResult.query, 'deluxe');
  assert.equal(releaseResult.limit, 4);
  assert.equal(releaseResult.results[0].artistName, 'The Cure');
  assert.equal(releaseResult.results[0].releaseGroupTitle, 'Disintegration');
  assert.equal(releaseResult.results[0].source.musicbrainzReleaseId, 'mb-release-1');
});

test('createMetadataSearchService rejects invalid empty search queries', async () => {
  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery: async () => [],
    searchReleaseGroupsQuery: async () => [],
    searchReleasesQuery: async () => [],
  });

  await assert.rejects(
    () => service.searchArtists({ query: '   ' }),
    (error) => error?.code === 'validation_error' && error?.status === 400,
  );
});

test('createMetadataSearchService listMonitoredArtists normalizes and maps monitored artist rows', async (t) => {
  const listMonitoredArtistsQuery = t.mock.fn(async ({ limit }, pool) => {
    assert.equal(limit, 5);
    assert.equal(pool, 'pool-token');

    return [{
      id: 42,
      name: 'Autechre',
      sort_name: 'Autechre',
      disambiguation: null,
      country: 'GB',
      artist_type: 'Group',
      musicbrainz_artist_id: 'mb-artist-1',
    }];
  });

  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery: async () => [],
    listMonitoredArtistsQuery,
    searchReleaseGroupsQuery: async () => [],
    searchReleasesQuery: async () => [],
  });

  const result = await service.listMonitoredArtists({ limit: '5' });

  assert.equal(listMonitoredArtistsQuery.mock.callCount(), 1);
  assert.deepEqual(result, {
    limit: 5,
    results: [{
      id: 'mb-artist-1',
      localId: 42,
      name: 'Autechre',
      sortName: 'Autechre',
      disambiguation: null,
      country: 'GB',
      type: 'Group',
      monitored: true,
    }],
  });
});

test('createMetadataSearchService listMonitoredArtists defaults limit to 25', async (t) => {
  const listMonitoredArtistsQuery = t.mock.fn(async ({ limit }) => {
    assert.equal(limit, 25);
    return [];
  });

  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery: async () => [],
    listMonitoredArtistsQuery,
    searchReleaseGroupsQuery: async () => [],
    searchReleasesQuery: async () => [],
  });

  const result = await service.listMonitoredArtists({});

  assert.equal(result.limit, 25);
  assert.deepEqual(result.results, []);
});

test('createMetadataSearchService listMonitoredArtists falls back to string local id as id when musicbrainz_artist_id is null', async (t) => {
  const listMonitoredArtistsQuery = t.mock.fn(async () => [
    {
      id: 7,
      name: 'Local Only Artist',
      sort_name: 'Local Only Artist',
      disambiguation: null,
      country: null,
      artist_type: null,
      musicbrainz_artist_id: null,
    },
  ]);

  const service = createMetadataSearchService({
    pool: 'pool-token',
    searchArtistsQuery: async () => [],
    listMonitoredArtistsQuery,
    searchReleaseGroupsQuery: async () => [],
    searchReleasesQuery: async () => [],
  });

  const result = await service.listMonitoredArtists({ limit: 10 });

  assert.equal(result.results[0].id, '7');
  assert.equal(result.results[0].localId, 7);
  assert.equal(result.results[0].monitored, true);
});
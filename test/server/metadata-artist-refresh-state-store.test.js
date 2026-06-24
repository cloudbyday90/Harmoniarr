import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataArtistRefreshStateStore } from '../../src/server/metadata/metadata-artist-refresh-state-store.js';

test('scheduleArtistRefresh upserts dedicated refresh state', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createMetadataArtistRefreshStateStore({ getPoolFn: () => ({ query }) });

  await store.scheduleArtistRefresh({
    metadataArtistId: 'artist-1',
    nextRefreshAt: '2026-06-15T12:00:00.000Z',
  });

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO metadata_artist_refresh_state/);
  assert.match(query.mock.calls[0].arguments[0], /ON CONFLICT \(metadata_artist_id\) DO UPDATE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'artist-1',
    '2026-06-15T12:00:00.000Z',
  ]);
});

test('getArtistRefreshMonitoring aggregates canonical operator monitoring policy', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      monitored_release_group_types: ['album', 'ep', 'single'],
      monitoring_operator_count: 2,
    }],
  }));
  const store = createMetadataArtistRefreshStateStore({ getPoolFn: () => ({ query }) });

  const result = await store.getArtistRefreshMonitoring('artist-1');

  assert.match(query.mock.calls[0].arguments[0], /FROM operator_artist_monitoring/);
  assert.match(query.mock.calls[0].arguments[0], /unnest\(operator_artist_monitoring\.monitored_release_group_types\)/);
  assert.doesNotMatch(query.mock.calls[0].arguments[0], /metadata_artist_monitoring/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['artist-1']);
  assert.deepEqual(result, {
    isMonitored: true,
    monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
  });
});

test('getArtistRefreshMonitoring returns unmonitored defaults when no operator monitors the artist', async () => {
  const store = createMetadataArtistRefreshStateStore({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          monitored_release_group_types: null,
          monitoring_operator_count: 0,
        }],
      }),
    }),
  });

  const result = await store.getArtistRefreshMonitoring('artist-1');

  assert.deepEqual(result, {
    isMonitored: false,
    monitoredReleaseGroupTypes: ['album', 'ep'],
  });
});

test('listArtistsDueForRefresh reads operator monitoring and refresh state without legacy monitoring', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      last_refreshed_at: new Date('2026-06-15T00:00:00.000Z'),
      metadata_artist_id: 'artist-1',
      musicbrainz_artist_id: 'mb-artist-1',
      name: 'Autechre',
      next_refresh_at: new Date('2026-06-15T12:00:00.000Z'),
    }],
  }));
  const store = createMetadataArtistRefreshStateStore({ getPoolFn: () => ({ query }) });

  const result = await store.listArtistsDueForRefresh({
    limit: 2,
    now: '2026-06-15T12:00:00.000Z',
  });

  assert.match(query.mock.calls[0].arguments[0], /WITH monitored_artist_scope AS/);
  assert.match(query.mock.calls[0].arguments[0], /FROM operator_artist_monitoring/);
  assert.match(query.mock.calls[0].arguments[0], /LEFT JOIN metadata_artist_refresh_state/);
  assert.match(query.mock.calls[0].arguments[0], /NOT EXISTS/);
  assert.doesNotMatch(query.mock.calls[0].arguments[0], /metadata_artist_monitoring/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    '2026-06-15T12:00:00.000Z',
    'metadata_artist_refresh',
    2,
  ]);
  assert.deepEqual(result, [{
    artistName: 'Autechre',
    lastRefreshedAt: '2026-06-15T00:00:00.000Z',
    metadataArtistId: 'artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    nextRefreshAt: '2026-06-15T12:00:00.000Z',
  }]);
});

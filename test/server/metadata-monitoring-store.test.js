import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataMonitoringStore } from '../../src/server/metadata/metadata-monitoring-store.js';

test('getArtistMonitoring returns stored monitoring state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      is_monitored: true,
      monitored_release_group_types: ['album', 'ep'],
    }],
  }));
  const store = createMetadataMonitoringStore({ getPoolFn: () => ({ query }) });

  const result = await store.getArtistMonitoring('artist-1');

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(result, {
    isMonitored: true,
    lastRefreshedAt: null,
    monitoredReleaseGroupTypes: ['album', 'ep'],
    nextRefreshAt: null,
  });
});

test('getArtistMonitoring returns conservative defaults when no row exists', async () => {
  const store = createMetadataMonitoringStore({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
  });

  const result = await store.getArtistMonitoring('artist-1');

  assert.deepEqual(result, {
    isMonitored: false,
    lastRefreshedAt: null,
    monitoredReleaseGroupTypes: ['album', 'ep'],
    nextRefreshAt: null,
  });
});

test('upsertArtistMonitoring stores the current monitoring policy', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createMetadataMonitoringStore({ getPoolFn: () => ({ query }) });

  await store.upsertArtistMonitoring({
    isMonitored: true,
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album'],
  });

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO metadata_artist_monitoring/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['artist-1', true, ['album']]);
});

test('listArtistsDueForRefresh returns monitored artists without active refresh runs', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      metadata_artist_id: 'artist-1',
      last_refreshed_at: new Date('2026-05-01T00:00:00.000Z'),
      next_refresh_at: new Date('2026-05-02T00:00:00.000Z'),
      name: 'Autechre',
      musicbrainz_artist_id: 'mb-artist-1',
    }],
  }));
  const store = createMetadataMonitoringStore({ getPoolFn: () => ({ query }) });

  const result = await store.listArtistsDueForRefresh({
    limit: 2,
    now: '2026-05-02T00:00:00.000Z',
  });

  assert.match(query.mock.calls[0].arguments[0], /NOT EXISTS/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    '2026-05-02T00:00:00.000Z',
    'metadata_artist_refresh',
    2,
  ]);
  assert.deepEqual(result, [{
    artistName: 'Autechre',
    lastRefreshedAt: '2026-05-01T00:00:00.000Z',
    metadataArtistId: 'artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    nextRefreshAt: '2026-05-02T00:00:00.000Z',
  }]);
});
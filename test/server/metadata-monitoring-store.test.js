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
    monitoredReleaseGroupTypes: ['album', 'ep'],
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
    monitoredReleaseGroupTypes: ['album', 'ep'],
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
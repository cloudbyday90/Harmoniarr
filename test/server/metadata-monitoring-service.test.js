import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataMonitoringService } from '../../src/server/metadata/metadata-monitoring-service.js';

test('updateArtistMonitoring validates and persists monitoring state for an existing artist', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [{ id: 'artist-1' }] }));
  const upsertArtistMonitoring = t.mock.fn(async () => {});
  const service = createMetadataMonitoringService({
    getPoolFn: () => ({ query }),
    metadataMonitoringStore: {
      getArtistMonitoring: async () => ({ isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] }),
      upsertArtistMonitoring,
    },
  });

  const result = await service.updateArtistMonitoring({
    metadataArtistId: 'artist-1',
    patch: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    },
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(upsertArtistMonitoring.mock.calls[0].arguments[0], {
    isMonitored: true,
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album'],
  });
  assert.deepEqual(result, {
    artistId: 'artist-1',
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    },
  });
});

test('updateArtistMonitoring rejects unsupported release-group types', async () => {
  const service = createMetadataMonitoringService({
    getPoolFn: () => ({
      query: async () => ({ rows: [{ id: 'artist-1' }] }),
    }),
    metadataMonitoringStore: {
      getArtistMonitoring: async () => ({ isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] }),
      upsertArtistMonitoring: async () => {},
    },
  });

  await assert.rejects(
    service.updateArtistMonitoring({
      metadataArtistId: 'artist-1',
      patch: {
        isMonitored: true,
        monitoredReleaseGroupTypes: ['single'],
      },
    }),
    {
      code: 'validation_error',
      message: 'Unsupported monitored release-group type: single',
      status: 400,
    },
  );
});
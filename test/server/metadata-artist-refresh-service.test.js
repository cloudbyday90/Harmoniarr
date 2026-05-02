import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataArtistRefreshService } from '../../src/server/metadata/metadata-artist-refresh-service.js';

test('startMetadataArtistRefresh queues a metadata refresh run for a local artist', async (t) => {
  const createOperationRun = t.mock.fn(async ({ artistName, metadataArtistId, musicBrainzArtistId, triggerSource, triggeredByUserId }) => ({
    id: 'run-1',
    artistName,
    metadataArtistId,
    musicBrainzArtistId,
    triggerSource,
    triggeredByUserId,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createMetadataArtistRefreshService({
    createOperationRun,
    getActiveRunByMetadataArtistId: async () => null,
    getMetadataArtist: async () => ({
      artist: {
        id: 'local-artist-1',
        name: 'Autechre',
        source: {
          musicbrainzArtistId: 'mb-artist-1',
        },
      },
    }),
    recordAuditEventFn,
  });

  const result = await service.startMetadataArtistRefresh({
    metadataArtistId: 'local-artist-1',
    requestMetadata: {
      ipAddress: '203.0.113.2',
      userAgent: 'HarmoniarrTest/1.0',
    },
    triggeredByUserId: 'user-1',
  });

  assert.deepEqual(createOperationRun.mock.calls[0].arguments[0], {
    artistName: 'Autechre',
    metadataArtistId: 'local-artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    triggerSource: 'manual',
    triggeredByUserId: 'user-1',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(result, {
    accepted: true,
    run: {
      id: 'run-1',
      artistName: 'Autechre',
      metadataArtistId: 'local-artist-1',
      musicBrainzArtistId: 'mb-artist-1',
      triggerSource: 'manual',
      triggeredByUserId: 'user-1',
    },
  });
});

test('startMetadataArtistRefresh rejects duplicate queued refreshes for the same artist', async () => {
  const service = createMetadataArtistRefreshService({
    createOperationRun: async () => {
      throw new Error('should not create run');
    },
    getActiveRunByMetadataArtistId: async () => ({ id: 'run-1', status: 'running' }),
    getMetadataArtist: async () => ({ artist: { id: 'local-artist-1', source: { musicbrainzArtistId: 'mb-artist-1' } } }),
  });

  await assert.rejects(
    service.startMetadataArtistRefresh({ metadataArtistId: 'local-artist-1' }),
    (error) => error?.code === 'metadata_artist_refresh_in_progress',
  );
});
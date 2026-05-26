import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorMonitoredArtistProjectionService } from '../../src/server/metadata/operator-monitored-artist-projection-service.js';

test('listOperatorMonitoredArtistProjections returns compact operator card summaries', async () => {
  const service = createOperatorMonitoredArtistProjectionService({
    getPoolFn: () => ({
      query: async () => ({ rows: [{ id: 'user-1' }] }),
    }),
    listOperatorMonitoredArtists: async () => [{
      artist: {
        country: 'GB',
        disambiguation: null,
        id: 'artist-1',
        musicBrainzArtistId: 'mbid-1',
        name: 'Autechre',
        sortName: 'Autechre',
        type: 'Group',
      },
      monitoring: {
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
      },
    }],
    getOperatorArtistProjection: async () => ({
      artist: {
        id: 'artist-1',
        name: 'Autechre',
      },
      operator: {
        monitoring: {
          acquisitionProfileKey: 'balanced_library',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
        },
        overview: {
          desiredReleaseGroupCount: 2,
          desiredTrackOverrideCount: 1,
          hasManualOverrides: true,
          partialReleaseGroupCount: 1,
          releaseGroupCount: 4,
          reviewNeededTrackOverrideCount: 0,
          selectedReleaseGroupCount: 1,
          suppressedTrackOverrideCount: 0,
          trackOverrideCount: 1,
          unselectedReleaseGroupCount: 2,
        },
        reconciliation: {
          latestRun: { id: 'run-1', status: 'completed' },
          latestSnapshot: { id: 'snapshot-1', snapshotRevision: 1 },
          pendingRun: null,
          runningRun: null,
          status: 'completed',
        },
      },
    }),
  });

  const result = await service.listOperatorMonitoredArtistProjections({
    appUserId: 'user-1',
    limit: 10,
  });

  assert.deepEqual(result, {
    limit: 10,
    results: [{
      artist: {
        country: 'GB',
        disambiguation: null,
        id: 'artist-1',
        musicBrainzArtistId: 'mbid-1',
        name: 'Autechre',
        sortName: 'Autechre',
        type: 'Group',
      },
      operator: {
        monitoring: {
          acquisitionProfileKey: 'balanced_library',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
        },
        overview: {
          desiredReleaseGroupCount: 2,
          desiredTrackOverrideCount: 1,
          hasManualOverrides: true,
          partialReleaseGroupCount: 1,
          releaseGroupCount: 4,
          reviewNeededTrackOverrideCount: 0,
          selectedReleaseGroupCount: 1,
          suppressedTrackOverrideCount: 0,
          trackOverrideCount: 1,
          unselectedReleaseGroupCount: 2,
        },
        reconciliation: {
          latestRun: { id: 'run-1', status: 'completed' },
          latestSnapshot: { id: 'snapshot-1', snapshotRevision: 1 },
          pendingRun: null,
          runningRun: null,
          status: 'completed',
        },
      },
    }],
  });
});

test('listOperatorMonitoredArtistProjections skips orphaned monitored artists but preserves real failures', async () => {
  const service = createOperatorMonitoredArtistProjectionService({
    getPoolFn: () => ({
      query: async () => ({ rows: [{ id: 'user-1' }] }),
    }),
    listOperatorMonitoredArtists: async () => ([
      {
        artist: {
          id: 'artist-1',
          name: 'Artist One',
        },
        monitoring: {
          isMonitored: true,
        },
      },
      {
        artist: {
          id: 'artist-2',
          name: 'Artist Two',
        },
        monitoring: {
          isMonitored: true,
        },
      },
    ]),
    getOperatorArtistProjection: async ({ metadataArtistId }) => {
      if (metadataArtistId === 'artist-1') {
        return {
          artist: { id: 'artist-1', name: 'Artist One' },
          operator: {
            monitoring: { isMonitored: true },
            overview: { releaseGroupCount: 0 },
            reconciliation: { status: 'idle' },
          },
        };
      }

      const error = new Error('Artist not found');
      error.code = 'metadata_not_found';
      throw error;
    },
  });

  const result = await service.listOperatorMonitoredArtistProjections({
    appUserId: 'user-1',
  });

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].artist.id, 'artist-1');
});

test('listOperatorMonitoredArtistProjections validates limit and user existence', async () => {
  const service = createOperatorMonitoredArtistProjectionService({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
    listOperatorMonitoredArtists: async () => [],
    getOperatorArtistProjection: async () => null,
  });

  await assert.rejects(
    () => service.listOperatorMonitoredArtistProjections({
      appUserId: 'missing-user',
      limit: 10,
    }),
    { code: 'app_user_not_found' },
  );
});

test('listOperatorMonitoredArtistProjections rejects invalid limits', async () => {
  const service = createOperatorMonitoredArtistProjectionService({
    getPoolFn: () => ({
      query: async () => ({ rows: [{ id: 'user-1' }] }),
    }),
    listOperatorMonitoredArtists: async () => [],
    getOperatorArtistProjection: async () => null,
  });

  await assert.rejects(
    () => service.listOperatorMonitoredArtistProjections({
      appUserId: 'user-1',
      limit: 0,
    }),
    { code: 'validation_error' },
  );
});

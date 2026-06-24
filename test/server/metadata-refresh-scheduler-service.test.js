import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataRefreshSchedulerService } from '../../src/server/metadata/metadata-refresh-scheduler-service.js';

test('ensureArtistRefreshScheduled stores an immediate schedule for monitored artists', async (t) => {
  const scheduleArtistRefresh = t.mock.fn(async () => {});
  const service = createMetadataRefreshSchedulerService({
    metadataArtistRefreshStateStore: {
      scheduleArtistRefresh,
    },
    metadataRefreshSchedulingPolicyService: {
      buildInitialSchedule: () => ({ nextRefreshAt: '2026-05-01T12:00:00.000Z' }),
    },
  });

  const result = await service.ensureArtistRefreshScheduled({ metadataArtistId: 'artist-1' });

  assert.deepEqual(scheduleArtistRefresh.mock.calls[0].arguments[0], {
    metadataArtistId: 'artist-1',
    nextRefreshAt: '2026-05-01T12:00:00.000Z',
  });
  assert.deepEqual(result, {
    nextRefreshAt: '2026-05-01T12:00:00.000Z',
  });
});

test('recordArtistRefreshCompleted persists the next schedule only for monitored artists', async (t) => {
  const getMetadataArtist = t.mock.fn(async () => ({
    releaseGroups: [{
      firstReleaseDate: '2026-05-15',
      primaryType: 'Album',
    }],
  }));
  const recordArtistRefresh = t.mock.fn(async () => {});
  const service = createMetadataRefreshSchedulerService({
    getMetadataArtist,
    metadataArtistRefreshStateStore: {
      clearArtistRefreshSchedule: t.mock.fn(async () => {}),
      getArtistRefreshMonitoring: t.mock.fn(async () => ({
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
      })),
      listArtistsDueForRefresh: t.mock.fn(async () => []),
      recordArtistRefresh,
      scheduleArtistRefresh: t.mock.fn(async () => {}),
    },
    metadataRefreshSchedulingPolicyService: {
      buildInitialSchedule: () => ({ nextRefreshAt: '2026-05-01T12:00:00.000Z' }),
      buildNextSchedule: t.mock.fn(() => ({
        activityBand: 'high_activity',
        intervalMs: 12 * 60 * 60 * 1000,
        lastRefreshedAt: '2026-05-01T13:00:00.000Z',
        nextRefreshAt: '2026-05-02T15:00:00.000Z',
        relevantReleaseDateCount: 1,
      })),
    },
  });

  const result = await service.recordArtistRefreshCompleted({
    metadataArtistId: 'artist-1',
    refreshedAt: '2026-05-01T13:00:00.000Z',
  });

  assert.equal(getMetadataArtist.mock.callCount(), 1);
  assert.deepEqual(getMetadataArtist.mock.calls[0].arguments[0], {
    artistId: 'artist-1',
  });

  assert.deepEqual(recordArtistRefresh.mock.calls[0].arguments[0], {
    lastRefreshedAt: '2026-05-01T13:00:00.000Z',
    metadataArtistId: 'artist-1',
    nextRefreshAt: '2026-05-02T15:00:00.000Z',
  });
  assert.deepEqual(result, {
    activityBand: 'high_activity',
    intervalMs: 12 * 60 * 60 * 1000,
    lastRefreshedAt: '2026-05-01T13:00:00.000Z',
    nextRefreshAt: '2026-05-02T15:00:00.000Z',
    relevantReleaseDateCount: 1,
  });
});

test('recordArtistRefreshCompleted clears the schedule for unmonitored artists', async (t) => {
  const clearArtistRefreshSchedule = t.mock.fn(async () => {});
  const service = createMetadataRefreshSchedulerService({
    metadataArtistRefreshStateStore: {
      clearArtistRefreshSchedule,
      getArtistRefreshMonitoring: t.mock.fn(async () => ({ isMonitored: false })),
      listArtistsDueForRefresh: t.mock.fn(async () => []),
      recordArtistRefresh: t.mock.fn(async () => {}),
      scheduleArtistRefresh: t.mock.fn(async () => {}),
    },
    metadataRefreshSchedulingPolicyService: {
      buildInitialSchedule: () => ({ nextRefreshAt: '2026-05-01T12:00:00.000Z' }),
      buildNextSchedule: () => ({
        lastRefreshedAt: '2026-05-01T13:00:00.000Z',
        nextRefreshAt: '2026-05-02T15:00:00.000Z',
      }),
    },
  });

  const result = await service.recordArtistRefreshCompleted({
    metadataArtistId: 'artist-1',
    refreshedAt: '2026-05-01T13:00:00.000Z',
  });

  assert.equal(clearArtistRefreshSchedule.mock.callCount(), 1);
  assert.deepEqual(clearArtistRefreshSchedule.mock.calls[0].arguments[0], {
    metadataArtistId: 'artist-1',
  });
  assert.equal(result, null);
});

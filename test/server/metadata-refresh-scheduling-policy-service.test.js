import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataRefreshSchedulingPolicyService } from '../../src/server/metadata/metadata-refresh-scheduling-policy-service.js';

test('buildInitialSchedule queues newly monitored artists immediately', () => {
  const service = createMetadataRefreshSchedulingPolicyService();

  const schedule = service.buildInitialSchedule({
    now: new Date('2026-05-01T12:00:00.000Z'),
  });

  assert.deepEqual(schedule, {
    nextRefreshAt: '2026-05-01T12:00:00.000Z',
  });
});

test('buildNextSchedule applies a bounded jitter to the next refresh time', () => {
  const service = createMetadataRefreshSchedulingPolicyService({
    baseIntervalMs: 24 * 60 * 60 * 1000,
    jitterRatio: 0.25,
    randomFn: () => 0.5,
  });

  const schedule = service.buildNextSchedule({
    refreshedAt: new Date('2026-05-01T12:00:00.000Z'),
  });

  assert.deepEqual(schedule, {
    activityBand: 'standard',
    intervalMs: 24 * 60 * 60 * 1000,
    lastRefreshedAt: '2026-05-01T12:00:00.000Z',
    nextRefreshAt: '2026-05-02T15:00:00.000Z',
    relevantReleaseDateCount: 0,
  });
});

test('buildNextSchedule shortens cadence for recent or upcoming monitored releases', () => {
  const service = createMetadataRefreshSchedulingPolicyService({
    jitterRatio: 0,
  });

  const schedule = service.buildNextSchedule({
    monitoredReleaseGroupTypes: ['album', 'ep'],
    refreshedAt: new Date('2026-05-01T12:00:00.000Z'),
    releaseGroups: [{
      firstReleaseDate: '2026-05-20',
      primaryType: 'Album',
    }],
  });

  assert.deepEqual(schedule, {
    activityBand: 'high_activity',
    intervalMs: 12 * 60 * 60 * 1000,
    lastRefreshedAt: '2026-05-01T12:00:00.000Z',
    nextRefreshAt: '2026-05-02T00:00:00.000Z',
    relevantReleaseDateCount: 1,
  });
});

test('buildNextSchedule backs off for stable monitored catalogs', () => {
  const service = createMetadataRefreshSchedulingPolicyService({
    jitterRatio: 0,
  });

  const schedule = service.buildNextSchedule({
    monitoredReleaseGroupTypes: ['album'],
    refreshedAt: new Date('2026-05-01T12:00:00.000Z'),
    releaseGroups: [{
      firstReleaseDate: '2023-01-15',
      primaryType: 'Album',
    }],
  });

  assert.deepEqual(schedule, {
    activityBand: 'stable_catalog',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    lastRefreshedAt: '2026-05-01T12:00:00.000Z',
    nextRefreshAt: '2026-05-08T12:00:00.000Z',
    relevantReleaseDateCount: 1,
  });
});
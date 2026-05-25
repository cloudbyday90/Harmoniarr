import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorArtistMonitoringService,
  normalizeOperatorArtistMonitoringPatch,
} from '../../src/server/metadata/operator-artist-monitoring-service.js';

test('normalizeOperatorArtistMonitoringPatch validates and normalizes operator policy', () => {
  const result = normalizeOperatorArtistMonitoringPatch({
    acquisitionProfileKey: 'APPLE_FRIENDLY_PORTABLE',
    isMonitored: true,
    monitoredReleaseGroupTypes: [' Album ', 'single', 'album'],
    releaseScope: 'CURRENT_AND_FUTURE',
    searchOnAddMode: 'MISSING_NOW',
    selectionSourceMode: 'POLICY_PLUS_OVERRIDES',
    wantedAutomationMode: 'CURRENT_AND_FUTURE_MATCHING',
  });

  assert.deepEqual(result, {
    acquisitionProfileKey: 'apple_friendly_portable',
    isMonitored: true,
    lastReconciledAt: null,
    lastSavedSnapshotAt: null,
    monitoredReleaseGroupTypes: ['album', 'single'],
    releaseScope: 'current_and_future',
    searchOnAddMode: 'missing_now',
    selectionSourceMode: 'policy_plus_overrides',
    wantedAutomationMode: 'current_and_future_matching',
  });
});

test('normalizeOperatorArtistMonitoringPatch rejects unsupported release-group types', () => {
  assert.throws(
    () => normalizeOperatorArtistMonitoringPatch({
      isMonitored: true,
      monitoredReleaseGroupTypes: ['bootleg'],
    }),
    {
      code: 'validation_error',
      message: 'Unsupported monitored release-group type: bootleg',
      status: 400,
    },
  );
});

test('updateOperatorArtistMonitoring validates and persists operator policy for an existing user and artist', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    if (sql.includes('FROM app_users')) {
      assert.deepEqual(params, ['user-1']);
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('FROM metadata_artists')) {
      assert.deepEqual(params, ['artist-1']);
      return { rows: [{ id: 'artist-1' }] };
    }

    return { rows: [] };
  });
  const upsertOperatorArtistMonitoring = t.mock.fn(async () => {});
  const service = createOperatorArtistMonitoringService({
    getPoolFn: () => ({ query }),
    operatorArtistMonitoringStore: {
      getOperatorArtistMonitoring: async () => null,
      upsertOperatorArtistMonitoring,
    },
  });

  const result = await service.updateOperatorArtistMonitoring({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    patch: {
      acquisitionProfileKey: 'lossless_archive',
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
      releaseScope: 'future_only',
      searchOnAddMode: 'missing_now',
      selectionSourceMode: 'policy_plus_overrides',
      wantedAutomationMode: 'future_matching',
    },
  });

  assert.equal(query.mock.callCount(), 2);
  assert.deepEqual(upsertOperatorArtistMonitoring.mock.calls[0].arguments[0], {
    acquisitionProfileKey: 'lossless_archive',
    appUserId: 'user-1',
    isMonitored: true,
    lastReconciledAt: null,
    lastSavedSnapshotAt: null,
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
    releaseScope: 'future_only',
    searchOnAddMode: 'missing_now',
    selectionSourceMode: 'policy_plus_overrides',
    wantedAutomationMode: 'future_matching',
  });
  assert.deepEqual(result, {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    monitoring: {
      acquisitionProfileKey: 'lossless_archive',
      isMonitored: true,
      lastReconciledAt: null,
      lastSavedSnapshotAt: null,
      monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
      releaseScope: 'future_only',
      searchOnAddMode: 'missing_now',
      selectionSourceMode: 'policy_plus_overrides',
      wantedAutomationMode: 'future_matching',
    },
  });
});

test('getOperatorArtistMonitoring rejects unknown app users', async () => {
  const service = createOperatorArtistMonitoringService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [] };
        }

        return { rows: [{ id: 'artist-1' }] };
      },
    }),
    operatorArtistMonitoringStore: {
      getOperatorArtistMonitoring: async () => null,
      upsertOperatorArtistMonitoring: async () => {},
    },
  });

  await assert.rejects(
    service.getOperatorArtistMonitoring({
      appUserId: 'missing-user',
      metadataArtistId: 'artist-1',
    }),
    {
      code: 'app_user_not_found',
      message: 'App user was not found: missing-user',
      status: 404,
    },
  );
});

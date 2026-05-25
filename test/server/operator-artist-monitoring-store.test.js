import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';

test('getOperatorArtistMonitoring returns stored operator monitoring state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      acquisition_profile_key: 'balanced_library',
      app_user_id: 'user-1',
      id: 'monitoring-1',
      is_monitored: true,
      last_reconciled_at: new Date('2026-05-25T12:00:00.000Z'),
      last_saved_snapshot_at: new Date('2026-05-25T12:05:00.000Z'),
      metadata_artist_id: 'artist-1',
      monitored_release_group_types: ['album', 'single'],
      release_scope: 'future_only',
      search_on_add_mode: 'none',
      selection_source_mode: 'policy_plus_overrides',
      wanted_automation_mode: 'future_matching',
    }],
  }));
  const store = createOperatorArtistMonitoringStore({ getPoolFn: () => ({ query }) });

  const result = await store.getOperatorArtistMonitoring({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(result, {
    acquisitionProfileKey: 'balanced_library',
    appUserId: 'user-1',
    id: 'monitoring-1',
    isMonitored: true,
    lastReconciledAt: '2026-05-25T12:00:00.000Z',
    lastSavedSnapshotAt: '2026-05-25T12:05:00.000Z',
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album', 'single'],
    releaseScope: 'future_only',
    searchOnAddMode: 'none',
    selectionSourceMode: 'policy_plus_overrides',
    wantedAutomationMode: 'future_matching',
  });
});

test('getOperatorArtistMonitoring returns defaults when no row exists', async () => {
  const store = createOperatorArtistMonitoringStore({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
  });

  const result = await store.getOperatorArtistMonitoring({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(result, {
    acquisitionProfileKey: 'balanced_library',
    appUserId: 'user-1',
    id: null,
    isMonitored: false,
    lastReconciledAt: null,
    lastSavedSnapshotAt: null,
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album', 'ep'],
    releaseScope: 'future_only',
    searchOnAddMode: 'none',
    selectionSourceMode: 'policy_only',
    wantedAutomationMode: 'future_matching',
  });
});

test('upsertOperatorArtistMonitoring stores the current operator policy', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createOperatorArtistMonitoringStore({ getPoolFn: () => ({ query }) });

  await store.upsertOperatorArtistMonitoring({
    acquisitionProfileKey: 'apple_friendly_portable',
    appUserId: 'user-1',
    isMonitored: true,
    lastReconciledAt: '2026-05-25T12:00:00.000Z',
    lastSavedSnapshotAt: '2026-05-25T12:05:00.000Z',
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album', 'single'],
    releaseScope: 'current_and_future',
    searchOnAddMode: 'missing_now',
    selectionSourceMode: 'policy_plus_overrides',
    wantedAutomationMode: 'current_and_future_matching',
  });

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO operator_artist_monitoring/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'artist-1',
    true,
    ['album', 'single'],
    'current_and_future',
    'current_and_future_matching',
    'apple_friendly_portable',
    'missing_now',
    'policy_plus_overrides',
    '2026-05-25T12:00:00.000Z',
    '2026-05-25T12:05:00.000Z',
  ]);
});

test('replaceOperatorArtistMonitoringSnapshot replaces the backup snapshot transactionally', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  const store = createOperatorArtistMonitoringStore({
    getPoolFn: () => ({ connect }),
  });

  await store.replaceOperatorArtistMonitoringSnapshot({
    operatorArtistMonitoring: [{
      acquisitionProfileKey: 'storage_saver',
      appUserId: 'user-1',
      isMonitored: true,
      lastReconciledAt: null,
      lastSavedSnapshotAt: '2026-05-25T13:00:00.000Z',
      metadataArtistId: 'artist-1',
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'future_only',
      searchOnAddMode: 'none',
      selectionSourceMode: 'policy_only',
      wantedAutomationMode: 'future_matching',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls[1].arguments[0], 'DELETE FROM operator_artist_monitoring');
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO operator_artist_monitoring/);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'user-1',
    'artist-1',
    true,
    ['album'],
    'future_only',
    'future_matching',
    'storage_saver',
    'none',
    'policy_only',
    null,
    '2026-05-25T13:00:00.000Z',
  ]);
  assert.equal(release.mock.callCount(), 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as settlePostSave } from 'node:timers/promises';
import { createOperatorArtistActivityService } from '../../src/server/metadata/operator-artist-activity-service.js';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';

// Persistence/activity behavior is exercised separately; unrelated save fixtures supply an explicit transaction writer.
function createSaveServiceForTest(options) {
  return createOperatorArtistSaveService({
    operatorArtistActivityService: { recordSaveActivity: async () => {} },
    ...options,
  });
}

function captureActivity(events, beforeInsert = () => {}) {
  return createOperatorArtistActivityService({ activityEventStore: {
    insertActivityEvent: async (payload) => {
      assert.equal(typeof payload.queryable?.query, 'function', 'Activity must use the active transaction client');
      beforeInsert(payload);
      events.push(payload);
      return { id: `activity-${events.length}` };
    },
  } });
}

test('saveOperatorArtist rejects a stale snapshot revision before replacing user selections', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('FROM app_users')) return { rows: [{ id: 'user-1' }] };
    if (sql.includes('FROM metadata_artists')) return { rows: [{ id: 'artist-1', name: 'Autechre' }] };
    if (sql.includes('FROM operator_artist_monitoring')) return { rows: [] };
    if (sql.includes('FROM operator_artist_reconciliation_snapshot')) {
      return { rows: [{ snapshot_revision: 4 }] };
    }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const replaceOperatorArtistReleaseGroupSelections = t.mock.fn();
  const service = createSaveServiceForTest({
    getPoolFn: () => ({
      connect: async () => ({ query, release: () => {} }),
    }),
    operatorReleaseGroupSelectionStore: { replaceOperatorArtistReleaseGroupSelections },
  });

  await assert.rejects(
    service.saveOperatorArtist({
      appUserId: 'user-1',
      draft: {
        monitoring: {
          acquisitionProfileKey: 'lossless_archive',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album'],
          releaseScope: 'current_and_future',
          searchOnAddMode: 'none',
          selectionSourceMode: 'policy_only',
          wantedAutomationMode: 'current_and_future_matching',
        },
        releaseGroupSelections: [],
        trackOverrides: [],
      },
      expectedSnapshotRevision: 3,
      metadataArtistId: 'artist-1',
    }),
    { code: 'operator_artist_snapshot_conflict', status: 409 },
  );
  assert.equal(replaceOperatorArtistReleaseGroupSelections.mock.callCount(), 0);
});

test('saveOperatorArtist persists normalized state, snapshots it, and queues reconciliation atomically', async (t) => {
  const query = t.mock.fn(async (sql, params = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }

    if (sql.includes('FROM app_users')) {
      assert.deepEqual(params, ['user-1']);
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('FROM metadata_artists')) {
      assert.deepEqual(params, ['artist-1']);
      return { rows: [{ id: 'artist-1', name: 'Autechre' }] };
    }

    if (sql.includes('FROM operator_artist_monitoring')) {
      return {
        rows: [{
          last_reconciled_at: new Date('2026-05-25T11:00:00.000Z'),
          last_saved_snapshot_at: new Date('2026-05-25T11:15:00.000Z'),
        }],
      };
    }

    if (sql.includes('FROM operator_artist_reconciliation_snapshot')) {
      assert.deepEqual(params, ['user-1', 'artist-1']);
      return { rows: [{ snapshot_revision: 1 }] };
    }

    if (sql.includes('FROM metadata_release_groups')) {
      assert.deepEqual(params, [['release-group-1']]);
      return {
        rows: [{
          id: 'release-group-1',
          metadata_artist_id: 'artist-1',
        }],
      };
    }

    if (sql.includes('FROM metadata_releases')) {
      assert.deepEqual(params, [['33333333-3333-4333-8333-333333333333']]);
      return {
        rows: [{
          id: '33333333-3333-4333-8333-333333333333',
          metadata_release_group_id: 'release-group-1',
        }],
      };
    }

    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  const upsertOperatorArtistMonitoring = t.mock.fn(async () => {});
  const replaceOperatorArtistReleaseGroupSelections = t.mock.fn(async () => {});
  const replaceOperatorArtistTrackOverrides = t.mock.fn(async () => {});
  const createOperatorArtistReconciliationSnapshot = t.mock.fn(async () => ({
    createdAt: '2026-05-25T12:00:00.000Z',
    id: 'snapshot-2',
    snapshotRevision: 2,
    updatedAt: '2026-05-25T12:00:00.000Z',
  }));
  const queueLatestSnapshotRun = t.mock.fn(async () => ({
    action: 'created',
    run: { id: 'run-2', status: 'pending' },
    runningRun: null,
  }));
  const getOperatorArtistProjection = t.mock.fn(async () => ({
    operator: {
      monitoring: { isMonitored: true },
    },
    releaseGroups: [{ id: 'release-group-1' }],
    releases: [{ id: '33333333-3333-4333-8333-333333333333' }],
  }));
  const service = createSaveServiceForTest({
    getOperatorArtistProjection,
    getPoolFn: () => ({ connect }),
    operatorArtistMonitoringStore: {
      upsertOperatorArtistMonitoring,
    },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun,
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot,
    },
    operatorReleaseGroupSelectionStore: {
      replaceOperatorArtistReleaseGroupSelections,
    },
    operatorTrackOverrideStore: {
      replaceOperatorArtistTrackOverrides,
    },
  });

  const result = await service.saveOperatorArtist({
    appUserId: 'user-1',
    draft: {
      monitoring: {
        acquisitionProfileKey: 'APPLE_FRIENDLY_PORTABLE',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['Album', 'single'],
        releaseScope: 'CURRENT_AND_FUTURE',
        searchOnAddMode: 'MISSING_NOW',
        selectionSourceMode: 'POLICY_PLUS_OVERRIDES',
        wantedAutomationMode: 'CURRENT_AND_FUTURE_MATCHING',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-1',
        resolvedMetadataReleaseId: '33333333-3333-4333-8333-333333333333',
        selectionSource: 'manual',
        selectionState: 'partial',
      }],
      trackOverrides: [{
        isDesired: false,
        mediumPosition: 1,
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: '33333333-3333-4333-8333-333333333333',
        recordingMbid: '11111111-1111-4111-8111-111111111111',
        remapStatus: 'review_needed',
        trackLengthMsSnapshot: 215000,
        trackMbid: '22222222-2222-4222-8222-222222222222',
        trackPosition: 4,
        trackTitleSnapshot: ' Example Song ',
      }],
    },
    expectedSnapshotRevision: 1,
    metadataArtistId: 'artist-1',
    triggeredByUserId: 'operator-1',
  });

  assert.equal(upsertOperatorArtistMonitoring.mock.callCount(), 2);
  assert.deepEqual(upsertOperatorArtistMonitoring.mock.calls[0].arguments[0], {
    acquisitionProfileKey: 'apple_friendly_portable',
    appUserId: 'user-1',
    isMonitored: true,
    lastReconciledAt: '2026-05-25T11:00:00.000Z',
    lastSavedSnapshotAt: '2026-05-25T11:15:00.000Z',
    metadataArtistId: 'artist-1',
    monitoredReleaseGroupTypes: ['album', 'single'],
    queryable: { query, release },
    releaseScope: 'current_and_future',
    searchOnAddMode: 'missing_now',
    selectionSourceMode: 'policy_plus_overrides',
    wantedAutomationMode: 'current_and_future_matching',
  });
  assert.deepEqual(replaceOperatorArtistReleaseGroupSelections.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    operatorReleaseGroupSelections: [{
      metadataReleaseGroupId: 'release-group-1',
      resolvedMetadataReleaseId: '33333333-3333-4333-8333-333333333333',
      selectionOrigin: null,
      selectionSource: 'manual',
      selectionState: 'partial',
    }],
    queryable: { query, release },
  });
  assert.deepEqual(replaceOperatorArtistTrackOverrides.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    operatorTrackOverrides: [{
      isDesired: false,
      mediumPosition: 1,
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: '33333333-3333-4333-8333-333333333333',
      recordingMbid: '11111111-1111-4111-8111-111111111111',
      remapStatus: 'review_needed',
      trackLengthMsSnapshot: 215000,
      trackMbid: '22222222-2222-4222-8222-222222222222',
      trackPosition: 4,
      trackTitleSnapshot: 'Example Song',
    }],
    queryable: { query, release },
  });
  assert.equal(createOperatorArtistReconciliationSnapshot.mock.callCount(), 1);
  assert.deepEqual(
    createOperatorArtistReconciliationSnapshot.mock.calls[0].arguments[0],
    {
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      queryable: { query, release },
      snapshotPayload: {
        metadataArtistId: 'artist-1',
        monitoring: {
          acquisitionProfileKey: 'apple_friendly_portable',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'single'],
          releaseScope: 'current_and_future',
          searchOnAddMode: 'missing_now',
          selectionSourceMode: 'policy_plus_overrides',
          wantedAutomationMode: 'current_and_future_matching',
        },
        releaseGroupSelections: [{
          metadataReleaseGroupId: 'release-group-1',
          resolvedMetadataReleaseId: '33333333-3333-4333-8333-333333333333',
          selectionOrigin: null,
          selectionSource: 'manual',
          selectionState: 'partial',
        }],
        savedBy: 'operator_artist_detail',
        trackOverrides: [{
          isDesired: false,
          mediumPosition: 1,
          metadataReleaseGroupId: 'release-group-1',
          metadataReleaseId: '33333333-3333-4333-8333-333333333333',
          recordingMbid: '11111111-1111-4111-8111-111111111111',
          remapStatus: 'review_needed',
          trackLengthMsSnapshot: 215000,
          trackMbid: '22222222-2222-4222-8222-222222222222',
          trackPosition: 4,
          trackTitleSnapshot: 'Example Song',
        }],
      },
    },
  );
  assert.equal(queueLatestSnapshotRun.mock.callCount(), 1);
  assert.deepEqual(queueLatestSnapshotRun.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    artistName: 'Autechre',
    client: { query, release },
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-2',
    snapshotRevision: 2,
    triggerSource: 'save',
    triggeredByUserId: 'operator-1',
  });
  assert.equal(getOperatorArtistProjection.mock.callCount(), 1);
  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls.at(-1).arguments[0], 'COMMIT');
  assert.deepEqual(result, {
    artistId: 'artist-1',
    operator: {
      monitoring: { isMonitored: true },
    },
    projection: {
      operator: {
        monitoring: { isMonitored: true },
      },
      releaseGroups: [{ id: 'release-group-1' }],
      releases: [{ id: '33333333-3333-4333-8333-333333333333' }],
    },
    reconciliation: {
      accepted: true,
      coalesced: false,
      queuedBehindRun: false,
      replacedPending: false,
      run: { id: 'run-2', status: 'pending' },
      runningRun: null,
    },
    snapshot: {
      createdAt: '2026-05-25T12:00:00.000Z',
      id: 'snapshot-2',
      snapshotRevision: 2,
      updatedAt: '2026-05-25T12:00:00.000Z',
    },
  });
  assert.equal(release.mock.callCount(), 1);
});

test('saveOperatorArtist rejects overrides when selectionSourceMode is policy_only', async () => {
  const service = createSaveServiceForTest({
    getPoolFn: () => ({
      connect: async () => {
        throw new Error('should not open transaction');
      },
    }),
  });

  await assert.rejects(
    service.saveOperatorArtist({
      expectedSnapshotRevision: 0,
      appUserId: 'user-1',
      draft: {
        monitoring: {
          isMonitored: true,
          selectionSourceMode: 'policy_only',
        },
        releaseGroupSelections: [{
          metadataReleaseGroupId: 'release-group-1',
          selectionState: 'selected',
        }],
      },
      metadataArtistId: 'artist-1',
    }),
    {
      code: 'validation_error',
      message: 'selectionSourceMode policy_only does not allow explicit release-group selections or track overrides',
      status: 400,
    },
  );
});

test('saveOperatorArtist retries the transaction once on unique constraint races', async (t) => {
  const query = t.mock.fn(async (sql, params = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }

    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1', name: 'Autechre' }] };
    }

    if (sql.includes('FROM operator_artist_monitoring')) {
      return { rows: [] };
    }

    if (sql.includes('FROM metadata_release_groups')) {
      return { rows: [] };
    }

    if (sql.includes('FROM metadata_releases')) {
      return { rows: [] };
    }

    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM operator_artist_reconciliation_snapshot')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  let snapshotAttempt = 0;
  const createOperatorArtistReconciliationSnapshot = t.mock.fn(async () => {
    snapshotAttempt += 1;
    if (snapshotAttempt === 1) {
      const error = new Error('duplicate key');
      error.code = '23505';
      throw error;
    }

    return {
      createdAt: '2026-05-25T12:05:00.000Z',
      id: 'snapshot-3',
      snapshotRevision: 3,
      updatedAt: '2026-05-25T12:05:00.000Z',
    };
  });
  const service = createSaveServiceForTest({
    getOperatorArtistProjection: async () => null,
    getPoolFn: () => ({ connect }),
    operatorArtistMonitoringStore: {
      upsertOperatorArtistMonitoring: async () => {},
    },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun: async () => ({
        action: 'created',
        run: { id: 'run-3', status: 'pending' },
        runningRun: null,
      }),
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot,
    },
    operatorReleaseGroupSelectionStore: {
      replaceOperatorArtistReleaseGroupSelections: async () => {},
    },
    operatorTrackOverrideStore: {
      replaceOperatorArtistTrackOverrides: async () => {},
    },
  });

  const result = await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    draft: {
      monitoring: {
        isMonitored: true,
      },
      releaseGroupSelections: [],
      trackOverrides: [],
    },
    metadataArtistId: 'artist-1',
  });

  assert.equal(createOperatorArtistReconciliationSnapshot.mock.callCount(), 2);
  assert.equal(connect.mock.callCount(), 2);
  assert.equal(result.snapshot.snapshotRevision, 3);
});

function createMonitoringSaveHarness() {
  const query = async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }
    if (sql.includes('FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1', name: 'Autechre' }] };
    }
    if (sql.includes('FROM operator_artist_monitoring')) {
      return { rows: [] };
    }
    if (sql.includes('FROM metadata_release_groups')) {
      return { rows: [] };
    }
    if (sql.includes('FROM metadata_releases')) {
      return { rows: [] };
    }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM operator_artist_reconciliation_snapshot')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const connect = async () => ({ query, release: () => {} });

  return {
    getOperatorArtistProjection: async () => null,
    getPoolFn: () => ({ connect }),
    operatorArtistMonitoringStore: {
      upsertOperatorArtistMonitoring: async () => {},
    },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun: async () => ({
        action: 'created',
        run: { id: 'run-9', status: 'pending' },
        runningRun: null,
      }),
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot: async () => ({
        createdAt: '2026-05-25T12:00:00.000Z',
        id: 'snapshot-9',
        snapshotRevision: 1,
        updatedAt: '2026-05-25T12:00:00.000Z',
      }),
    },
    operatorReleaseGroupSelectionStore: {
      replaceOperatorArtistReleaseGroupSelections: async () => {},
    },
    operatorTrackOverrideStore: {
      replaceOperatorArtistTrackOverrides: async () => {},
    },
  };
}

test('saveOperatorArtist queues a metadata discography refresh when an artist is monitored', async (t) => {
  const startMetadataArtistRefresh = t.mock.fn(async () => ({ accepted: true }));
  const service = createSaveServiceForTest({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    draft: {
      monitoring: { isMonitored: true },
      releaseGroupSelections: [],
      trackOverrides: [],
    },
    metadataArtistId: 'artist-1',
    triggeredByUserId: 'operator-1',
  });

  // The refresh is dispatched fire-and-forget after commit; allow the
  // microtask queue to drain before asserting.
  await new Promise((resolve) => { setImmediate(resolve); });

  assert.equal(startMetadataArtistRefresh.mock.callCount(), 1);
  assert.deepEqual(startMetadataArtistRefresh.mock.calls[0].arguments[0], {
    metadataArtistId: 'artist-1',
    triggerSource: 'monitor_added',
    triggeredByUserId: 'operator-1',
  });
});

test('saveOperatorArtist does not queue a metadata refresh when the artist is not monitored', async (t) => {
  const startMetadataArtistRefresh = t.mock.fn(async () => ({ accepted: true }));
  const service = createSaveServiceForTest({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    draft: {
      monitoring: { isMonitored: false },
      releaseGroupSelections: [],
      trackOverrides: [],
    },
    metadataArtistId: 'artist-1',
  });

  await new Promise((resolve) => { setImmediate(resolve); });

  assert.equal(startMetadataArtistRefresh.mock.callCount(), 0);
});

test('saveOperatorArtist still resolves when a queued discography refresh is already in progress', async (t) => {
  const startMetadataArtistRefresh = t.mock.fn(async () => {
    const error = new Error('A metadata refresh is already running or queued for this artist');
    error.code = 'metadata_artist_refresh_in_progress';
    throw error;
  });
  const service = createSaveServiceForTest({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  const result = await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    draft: {
      monitoring: { isMonitored: true },
      releaseGroupSelections: [],
      trackOverrides: [],
    },
    metadataArtistId: 'artist-1',
  });

  await new Promise((resolve) => { setImmediate(resolve); });

  assert.equal(startMetadataArtistRefresh.mock.callCount(), 1);
  assert.equal(result.artistId, 'artist-1');
});

test('saveOperatorArtist records an artist_policy_saved activity event with bounded change summary', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }
    if (sql.includes('FROM metadata_artists')) {
      return {
        rows: [{
          id: 'artist-1',
          musicbrainz_artist_id: 'mb-artist-1',
          name: 'Autechre',
        }],
      };
    }
    if (sql.includes('FROM operator_artist_monitoring')) {
      return {
        rows: [{
          is_monitored: true,
          last_reconciled_at: null,
          last_saved_snapshot_at: null,
        }],
      };
    }
    if (sql.includes('FROM metadata_release_groups')) {
      return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-1' }] };
    }
    if (sql.includes('FROM metadata_releases')) {
      return { rows: [] };
    }
    return { rows: [] };
  });
  const client = { query, release: t.mock.fn(() => {}) };
  const activityEvents = [];
  const service = createSaveServiceForTest({
    getOperatorArtistProjection: async () => ({ artist: { id: 'artist-1' }, operator: { monitoring: { isMonitored: true } } }),
    getPoolFn: () => ({ connect: async () => client }),
    operatorArtistMonitoringStore: {
      getOperatorArtistMonitoring: async () => ({
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
        releaseScope: 'future_only',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_plus_overrides',
        wantedAutomationMode: 'future_matching',
      }),
      upsertOperatorArtistMonitoring: async () => {},
    },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun: async () => ({ action: 'created', run: { id: 'run-1', status: 'pending' }, runningRun: null }),
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot: async () => ({
        createdAt: '2026-06-27T14:00:00.000Z',
        id: 'snapshot-1',
        snapshotRevision: 7,
        updatedAt: '2026-06-27T14:00:00.000Z',
      }),
    },
    operatorReleaseGroupSelectionStore: {
      listOperatorReleaseGroupSelections: async () => [{
        metadataReleaseGroupId: 'release-group-1',
        resolvedMetadataReleaseId: null,
        selectionSource: 'manual',
        selectionState: 'partial',
      }],
      replaceOperatorArtistReleaseGroupSelections: async () => {},
    },
    operatorTrackOverrideStore: {
      listOperatorTrackOverrides: async () => [{
        isDesired: false,
        metadataReleaseGroupId: 'release-group-1',
        remapStatus: 'review_needed',
        trackMbid: '22222222-2222-4222-8222-222222222222',
      }],
      replaceOperatorArtistTrackOverrides: async () => {},
    },
    operatorArtistActivityService: captureActivity(activityEvents, (payload) => {
      assert.equal(payload.queryable, client);
      assert.equal(query.mock.calls.some((call) => call.arguments[0] === 'COMMIT'), false);
    }),
  });

  await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    draft: {
      monitoring: {
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        releaseScope: 'future_only',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_plus_overrides',
        wantedAutomationMode: 'future_matching',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-1',
        resolvedMetadataReleaseId: null,
        selectionSource: 'manual',
        selectionState: 'selected',
      }],
      trackOverrides: [{
        isDesired: false,
        metadataReleaseGroupId: 'release-group-1',
        remapStatus: 'resolved',
        trackMbid: '22222222-2222-4222-8222-222222222222',
      }],
    },
    metadataArtistId: 'artist-1',
    triggeredByUserId: 'operator-1',
  });

  await new Promise((resolve) => { setImmediate(resolve); });

  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'artist_policy_saved');
  assert.equal(activityEvents[0].actorUserId, 'operator-1');
  assert.equal(activityEvents[0].entityId, 'artist-1');
  assert.equal(activityEvents[0].entityTitle, 'Autechre');
  assert.equal(activityEvents[0].extraPayload.artistMusicBrainzId, 'mb-artist-1');
  assert.equal(activityEvents[0].extraPayload.changes.monitoring.changedFieldCount, 1);
  assert.equal(activityEvents[0].extraPayload.changes.releaseGroups.changed, 1);
  assert.equal(activityEvents[0].extraPayload.changes.trackOverrides.resolvedReviewCount, 1);
  assert.equal(activityEvents[0].extraPayload.snapshot.snapshotRevision, 7);
  assert.equal(activityEvents[0].extraPayload.reconciliation.runId, 'run-1');
});

function buildTransitionTestPool({ existingIsMonitored }) {
  const query = async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }
    if (sql.includes('FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1', name: 'Autechre' }] };
    }
    if (sql.includes('FROM operator_artist_monitoring')) {
      return {
        rows: [{
          is_monitored: existingIsMonitored,
          last_reconciled_at: null,
          last_saved_snapshot_at: null,
        }],
      };
    }
    return { rows: [] };
  };
  return { connect: async () => ({ query, release: () => {} }) };
}

test('saveOperatorArtist fires monitor side effects only on the unmonitored -> monitored transition', async (t) => {
  const notifications = [];
  const activityEvents = [];
  const service = createSaveServiceForTest({
    getPoolFn: () => buildTransitionTestPool({ existingIsMonitored: false }),
    getOperatorArtistProjection: async () => ({ operator: { monitoring: { isMonitored: true } } }),
    onArtistMonitoredFn: async (payload) => { notifications.push(payload); },
    operatorArtistActivityService: captureActivity(activityEvents),
    operatorArtistMonitoringStore: { upsertOperatorArtistMonitoring: async () => {} },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun: async () => ({ action: 'created', run: { id: 'run-1', status: 'pending' }, runningRun: null }),
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot: async () => ({ id: 'snap-1', snapshotRevision: 1, createdAt: 't', updatedAt: 't' }),
    },
    operatorReleaseGroupSelectionStore: { replaceOperatorArtistReleaseGroupSelections: async () => {} },
    operatorTrackOverrideStore: { replaceOperatorArtistTrackOverrides: async () => {} },
    startMetadataArtistRefresh: async () => {},
  });

  await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    triggeredByUserId: 'user-1',
    draft: { monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] } },
  });

  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setTimeout(resolve, 0); });

  assert.equal(notifications.length, 1, 'household notification fires once on transition');
  assert.equal(notifications[0].artistName, 'Autechre');
  assert.equal(notifications[0].metadataArtistId, 'artist-1');
  const monitoredEvents = activityEvents.filter((event) => event.eventType === 'artist_monitored');
  assert.equal(monitoredEvents.length, 1, 'artist_monitored activity event fires once on transition');
  assert.equal(monitoredEvents[0].entityId, 'artist-1');
  assert.equal(monitoredEvents[0].actorUserId, 'user-1');
});

test('saveOperatorArtist does not fire monitor side effects when the artist was already monitored', async () => {
  const notifications = [];
  const activityEvents = [];
  const service = createSaveServiceForTest({
    getPoolFn: () => buildTransitionTestPool({ existingIsMonitored: true }),
    getOperatorArtistProjection: async () => ({ operator: { monitoring: { isMonitored: true } } }),
    onArtistMonitoredFn: async (payload) => { notifications.push(payload); },
    operatorArtistActivityService: captureActivity(activityEvents),
    operatorArtistMonitoringStore: { upsertOperatorArtistMonitoring: async () => {} },
    operatorArtistReconciliationRunStore: {
      queueLatestSnapshotRun: async () => ({ action: 'created', run: { id: 'run-1', status: 'pending' }, runningRun: null }),
    },
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot: async () => ({ id: 'snap-1', snapshotRevision: 1, createdAt: 't', updatedAt: 't' }),
    },
    operatorReleaseGroupSelectionStore: { replaceOperatorArtistReleaseGroupSelections: async () => {} },
    operatorTrackOverrideStore: { replaceOperatorArtistTrackOverrides: async () => {} },
    startMetadataArtistRefresh: async () => {},
  });

  await service.saveOperatorArtist({
    expectedSnapshotRevision: 0,
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    triggeredByUserId: 'user-1',
    draft: { monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] } },
  });

  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setTimeout(resolve, 0); });

  assert.equal(notifications.length, 0);
  assert.equal(activityEvents.some((event) => event.eventType === 'artist_monitored'), false);
});

for (const revision of [undefined, null, -1, 1.2, '0', false, Number.MAX_SAFE_INTEGER + 1]) {
  test(`artist save rejects invalid expected revision ${String(revision)} before connecting`, async () => {
    let connected = false;
    const service = createSaveServiceForTest({
      getPoolFn: () => { connected = true; throw new Error('must not connect'); },
    });
    await assert.rejects(service.saveOperatorArtist({
      appUserId: 'user', metadataArtistId: 'artist',
      draft: { monitoring: { isMonitored: true } },
      expectedSnapshotRevision: revision,
    }), { status: 400, code: 'validation_error' });
    assert.equal(connected, false);
  });
}


test('committed save reports nontransactional follow-up failures without rollback or mutation retry', async () => {
  const harness = createMonitoringSaveHarness();
  const sql = [];
  const pool = harness.getPoolFn();
  const connect = pool.connect;
  pool.connect = async () => {
    const client = await connect();
    return { ...client, query: async (statement, values) => { sql.push(statement); return client.query(statement, values); } };
  };
  const evidence = [];
  const service = createSaveServiceForTest({
    ...harness, getPoolFn: () => pool,
    startMetadataArtistRefresh: async () => { throw new Error('provider-secret'); },
    onArtistMonitoredFn: async () => ({ failed: 1 }),
    getOperatorArtistProjection: async () => { throw Object.assign(new Error('db-secret'), { code: '23505' }); },
    postSaveReporter: { writeWarning: (message) => {
      assert.ok(sql.includes('COMMIT'));
      evidence.push(JSON.parse(message));
    } },
  });
  const result = await service.saveOperatorArtist({
    appUserId: 'user-1', metadataArtistId: 'artist-1', expectedSnapshotRevision: 0,
    draft: { monitoring: { isMonitored: true }, releaseGroupSelections: [], trackOverrides: [] },
  });
  await settlePostSave();
  assert.equal(result.snapshot.snapshotRevision, 1);
  assert.equal(result.projection, null);
  assert.equal(result.reconciliation.accepted, true);
  assert.equal(result.reconciliation.run.id, 'run-9');
  assert.equal(sql.filter((statement) => statement === 'COMMIT').length, 1);
  assert.equal(sql.filter((statement) => statement === 'BEGIN').length, 1);
  assert.equal(sql.includes('ROLLBACK'), false);
  assert.deepEqual(evidence.map((entry) => entry.phase).sort(),
    ['metadata_refresh', 'notification', 'projection']);
  assert.ok(evidence.every((entry) => entry.saveCommitted && entry.snapshotRevision === 1));
  assert.ok(!JSON.stringify(evidence).includes('secret'));
});

test('transactional activity failure rejects the save before COMMIT and prevents detached follow-ups', async () => {
  const harness = createMonitoringSaveHarness();
  const sql = [];
  const events = [];
  let followUps = 0;
  let released = 0;
  const pool = harness.getPoolFn();
  const originalConnect = pool.connect;
  pool.connect = async () => {
    const client = await originalConnect();
    return { query: async (statement, parameters) => {
      sql.push(statement);
      return client.query(statement, parameters);
    }, release: () => { released += 1; client.release(); } };
  };
  const failure = new Error('Atomic Activity persistence failed');
  const service = createSaveServiceForTest({
    ...harness, getPoolFn: () => pool,
    operatorArtistActivityService: createOperatorArtistActivityService({ activityEventStore: {
      insertActivityEvent: async (payload) => {
        events.push(payload);
        assert.equal(sql.includes('COMMIT'), false);
        assert.equal(typeof payload.queryable?.query, 'function');
        if (events.length === 2) throw failure;
        return { id: 'first-activity-in-transaction' };
      },
    } }),
    getOperatorArtistProjection: async () => { followUps += 1; },
    startMetadataArtistRefresh: async () => { followUps += 1; },
    onArtistMonitoredFn: async () => { followUps += 1; },
  });
  await assert.rejects(service.saveOperatorArtist({ appUserId: 'user-1', metadataArtistId: 'artist-1',
    expectedSnapshotRevision: 0, draft: { monitoring: { isMonitored: true }, releaseGroupSelections: [], trackOverrides: [] },
  }), failure);
  await settlePostSave();
  assert.deepEqual(sql.filter((statement) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)), ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(events.map(({ eventType }) => eventType), ['artist_policy_saved', 'artist_monitored']);
  assert.equal(followUps, 0);
  assert.equal(released, 1);
});


function deferredRead() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createPreviousReadHarness() {
  const harness = createMonitoringSaveHarness();
  const basePool = harness.getPoolFn();
  const reads = ['monitoring', 'selections', 'overrides'];
  const gates = Object.fromEntries(reads.map((name) => [name, { entered: deferredRead(), settled: deferredRead() }]));
  const events = [];
  let activeRead = null;
  const getPoolFn = () => ({ connect: async () => {
    const baseClient = await basePool.connect();
    return {
      release: () => { events.push('release'); baseClient.release(); },
      query: async (sql, parameters) => {
        assert.equal(activeRead, null, `Transaction query ${sql} overlaps ${activeRead}`);
        if (!sql.startsWith('previous:')) {
          events.push(sql);
          return baseClient.query(sql, parameters);
        }
        const name = sql.slice('previous:'.length);
        activeRead = name;
        events.push(`start:${name}`);
        gates[name].entered.resolve();
        try {
          await gates[name].settled.promise;
          return name === 'monitoring' ? { isMonitored: false } : [];
        } finally {
          events.push(`settled:${name}`);
          activeRead = null;
        }
      },
    };
  } });
  const service = createSaveServiceForTest({
    ...harness, getPoolFn,
    operatorArtistMonitoringStore: {
      ...harness.operatorArtistMonitoringStore,
      getOperatorArtistMonitoring: ({ queryable }) => queryable.query('previous:monitoring'),
    },
    operatorReleaseGroupSelectionStore: {
      ...harness.operatorReleaseGroupSelectionStore,
      listOperatorReleaseGroupSelections: ({ queryable }) => queryable.query('previous:selections'),
    },
    operatorTrackOverrideStore: {
      ...harness.operatorTrackOverrideStore,
      listOperatorTrackOverrides: ({ queryable }) => queryable.query('previous:overrides'),
    },
  });
  const save = () => service.saveOperatorArtist({
    appUserId: 'user-1', metadataArtistId: 'artist-1', expectedSnapshotRevision: 0,
    draft: { monitoring: { isMonitored: false }, releaseGroupSelections: [], trackOverrides: [] },
  });
  return { events, gates, save };
}

test('artist save awaits each previous-state read before using the transaction client again', async () => {
  const { events, gates, save } = createPreviousReadHarness();
  const saving = save();
  for (const [index, name] of ['monitoring', 'selections', 'overrides'].entries()) {
    await gates[name].entered.promise;
    assert.deepEqual(events.filter((event) => event.startsWith('start:')),
      ['monitoring', 'selections', 'overrides'].slice(0, index + 1).map((entry) => `start:${entry}`));
    assert.equal(events.includes('COMMIT'), false);
    assert.equal(events.includes('ROLLBACK'), false);
    gates[name].settled.resolve();
  }
  await saving;
  assert.deepEqual(events.filter((event) => /^(start|settled):/.test(event)), [
    'start:monitoring', 'settled:monitoring', 'start:selections', 'settled:selections',
    'start:overrides', 'settled:overrides',
  ]);
  assert.equal(events.filter((event) => event === 'COMMIT').length, 1);
  assert.equal(events.includes('ROLLBACK'), false);
});

test('artist save waits for a failed previous-state read before rollback and never starts later reads', async () => {
  const { events, gates, save } = createPreviousReadHarness();
  const failure = new Error('Previous monitoring read failed');
  const rejectedSave = assert.rejects(save(), failure);
  await gates.monitoring.entered.promise;
  assert.deepEqual(events.filter((event) => event.startsWith('start:')), ['start:monitoring']);
  assert.equal(events.includes('ROLLBACK'), false);
  assert.equal(events.includes('release'), false);
  gates.monitoring.settled.reject(failure);
  await rejectedSave;
  assert.deepEqual(events.filter((event) => /^(start|settled):/.test(event)), ['start:monitoring', 'settled:monitoring']);
  assert.ok(events.indexOf('ROLLBACK') > events.indexOf('settled:monitoring'));
  assert.deepEqual(events.filter((event) => ['COMMIT', 'ROLLBACK', 'release'].includes(event)), ['ROLLBACK', 'release']);
});

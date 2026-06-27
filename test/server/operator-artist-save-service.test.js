import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';

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
      assert.deepEqual(params, [['release-1']]);
      return {
        rows: [{
          id: 'release-1',
          metadata_release_group_id: 'release-group-1',
        }],
      };
    }

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
    releases: [{ id: 'release-1' }],
  }));
  const service = createOperatorArtistSaveService({
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
        resolvedMetadataReleaseId: 'release-1',
        selectionSource: 'manual',
        selectionState: 'partial',
      }],
      trackOverrides: [{
        isDesired: false,
        mediumPosition: 1,
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        recordingMbid: '11111111-1111-4111-8111-111111111111',
        remapStatus: 'review_needed',
        trackLengthMsSnapshot: 215000,
        trackMbid: '22222222-2222-4222-8222-222222222222',
        trackPosition: 4,
        trackTitleSnapshot: ' Example Song ',
      }],
    },
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
      resolvedMetadataReleaseId: 'release-1',
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
      metadataReleaseId: 'release-1',
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
          resolvedMetadataReleaseId: 'release-1',
          selectionSource: 'manual',
          selectionState: 'partial',
        }],
        savedBy: 'operator_artist_detail',
        trackOverrides: [{
          isDesired: false,
          mediumPosition: 1,
          metadataReleaseGroupId: 'release-group-1',
          metadataReleaseId: 'release-1',
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
      releases: [{ id: 'release-1' }],
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
  const service = createOperatorArtistSaveService({
    getPoolFn: () => ({
      connect: async () => {
        throw new Error('should not open transaction');
      },
    }),
  });

  await assert.rejects(
    service.saveOperatorArtist({
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
  const service = createOperatorArtistSaveService({
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
  const service = createOperatorArtistSaveService({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  await service.saveOperatorArtist({
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
  const service = createOperatorArtistSaveService({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  await service.saveOperatorArtist({
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
  const service = createOperatorArtistSaveService({
    ...createMonitoringSaveHarness(),
    startMetadataArtistRefresh,
  });

  const result = await service.saveOperatorArtist({
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
  const service = createOperatorArtistSaveService({
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
        trackMbid: 'track-1',
      }],
      replaceOperatorArtistTrackOverrides: async () => {},
    },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
  });

  await service.saveOperatorArtist({
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
        trackMbid: 'track-1',
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
  const service = createOperatorArtistSaveService({
    getPoolFn: () => buildTransitionTestPool({ existingIsMonitored: false }),
    getOperatorArtistProjection: async () => ({ operator: { monitoring: { isMonitored: true } } }),
    onArtistMonitoredFn: async (payload) => { notifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
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
  const service = createOperatorArtistSaveService({
    getPoolFn: () => buildTransitionTestPool({ existingIsMonitored: true }),
    getOperatorArtistProjection: async () => ({ operator: { monitoring: { isMonitored: true } } }),
    onArtistMonitoredFn: async (payload) => { notifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
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

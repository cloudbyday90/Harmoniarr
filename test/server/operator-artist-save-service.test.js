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

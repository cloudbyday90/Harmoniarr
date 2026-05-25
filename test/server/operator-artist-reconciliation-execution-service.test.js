import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';

test('executeOperatorArtistReconciliation loads the saved snapshot and summarizes operator state', async () => {
  const throwIfCancelled = async () => {};
  const service = createOperatorArtistReconciliationExecutionService({
    getOperatorArtistMonitoring: async () => ({
      monitoredReleaseGroupTypes: ['album', 'ep'],
      selectionSourceMode: 'policy_only',
      wantedAutomationMode: 'future_matching',
    }),
    getOperatorArtistReconciliationSnapshotById: async () => ({
      createdAt: '2026-05-25T13:00:00.000Z',
      id: 'snapshot-4',
      snapshotPayload: {
        mode: 'save',
        policy: {
          releaseScope: 'future_only',
        },
      },
      snapshotRevision: 4,
      updatedAt: '2026-05-25T13:01:00.000Z',
    }),
    listOperatorReleaseGroupSelections: async () => ([
      { selectionState: 'selected' },
      { selectionState: 'partial' },
      { selectionState: 'unselected' },
    ]),
    listOperatorTrackOverrides: async () => ([
      { isDesired: true },
      { isDesired: false },
      { isDesired: true },
    ]),
  });

  const result = await service.executeOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
    throwIfCancelled,
  });

  assert.equal(result.snapshotId, 'snapshot-4');
  assert.equal(result.releaseGroupSelectionCount, 3);
  assert.equal(result.desiredReleaseGroupCount, 2);
  assert.equal(result.partialReleaseGroupCount, 1);
  assert.equal(result.desiredTrackOverrideCount, 2);
  assert.equal(result.suppressedTrackOverrideCount, 1);
  assert.equal(result.monitoredReleaseGroupTypeCount, 2);
  assert.equal(result.snapshotPayloadKeyCount, 2);
});

test('executeOperatorArtistReconciliation rejects missing saved snapshots', async () => {
  const service = createOperatorArtistReconciliationExecutionService({
    getOperatorArtistMonitoring: async () => ({
      monitoredReleaseGroupTypes: ['album'],
    }),
    getOperatorArtistReconciliationSnapshotById: async () => null,
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
  });

  await assert.rejects(
    service.executeOperatorArtistReconciliation({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      snapshotId: 'snapshot-missing',
      snapshotRevision: 2,
    }),
    {
      code: 'operator_artist_reconciliation_snapshot_not_found',
      message: 'The requested artist reconciliation snapshot could not be found: snapshot-missing',
      status: 404,
    },
  );
});

test('executeOperatorArtistReconciliation rejects snapshot revision mismatches', async () => {
  const service = createOperatorArtistReconciliationExecutionService({
    getOperatorArtistMonitoring: async () => ({
      monitoredReleaseGroupTypes: ['album'],
    }),
    getOperatorArtistReconciliationSnapshotById: async () => ({
      id: 'snapshot-4',
      snapshotPayload: {},
      snapshotRevision: 5,
      updatedAt: '2026-05-25T13:01:00.000Z',
    }),
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
  });

  await assert.rejects(
    service.executeOperatorArtistReconciliation({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      snapshotId: 'snapshot-4',
      snapshotRevision: 4,
    }),
    {
      code: 'operator_artist_reconciliation_snapshot_revision_mismatch',
      message: 'Artist reconciliation snapshot revision mismatch: expected 4, received 5',
      status: 409,
    },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';

test('executeOperatorArtistReconciliation loads the saved snapshot and summarizes operator state', async () => {
  const throwIfCancelled = async () => {};
  const service = createOperatorArtistReconciliationExecutionService({
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [{
        id: 'rg-selected',
        primaryType: 'Album',
        title: 'Amber',
      }, {
        id: 'rg-partial',
        primaryType: 'EP',
        title: 'Anti',
      }, {
        id: 'rg-unselected',
        primaryType: 'Single',
        title: 'Second Scepe',
      }],
      releases: [{
        id: 'release-selected',
        isCanonical: true,
        releaseDate: '2026-06-01',
        releaseGroupId: 'rg-selected',
        title: 'Amber',
      }, {
        id: 'release-partial',
        isCanonical: true,
        releaseDate: '2026-04-01',
        releaseGroupId: 'rg-partial',
        title: 'Anti',
      }],
    }),
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
    listActiveRequestsByMetadataReleaseIds: async () => ([
      {
        existingMatch: { releaseId: 'release-partial' },
        id: 'request-1',
        requestState: 'needs_fetch',
      },
    ]),
    listDiscoveryRequestsByMetadataReleaseIds: async () => [],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
    listOperatorReleaseGroupSelections: async () => ([
      { metadataReleaseGroupId: 'rg-partial', selectionState: 'partial' },
      { metadataReleaseGroupId: 'rg-unselected', selectionState: 'unselected' },
    ]),
    listOperatorTrackOverrides: async () => ([
      { isDesired: true, metadataReleaseGroupId: 'rg-partial' },
      { isDesired: false, metadataReleaseGroupId: 'rg-partial' },
      { isDesired: true, metadataReleaseGroupId: 'rg-partial' },
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
  assert.equal(result.releaseGroupSelectionCount, 2);
  assert.equal(result.desiredReleaseGroupCount, 2);
  assert.equal(result.partialReleaseGroupCount, 1);
  assert.equal(result.desiredTrackOverrideCount, 2);
  assert.equal(result.suppressedTrackOverrideCount, 1);
  assert.equal(result.monitoredReleaseGroupTypeCount, 2);
  assert.equal(result.snapshotPayloadKeyCount, 2);
  assert.equal(result.downstreamEligibleReleaseCount, 1);
  assert.equal(result.futureEligibleCount, 1);
  assert.equal(result.activeRequestBlockedCount, 1);
  assert.equal(result.explicitDesiredReleaseCount, 1);
  assert.equal(result.policyDesiredReleaseCount, 1);
});

test('executeOperatorArtistReconciliation rejects missing saved snapshots', async () => {
  const service = createOperatorArtistReconciliationExecutionService({
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [],
      releases: [],
    }),
    getOperatorArtistMonitoring: async () => ({
      monitoredReleaseGroupTypes: ['album'],
    }),
    listActiveRequestsByMetadataReleaseIds: async () => [],
    listDiscoveryRequestsByMetadataReleaseIds: async () => [],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
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
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [],
      releases: [],
    }),
    getOperatorArtistMonitoring: async () => ({
      monitoredReleaseGroupTypes: ['album'],
    }),
    listActiveRequestsByMetadataReleaseIds: async () => [],
    listDiscoveryRequestsByMetadataReleaseIds: async () => [],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
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

test('executeOperatorArtistReconciliation blocks policy-only historical releases during future-only automation', async () => {
  const service = createOperatorArtistReconciliationExecutionService({
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [{
        id: 'rg-album',
        primaryType: 'Album',
        title: 'Amber',
      }],
      releases: [{
        id: 'release-album',
        isCanonical: true,
        releaseDate: '2026-01-01',
        releaseGroupId: 'rg-album',
        title: 'Amber',
      }],
    }),
    getOperatorArtistMonitoring: async () => ({
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'future_only',
      wantedAutomationMode: 'future_matching',
    }),
    getOperatorArtistReconciliationSnapshotById: async () => ({
      createdAt: '2026-05-25T13:00:00.000Z',
      id: 'snapshot-5',
      snapshotPayload: { mode: 'save' },
      snapshotRevision: 5,
      updatedAt: '2026-05-25T13:01:00.000Z',
    }),
    listActiveRequestsByMetadataReleaseIds: async () => [],
    listDiscoveryRequestsByMetadataReleaseIds: async () => [],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
  });

  const result = await service.executeOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-5',
    snapshotRevision: 5,
  });

  assert.equal(result.desiredReleaseGroupCount, 1);
  assert.equal(result.downstreamEligibleReleaseCount, 0);
  assert.equal(result.futureScopeBlockedCount, 1);
  assert.equal(result.policyDesiredReleaseCount, 1);
  assert.equal(result.explicitDesiredReleaseCount, 0);
});

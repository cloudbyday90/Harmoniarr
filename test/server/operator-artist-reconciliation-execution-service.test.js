import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createReconciliationPublicationFixture } from '../../testing/operator-reconciliation-publication-fixtures.js';

test('execution owns accepted acquisition and plan inputs before later request reads', async () => {
  const fixture = createReconciliationPublicationFixture(); const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let published;
  const snapshot = structuredClone(fixture.input.publicationSource.snapshot);
  const service = createOperatorArtistReconciliationExecutionService({ getMetadataArtist: async () => fixture.artistPayload,
    getOperatorArtistMonitoring: async () => fixture.monitoring, getOperatorArtistReconciliationSnapshotById: async () => snapshot,
    listOperatorReleaseGroupSelections: async () => [], listOperatorTrackOverrides: async () => [], listActiveRequestsByMetadataReleaseIds: async () => [],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [], listDiscoveryRequestsByMetadataReleaseIds: async () => { entered.resolve(); await gate.promise; return []; },
    operatorArtistReconciliationRequestService: { materializeDesiredReleaseRequests: async input => { published = input; return { createdRequestCount: 0, createdRequestIds: [], duplicateSuppressedCount: 0 }; } },
  });
  const input = structuredClone(fixture.input); const expected = structuredClone(input.workerContext);
  const pending = service.executeOperatorArtistReconciliation(input); await entered.promise;
  try { input.workerContext.expectedLease.acquisitionId = 'changed'; fixture.artistPayload.releases[0].title = 'Changed'; fixture.monitoring.wantedAutomationMode = 'manual_only'; snapshot.snapshotRevision = 99; }
  finally { gate.resolve(); }
  const result = await pending; assert.deepEqual(published.workerContext, expected);
  assert.equal(published.desiredReleases[0].releaseTitle, 'Album'); assert.equal(published.desiredReleases[0].eligibleForDownstreamWork, true);
  assert.equal(published.snapshotRevision, 1); assert.equal(result.snapshotRevision, 1); assert.equal(result.wantedAutomationMode, 'future_matching');
});

for (const batch of ['inputs', 'requests']) {
  for (const primary of [new Error('parallel read'), null]) {
    test(`reconciliation drains ${batch} siblings before reporting ${primary === null ? 'null' : 'Error'}`, async () => {
      const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let settled = false; let materialized = false;
      const held = async () => { entered.resolve(); await gate.promise; return []; };
      const fail = async () => { throw primary; };
      const service = createOperatorArtistReconciliationExecutionService({
        getMetadataArtist: batch === 'inputs' ? fail : async () => ({ artist: { name: 'Artist' }, releaseGroups: [], releases: [] }),
        getOperatorArtistMonitoring: async () => null,
        getOperatorArtistReconciliationSnapshotById: async () => {
          if (batch === 'inputs') await held(); return { id: 'snapshot', snapshotRevision: 4 };
        },
        listOperatorReleaseGroupSelections: async () => [], listOperatorTrackOverrides: async () => [],
        listActiveRequestsByMetadataReleaseIds: batch === 'requests' ? fail : async () => [],
        listDiscoveryRequestsByMetadataReleaseIds: batch === 'requests' ? held : async () => [],
        listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
        operatorArtistReconciliationRequestService: { materializeDesiredReleaseRequests: async () => { materialized = true; return {}; } },
      });
      const pending = service.executeOperatorArtistReconciliation({ appUserId: 'operator', metadataArtistId: 'artist', snapshotId: 'snapshot', snapshotRevision: 4 });
      void pending.then(() => { settled = true; }, () => { settled = true; });
      await entered.promise;
      try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); assert.equal(materialized, false); }
      finally { gate.resolve(); await pending.catch(() => {}); }
      await assert.rejects(pending, error => error === primary); assert.equal(materialized, false);
    });
  }
}

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
        releaseDate: '2026-12-01',
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
    operatorArtistReconciliationRequestService: {
      materializeDesiredReleaseRequests: async ({ desiredReleases }) => ({
        createdRequestCount: 1,
        createdRequestIds: ['request-1'],
        createdRequests: desiredReleases.filter((release) => release.eligibleForDownstreamWork),
        discoveryReconciled: true,
        duplicateSuppressedCount: 0,
        skippedRequestCount: 0,
      }),
    },
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
  assert.equal(result.downstreamCreatedRequestCount, 1);
  assert.deepEqual(result.downstreamCreatedRequestIds, ['request-1']);
  assert.equal(result.discoveryReconciled, true);
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
    operatorArtistReconciliationRequestService: {
      materializeDesiredReleaseRequests: async () => ({
        createdRequestCount: 0,
        createdRequestIds: [],
        createdRequests: [],
        discoveryReconciled: false,
        duplicateSuppressedCount: 0,
        skippedRequestCount: 0,
      }),
    },
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
    operatorArtistReconciliationRequestService: {
      materializeDesiredReleaseRequests: async () => ({
        createdRequestCount: 0,
        createdRequestIds: [],
        createdRequests: [],
        discoveryReconciled: false,
        duplicateSuppressedCount: 0,
        skippedRequestCount: 0,
      }),
    },
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
    operatorArtistReconciliationRequestService: {
      materializeDesiredReleaseRequests: async () => ({
        createdRequestCount: 0,
        createdRequestIds: [],
        createdRequests: [],
        discoveryReconciled: false,
        duplicateSuppressedCount: 0,
        skippedRequestCount: 0,
      }),
    },
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

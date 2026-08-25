import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistProjectionService } from '../../src/server/metadata/operator-artist-projection-service.js';

test('getOperatorArtistProjection overlays explicit selections, track overrides, and reconciliation state', async () => {
  const service = createOperatorArtistProjectionService({
    getMetadataArtist: async () => ({
      aliases: [{ id: 'alias-1', alias: 'AFX' }],
      artist: { id: 'artist-1', name: 'Aphex Twin' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [{
        id: 'rg-1',
        primaryType: 'Album',
        title: 'Selected Ambient Works 85-92',
      }],
      releases: [{
        id: 'release-1',
        isCanonical: true,
        releaseGroupId: 'rg-1',
        title: 'Selected Ambient Works 85-92',
      }],
    }),
    getOperatorArtistMonitoring: async () => ({
      acquisitionProfileKey: 'balanced_library',
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album', 'ep'],
      wantedAutomationMode: 'future_matching',
    }),
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      createdAt: '2026-05-25T13:00:00.000Z',
      id: 'snapshot-2',
      snapshotRevision: 2,
      updatedAt: '2026-05-25T13:00:00.000Z',
    }),
    getLatestRunByOperatorArtist: async () => ({
      id: 'run-1',
      status: 'completed',
    }),
    getPendingRunByOperatorArtist: async () => ({
      id: 'run-2',
      status: 'pending',
    }),
    getRunningRunByOperatorArtist: async () => null,
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async ({ metadataReleaseIds }) => {
      assert.deepEqual(metadataReleaseIds, ['release-1']);
      return [{
        lastReconciledAt: '2026-05-25T14:00:00.000Z',
        metadataReleaseId: 'release-1',
        reconciliationStatus: 'partial',
      }];
    },
    listOperatorReleaseGroupSelections: async () => [{
      metadataReleaseGroupId: 'rg-1',
      resolvedMetadataReleaseId: 'release-1',
      selectionOrigin: null,
      selectionSource: 'manual',
      selectionState: 'partial',
    }],
    listOperatorTrackOverrides: async () => [{
      id: 'override-1',
      isDesired: false,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'rg-1',
      remapStatus: 'review_needed',
      trackMbid: 'track-1',
    }],
  });

  const result = await service.getOperatorArtistProjection({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(result, {
    aliases: [{ id: 'alias-1', alias: 'AFX' }],
    artist: { id: 'artist-1', name: 'Aphex Twin' },
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    operator: {
      coverage: {
        acquiredReleaseCount: 0,
        coverageRatio: 0,
        desiredReleaseCount: 1,
        duplicateReleaseCount: 0,
        lastReconciledAt: '2026-05-25T14:00:00.000Z',
        missingReleaseCount: 0,
        partialReleaseCount: 1,
        unresolvedReleaseCount: 0,
      },
      monitoring: {
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        lastReconciledAt: null,
        lastSavedSnapshotAt: null,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        releaseScope: 'future_only',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_only',
        wantedAutomationMode: 'future_matching',
      },
      overview: {
        desiredReleaseGroupCount: 1,
        desiredTrackOverrideCount: 0,
        hasManualOverrides: true,
        manualSelectionCount: 1,
        orphanedReleaseGroupSelectionCount: 0,
        orphanedTrackOverrideCount: 0,
        partialReleaseGroupCount: 1,
        policySelectionCount: 0,
        releaseGroupCount: 1,
        reviewNeededTrackOverrideCount: 1,
        selectedReleaseGroupCount: 0,
        suppressedTrackOverrideCount: 1,
        trackOverrideCount: 1,
        unselectedReleaseGroupCount: 0,
      },
      reconciliation: {
        latestRun: { id: 'run-1', status: 'completed' },
        latestSnapshot: {
          createdAt: '2026-05-25T13:00:00.000Z',
          id: 'snapshot-2',
          snapshotRevision: 2,
          updatedAt: '2026-05-25T13:00:00.000Z',
        },
        pendingRun: { id: 'run-2', status: 'pending' },
        recovery: null,
        runningRun: null,
        status: 'queued',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'rg-1',
        resolvedMetadataReleaseId: 'release-1',
        selectionOrigin: null,
        selectionSource: 'manual',
        selectionState: 'partial',
      }],
      trackOverrides: [{
        id: 'override-1',
        isDesired: false,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'rg-1',
        remapStatus: 'review_needed',
        trackMbid: 'track-1',
      }],
    },
    releaseGroups: [{
      id: 'rg-1',
      operatorState: {
        isExplicitSelection: true,
        resolvedMetadataReleaseId: 'release-1',
        resolvedRelease: {
          id: 'release-1',
          isCanonical: true,
          releaseGroupId: 'rg-1',
          title: 'Selected Ambient Works 85-92',
        },
        selectionOrigin: null,
        selectionSource: 'manual',
        selectionState: 'partial',
        trackOverrideSummary: {
          desiredCount: 0,
          orphanedCount: 0,
          reviewNeededCount: 1,
          suppressedCount: 1,
          totalCount: 1,
        },
      },
      primaryType: 'Album',
      title: 'Selected Ambient Works 85-92',
    }],
    releases: [{
      id: 'release-1',
      isCanonical: true,
      releaseGroupId: 'rg-1',
      title: 'Selected Ambient Works 85-92',
    }],
  });
});

test('getOperatorArtistProjection self-heals a failed reconciliation by queueing one recovery run', async (t) => {
  const recoverFailedOperatorArtistReconciliation = t.mock.fn(async () => ({
    attempted: true,
    errorMessage: null,
    run: { id: 'run-recovery', status: 'pending', triggerSource: 'failure_recovery' },
    status: 'queued',
  }));
  const service = createOperatorArtistProjectionService({
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [],
      releases: [],
    }),
    getOperatorArtistMonitoring: async () => ({ isMonitored: true }),
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      id: 'snapshot-7',
      snapshotRevision: 7,
    }),
    getLatestRunByOperatorArtist: async () => ({
      id: 'run-failed',
      status: 'failed',
      triggerSource: 'save',
    }),
    getPendingRunByOperatorArtist: async () => null,
    getRunningRunByOperatorArtist: async () => null,
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
    operatorArtistReconciliationRecoveryService: {
      recoverFailedOperatorArtistReconciliation,
    },
  });

  const result = await service.getOperatorArtistProjection({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(recoverFailedOperatorArtistReconciliation.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    latestRun: {
      id: 'run-failed',
      status: 'failed',
      triggerSource: 'save',
    },
    latestSnapshot: {
      id: 'snapshot-7',
      snapshotRevision: 7,
    },
    metadataArtistId: 'artist-1',
    pendingRun: null,
    runningRun: null,
  });
  assert.deepEqual(result.operator.reconciliation, {
    latestRun: {
      id: 'run-failed',
      status: 'failed',
      triggerSource: 'save',
    },
    latestSnapshot: {
      createdAt: null,
      id: 'snapshot-7',
      snapshotRevision: 7,
      updatedAt: null,
    },
    pendingRun: { id: 'run-recovery', status: 'pending', triggerSource: 'failure_recovery' },
    recovery: {
      attempted: true,
      errorMessage: null,
      run: { id: 'run-recovery', status: 'pending', triggerSource: 'failure_recovery' },
      status: 'queued',
    },
    runningRun: null,
    status: 'queued',
  });
});

test('getOperatorArtistProjection derives policy-backed release-group defaults and counts orphaned operator rows', async () => {
  const service = createOperatorArtistProjectionService({
    getMetadataArtist: async () => ({
      aliases: [],
      artist: { id: 'artist-1', name: 'Autechre' },
      detectionEvents: [],
      detectionEventsPageInfo: { hasMore: false, nextCursor: null },
      releaseGroups: [
        { id: 'rg-album', primaryType: 'Album', title: 'Amber' },
        { id: 'rg-single', primaryType: 'Single', title: 'Anti' },
      ],
      releases: [{
        id: 'release-album',
        isCanonical: true,
        releaseGroupId: 'rg-album',
        title: 'Amber',
      }],
    }),
    getOperatorArtistMonitoring: async () => ({
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    }),
    getLatestOperatorArtistReconciliationSnapshot: async () => null,
    getLatestRunByOperatorArtist: async () => null,
    getPendingRunByOperatorArtist: async () => null,
    getRunningRunByOperatorArtist: async () => null,
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
    listOperatorReleaseGroupSelections: async () => [{
      metadataReleaseGroupId: 'rg-missing',
      selectionSource: 'manual',
      selectionState: 'selected',
    }],
    listOperatorTrackOverrides: async () => [{
      id: 'override-missing',
      isDesired: true,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'rg-missing',
      remapStatus: 'orphaned',
      trackMbid: 'track-missing',
    }],
  });

  const result = await service.getOperatorArtistProjection({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(result.operator.overview, {
    desiredReleaseGroupCount: 1,
    desiredTrackOverrideCount: 1,
    hasManualOverrides: true,
    manualSelectionCount: 1,
    orphanedReleaseGroupSelectionCount: 1,
    orphanedTrackOverrideCount: 1,
    partialReleaseGroupCount: 0,
    policySelectionCount: 2,
    releaseGroupCount: 2,
    reviewNeededTrackOverrideCount: 0,
    selectedReleaseGroupCount: 1,
    suppressedTrackOverrideCount: 0,
    trackOverrideCount: 1,
    unselectedReleaseGroupCount: 1,
  });
  assert.deepEqual(result.operator.coverage, {
    acquiredReleaseCount: 0,
    coverageRatio: 0,
    desiredReleaseCount: 1,
    duplicateReleaseCount: 0,
    lastReconciledAt: null,
    missingReleaseCount: 1,
    partialReleaseCount: 0,
    unresolvedReleaseCount: 0,
  });
  assert.deepEqual(result.releaseGroups, [
    {
      id: 'rg-album',
      operatorState: {
        isExplicitSelection: false,
        resolvedMetadataReleaseId: 'release-album',
        resolvedRelease: {
          id: 'release-album',
          isCanonical: true,
          releaseGroupId: 'rg-album',
          title: 'Amber',
        },
        selectionOrigin: null,
        selectionSource: 'policy',
        selectionState: 'selected',
        trackOverrideSummary: {
          desiredCount: 0,
          orphanedCount: 0,
          reviewNeededCount: 0,
          suppressedCount: 0,
          totalCount: 0,
        },
      },
      primaryType: 'Album',
      title: 'Amber',
    },
    {
      id: 'rg-single',
      operatorState: {
        isExplicitSelection: false,
        resolvedMetadataReleaseId: null,
        resolvedRelease: null,
        selectionOrigin: null,
        selectionSource: 'policy',
        selectionState: 'unselected',
        trackOverrideSummary: {
          desiredCount: 0,
          orphanedCount: 0,
          reviewNeededCount: 0,
          suppressedCount: 0,
          totalCount: 0,
        },
      },
      primaryType: 'Single',
      title: 'Anti',
    },
  ]);
});

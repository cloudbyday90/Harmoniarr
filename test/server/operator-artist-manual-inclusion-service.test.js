import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorArtistManualInclusionDraft,
  createOperatorArtistManualInclusionService,
} from '../../src/server/metadata/operator-artist-manual-inclusion-service.js';

function createProjection(overrides = {}) {
  return {
    operator: {
      monitoring: {
        acquisitionProfileKey: 'lossless_archive',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        releaseScope: 'current_and_future',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_only',
        wantedAutomationMode: 'current_and_future_matching',
      },
      reconciliation: {
        latestSnapshot: { id: 'snapshot-current', snapshotRevision: 3 },
        status: 'idle',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-other',
        resolvedMetadataReleaseId: 'release-other',
        selectionSource: 'manual',
        selectionState: 'partial',
      }],
      trackOverrides: [{
        isDesired: true,
        metadataReleaseGroupId: 'release-group-other',
        remapStatus: 'resolved',
        trackMbid: 'track-other',
        trackTitleSnapshot: 'Other track',
      }],
    },
    releaseGroups: [{
      id: 'release-group-current',
      operatorState: {
        isExplicitSelection: false,
        resolvedMetadataReleaseId: 'release-current',
        selectionSource: 'policy',
        selectionState: 'selected',
      },
    }],
    releases: [{
      id: 'release-current',
      releaseGroupId: 'release-group-current',
      title: 'Current release',
    }],
    ...overrides,
  };
}

test('includeOperatorArtistReleaseManually builds a complete manual inclusion draft and saves it through the snapshot workflow', async (t) => {
  const projection = createProjection();
  const getOperatorArtistProjection = t.mock.fn(async () => projection);
  const saveOperatorArtist = t.mock.fn(async () => ({
    reconciliation: { run: { id: 'run-1', status: 'pending' } },
    snapshot: { id: 'snapshot-4', snapshotRevision: 4 },
  }));
  const service = createOperatorArtistManualInclusionService({
    getOperatorArtistProjection,
    saveOperatorArtist,
  });

  const result = await service.includeOperatorArtistReleaseManually({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-current',
    metadataReleaseId: 'release-current',
    triggeredByUserId: 'user-9',
  });

  assert.deepEqual(getOperatorArtistProjection.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });
  assert.deepEqual(saveOperatorArtist.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    draft: {
      monitoring: {
        acquisitionProfileKey: 'lossless_archive',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        releaseScope: 'current_and_future',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_plus_overrides',
        wantedAutomationMode: 'current_and_future_matching',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-other',
        resolvedMetadataReleaseId: 'release-other',
        selectionSource: 'manual',
        selectionState: 'partial',
      }, {
        metadataReleaseGroupId: 'release-group-current',
        resolvedMetadataReleaseId: 'release-current',
        selectionSource: 'manual',
        selectionState: 'selected',
      }],
      trackOverrides: [{
        isDesired: true,
        mediumPosition: null,
        metadataReleaseGroupId: 'release-group-other',
        metadataReleaseId: null,
        recordingMbid: null,
        remapStatus: 'resolved',
        trackLengthMsSnapshot: null,
        trackMbid: 'track-other',
        trackPosition: null,
        trackTitleSnapshot: 'Other track',
      }],
    },
    metadataArtistId: 'artist-1',
    triggerSource: 'manual_inclusion',
    triggeredByUserId: 'user-9',
  });
  assert.deepEqual(result, {
    alreadyIncluded: false,
    manualInclusion: {
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-current',
      metadataReleaseId: 'release-current',
      selectionState: 'selected',
    },
    reconciliation: { run: { id: 'run-1', status: 'pending' } },
    snapshot: { id: 'snapshot-4', snapshotRevision: 4 },
  });
});

test('includeOperatorArtistReleaseManually is idempotent when the same manual inclusion is already saved', async (t) => {
  const projection = createProjection({
    operator: {
      ...createProjection().operator,
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-current',
        resolvedMetadataReleaseId: 'release-current',
        selectionSource: 'manual',
        selectionState: 'selected',
      }],
    },
    releaseGroups: [{
      id: 'release-group-current',
      operatorState: {
        isExplicitSelection: true,
        resolvedMetadataReleaseId: 'release-current',
        selectionSource: 'manual',
        selectionState: 'selected',
      },
    }],
  });
  const saveOperatorArtist = t.mock.fn();
  const service = createOperatorArtistManualInclusionService({
    getOperatorArtistProjection: async () => projection,
    saveOperatorArtist,
  });

  const result = await service.includeOperatorArtistReleaseManually({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-current',
    metadataReleaseId: 'release-current',
  });

  assert.equal(saveOperatorArtist.mock.callCount(), 0);
  assert.equal(result.alreadyIncluded, true);
  assert.deepEqual(result.snapshot, { id: 'snapshot-current', snapshotRevision: 3 });
});

test('buildOperatorArtistManualInclusionDraft rejects a stale release or a conflicting manual selection', () => {
  assert.throws(
    () => buildOperatorArtistManualInclusionDraft({
      metadataReleaseGroupId: 'release-group-current',
      metadataReleaseId: 'release-stale',
      projection: createProjection(),
    }),
    {
      code: 'manual_inclusion_unavailable',
      status: 409,
    },
  );

  const projection = createProjection({
    releaseGroups: [{
      id: 'release-group-current',
      operatorState: {
        isExplicitSelection: true,
        resolvedMetadataReleaseId: 'release-current',
        selectionSource: 'manual',
        selectionState: 'partial',
      },
    }],
  });

  assert.throws(
    () => buildOperatorArtistManualInclusionDraft({
      metadataReleaseGroupId: 'release-group-current',
      metadataReleaseId: 'release-current',
      projection,
    }),
    {
      code: 'manual_inclusion_unavailable',
      status: 409,
    },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorArtistManualEditionSelectionDraft,
  createOperatorArtistManualEditionSelectionService,
} from '../../src/server/metadata/operator-artist-manual-edition-selection-service.js';

function createProjection(overrides = {}) {
  return {
    artist: { id: 'artist-1', name: 'Autechre' },
    operator: {
      monitoring: {
        acquisitionProfileKey: 'lossless_archive',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
        releaseScope: 'current_and_future',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_only',
        wantedAutomationMode: 'current_and_future_matching',
      },
      reconciliation: { latestSnapshot: { id: 'snapshot-3', snapshotRevision: 3 } },
      releaseGroupSelections: [],
      trackOverrides: [],
    },
    releaseGroups: [{
      id: 'release-group-1',
      operatorState: {
        isExplicitSelection: false,
        resolvedMetadataReleaseId: 'release-1',
        selectionSource: 'policy',
        selectionState: 'selected',
      },
    }],
    releases: [
      { id: 'release-1', releaseGroupId: 'release-group-1', title: 'Default edition' },
      { id: 'release-2', releaseGroupId: 'release-group-1', title: 'United States edition' },
    ],
    ...overrides,
  };
}

test('manual edition selection derives a complete narrow draft and saves it with the snapshot revision', async (t) => {
  const projection = createProjection();
  const saveOperatorArtist = t.mock.fn(async () => ({
    projection: { ...projection, operator: { ...projection.operator } },
    reconciliation: { run: { id: 'run-4', status: 'pending' } },
    snapshot: { id: 'snapshot-4', snapshotRevision: 4 },
  }));
  const service = createOperatorArtistManualEditionSelectionService({
    getOperatorArtistProjection: async () => projection,
    saveOperatorArtist,
  });

  const result = await service.selectOperatorArtistReleaseEditionManually({
    appUserId: 'user-1',
    expectedSnapshotRevision: 3,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-2',
    triggeredByUserId: 'user-9',
  });

  assert.deepEqual(saveOperatorArtist.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    draft: {
      monitoring: {
        acquisitionProfileKey: 'lossless_archive',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
        releaseScope: 'current_and_future',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_plus_overrides',
        wantedAutomationMode: 'current_and_future_matching',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'release-group-1',
        resolvedMetadataReleaseId: 'release-2',
        selectionOrigin: 'manual_edition',
        selectionSource: 'manual',
        selectionState: 'selected',
      }],
      trackOverrides: [],
    },
    expectedSnapshotRevision: 3,
    metadataArtistId: 'artist-1',
    triggerSource: 'manual_edition_selection',
    triggeredByUserId: 'user-9',
  });
  assert.equal(result.alreadySelected, false);
  assert.deepEqual(result.manualEditionSelection, {
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-2',
    selectionOrigin: 'manual_edition',
    selectionSource: 'manual',
    selectionState: 'selected',
  });
});

test('manual edition selection rejects a stale projection before saving', async (t) => {
  const saveOperatorArtist = t.mock.fn();
  const service = createOperatorArtistManualEditionSelectionService({
    getOperatorArtistProjection: async () => createProjection(),
    saveOperatorArtist,
  });

  await assert.rejects(
    service.selectOperatorArtistReleaseEditionManually({
      appUserId: 'user-1',
      expectedSnapshotRevision: 2,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-2',
    }),
    { code: 'manual_edition_selection_stale', status: 409 },
  );
  assert.equal(saveOperatorArtist.mock.callCount(), 0);
});

test('manual edition selection requires track override review before changing an edition', () => {
  const projection = createProjection({
    operator: {
      ...createProjection().operator,
      trackOverrides: [{
        isDesired: true,
        metadataReleaseGroupId: 'release-group-1',
        remapStatus: 'resolved',
        trackMbid: 'track-1',
      }],
    },
  });

  assert.throws(
    () => buildOperatorArtistManualEditionSelectionDraft({
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-2',
      projection,
    }),
    { code: 'manual_edition_selection_requires_track_review', status: 409 },
  );
});

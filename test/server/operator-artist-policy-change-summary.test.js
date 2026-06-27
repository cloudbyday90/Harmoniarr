import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatorArtistPolicyChangeSummary } from '../../src/server/metadata/operator-artist-policy-change-summary.js';

test('buildOperatorArtistPolicyChangeSummary reports monitoring, selection, and review repair changes', () => {
  const summary = buildOperatorArtistPolicyChangeSummary({
    metadataArtistId: 'artist-1',
    previousMonitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      selectionSourceMode: 'policy_plus_overrides',
    },
    nextMonitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album', 'ep'],
      selectionSourceMode: 'policy_plus_overrides',
    },
    previousReleaseGroupSelections: [{
      metadataReleaseGroupId: 'rg-1',
      resolvedMetadataReleaseId: 'release-1',
      selectionSource: 'manual',
      selectionState: 'partial',
    }],
    nextReleaseGroupSelections: [{
      metadataReleaseGroupId: 'rg-1',
      resolvedMetadataReleaseId: 'release-2',
      selectionSource: 'manual',
      selectionState: 'selected',
    }],
    previousTrackOverrides: [{
      isDesired: false,
      metadataReleaseGroupId: 'rg-1',
      remapStatus: 'review_needed',
      trackMbid: 'track-1',
    }],
    nextTrackOverrides: [{
      isDesired: false,
      metadataReleaseGroupId: 'rg-1',
      remapStatus: 'resolved',
      trackMbid: 'track-1',
    }],
    reconciliation: {
      run: { id: 'run-1', status: 'pending' },
    },
    snapshot: { id: 'snapshot-1', snapshotRevision: 4 },
  });

  assert.equal(summary.hasChanges, true);
  assert.deepEqual(summary.changes.monitoring.changedFields, ['monitoredReleaseGroupTypes']);
  assert.equal(summary.changes.releaseGroups.changed, 1);
  assert.equal(summary.changes.trackOverrides.changed, 1);
  assert.equal(summary.changes.trackOverrides.resolvedReviewCount, 1);
  assert.equal(summary.changes.trackOverrides.clearedReviewCount, 0);
  assert.equal(summary.reconciliation.runId, 'run-1');
  assert.equal(summary.snapshot.snapshotRevision, 4);
});

test('buildOperatorArtistPolicyChangeSummary reports cleared stale review and no-change saves', () => {
  const cleared = buildOperatorArtistPolicyChangeSummary({
    metadataArtistId: 'artist-1',
    previousMonitoring: { isMonitored: true },
    nextMonitoring: { isMonitored: true },
    previousReleaseGroupSelections: [],
    nextReleaseGroupSelections: [],
    previousTrackOverrides: [{
      isDesired: true,
      metadataReleaseGroupId: 'rg-1',
      remapStatus: 'orphaned',
      trackMbid: 'track-1',
    }],
    nextTrackOverrides: [],
  });

  assert.equal(cleared.hasChanges, true);
  assert.equal(cleared.changes.trackOverrides.removed, 1);
  assert.equal(cleared.changes.trackOverrides.clearedReviewCount, 1);

  const unchanged = buildOperatorArtistPolicyChangeSummary({
    metadataArtistId: 'artist-1',
    previousMonitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['ep', 'album'] },
    nextMonitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album', 'ep'] },
    previousReleaseGroupSelections: [],
    nextReleaseGroupSelections: [],
    previousTrackOverrides: [],
    nextTrackOverrides: [],
  });

  assert.equal(unchanged.hasChanges, false);
  assert.equal(unchanged.changes.totalChangeCount, 0);
});


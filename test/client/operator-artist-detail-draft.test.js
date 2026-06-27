/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorArtistSaveDraft,
  createOperatorArtistDetailDraft,
  describeReleaseGroupOverride,
  fingerprintOperatorArtistDraft,
  getDraftReleaseGroupTrackOverrideReviewSummary,
  getDraftTrackOverride,
  getDraftTrackOverrideState,
  getDraftReleaseGroupSelectionState,
  hasDraftReleaseGroupTrackOverrideReview,
  removeDraftTrackOverride,
  resolveDraftTrackOverrideRemapReview,
  setDraftReleaseGroupSelectionState,
  setDraftTrackOverrideState,
} from '../../src/client/lib/operator-artist-detail-draft.js';

function makeReleaseGroup(overrides = {}) {
  return {
    id: 'local-rg-1',
    musicbrainzReleaseGroupId: 'rg-1',
    primaryType: 'Album',
    title: 'OK Computer',
    ...overrides,
  };
}

test('createOperatorArtistDetailDraft normalizes missing projection to default monitored policy', () => {
  const draft = createOperatorArtistDetailDraft();

  assert.equal(draft.monitoring.isMonitored, true);
  assert.deepEqual(draft.monitoring.monitoredReleaseGroupTypes, ['album', 'ep']);
  assert.equal(draft.monitoring.selectionSourceMode, 'policy_only');
  assert.deepEqual(draft.releaseGroupSelections, []);
  assert.deepEqual(draft.trackOverrides, []);
});

test('getDraftReleaseGroupSelectionState derives selected state from broad policy', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: { monitoring: { monitoredReleaseGroupTypes: ['album'] } },
  });

  assert.equal(getDraftReleaseGroupSelectionState(draft, makeReleaseGroup({ primaryType: 'Album' })), 'selected');
  assert.equal(getDraftReleaseGroupSelectionState(draft, makeReleaseGroup({ primaryType: 'Single' })), 'unselected');
});

test('setDraftReleaseGroupSelectionState records manual override only when it differs from policy', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: { monitoring: { monitoredReleaseGroupTypes: ['album'] } },
  });
  const releaseGroup = makeReleaseGroup();

  setDraftReleaseGroupSelectionState(draft, releaseGroup, 'unselected');
  assert.equal(draft.releaseGroupSelections.length, 1);
  assert.equal(draft.releaseGroupSelections[0].metadataReleaseGroupId, 'local-rg-1');
  assert.equal(draft.releaseGroupSelections[0].selectionState, 'unselected');

  setDraftReleaseGroupSelectionState(draft, releaseGroup, 'selected');
  assert.deepEqual(draft.releaseGroupSelections, []);
});

test('buildOperatorArtistSaveDraft marks policy plus overrides only for effective overrides', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
      releaseGroupSelections: [
        { metadataReleaseGroupId: 'local-rg-1', selectionState: 'partial' },
      ],
    },
  });

  const payload = buildOperatorArtistSaveDraft(draft);

  assert.equal(payload.monitoring.selectionSourceMode, 'policy_plus_overrides');
  assert.equal(payload.releaseGroupSelections.length, 1);
  assert.equal(payload.releaseGroupSelections[0].selectionSource, 'manual');
});

test('buildOperatorArtistSaveDraft clears overrides and reverts mode when monitoring is disabled', () => {
  const payload = buildOperatorArtistSaveDraft({
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
    releaseGroupSelections: [
      { metadataReleaseGroupId: 'local-rg-1', selectionState: 'partial' },
    ],
    trackOverrides: [
      { metadataReleaseGroupId: 'local-rg-1', trackMbid: 'track-1', isDesired: true },
    ],
  });

  assert.equal(payload.monitoring.isMonitored, false);
  assert.equal(payload.monitoring.selectionSourceMode, 'policy_only');
  assert.deepEqual(payload.releaseGroupSelections, []);
  assert.deepEqual(payload.trackOverrides, []);
});

test('fingerprintOperatorArtistDraft is stable for semantically equivalent drafts', () => {
  const first = fingerprintOperatorArtistDraft({
    monitoring: { monitoredReleaseGroupTypes: ['album', 'ep'] },
  });
  const second = fingerprintOperatorArtistDraft({
    monitoring: { monitoredReleaseGroupTypes: ['album', 'ep'], selectionSourceMode: 'policy_only' },
    releaseGroupSelections: [],
    trackOverrides: [],
  });

  assert.equal(first, second);
});

test('describeReleaseGroupOverride explains release and track override visibility', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: { monitoring: { monitoredReleaseGroupTypes: ['album'] } },
  });
  const releaseGroup = makeReleaseGroup({
    operatorState: {
      trackOverrideSummary: {
        reviewNeededCount: 1,
        totalCount: 2,
      },
    },
  });

  assert.equal(describeReleaseGroupOverride(draft, releaseGroup), '2 track overrides need review');

  setDraftReleaseGroupSelectionState(draft, releaseGroup, 'partial');
  assert.equal(describeReleaseGroupOverride(draft, releaseGroup), 'Manual partial selection');
});

test('setDraftTrackOverrideState records and clears track override intent', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: { monitoring: { monitoredReleaseGroupTypes: ['album'] } },
  });
  const releaseGroup = makeReleaseGroup();
  const track = {
    lengthMs: 153000,
    position: 3,
    recordingMbid: 'mb-recording-roygbiv',
    title: 'Roygbiv',
  };
  const context = {
    mediumPosition: 1,
    metadataReleaseId: 'local-release-1',
  };

  assert.equal(getDraftTrackOverrideState(draft, releaseGroup, track, context), 'policy');

  setDraftTrackOverrideState(draft, releaseGroup, track, 'suppressed', context);

  assert.equal(getDraftTrackOverrideState(draft, releaseGroup, track, context), 'suppressed');
  assert.equal(draft.trackOverrides.length, 1);
  assert.deepEqual(draft.trackOverrides[0], {
    isDesired: false,
    mediumPosition: 1,
    metadataReleaseGroupId: 'local-rg-1',
    metadataReleaseId: 'local-release-1',
    recordingMbid: 'mb-recording-roygbiv',
    remapStatus: 'resolved',
    trackLengthMsSnapshot: 153000,
    trackMbid: null,
    trackPosition: 3,
    trackTitleSnapshot: 'Roygbiv',
  });
  assert.equal(describeReleaseGroupOverride(draft, releaseGroup), '1 track override');

  setDraftTrackOverrideState(draft, releaseGroup, track, 'desired', context);
  assert.equal(getDraftTrackOverrideState(draft, releaseGroup, track, context), 'desired');
  assert.equal(draft.trackOverrides.length, 1);
  assert.equal(draft.trackOverrides[0].isDesired, true);

  setDraftTrackOverrideState(draft, releaseGroup, track, 'policy', context);
  assert.equal(getDraftTrackOverrideState(draft, releaseGroup, track, context), 'policy');
  assert.deepEqual(draft.trackOverrides, []);
});

test('draft helpers expose track override remap review state for a release group and row', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { monitoredReleaseGroupTypes: ['album'] },
      trackOverrides: [
        {
          isDesired: true,
          mediumPosition: 1,
          metadataReleaseGroupId: 'local-rg-1',
          metadataReleaseId: 'local-release-1',
          recordingMbid: 'mb-recording-roygbiv',
          remapStatus: 'review_needed',
          trackPosition: 3,
          trackTitleSnapshot: 'Roygbiv',
        },
        {
          isDesired: false,
          mediumPosition: 1,
          metadataReleaseGroupId: 'local-rg-1',
          metadataReleaseId: 'local-release-1',
          recordingMbid: 'mb-recording-missing',
          remapStatus: 'orphaned',
          trackPosition: 9,
          trackTitleSnapshot: 'Missing Track',
        },
      ],
    },
  });
  const releaseGroup = makeReleaseGroup();
  const track = {
    position: 3,
    recordingMbid: 'mb-recording-roygbiv',
    title: 'Roygbiv',
  };

  assert.equal(hasDraftReleaseGroupTrackOverrideReview(draft, releaseGroup), true);
  assert.deepEqual(getDraftReleaseGroupTrackOverrideReviewSummary(draft, releaseGroup), {
    hasReview: true,
    orphanedCount: 1,
    reviewNeededCount: 1,
    totalReviewCount: 2,
  });
  assert.equal(
    getDraftTrackOverride(draft, releaseGroup, track, {
      mediumPosition: 1,
      metadataReleaseId: 'local-release-1',
    }).remapStatus,
    'review_needed',
  );
});

test('resolveDraftTrackOverrideRemapReview preserves override intent and clears review state', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { monitoredReleaseGroupTypes: ['album'] },
      trackOverrides: [{
        isDesired: false,
        mediumPosition: 1,
        metadataReleaseGroupId: 'local-rg-1',
        metadataReleaseId: 'local-release-1',
        recordingMbid: 'mb-recording-roygbiv',
        remapStatus: 'review_needed',
        trackPosition: 3,
        trackTitleSnapshot: 'Roygbiv',
      }],
    },
  });

  resolveDraftTrackOverrideRemapReview(draft, draft.trackOverrides[0]);

  assert.equal(draft.trackOverrides.length, 1);
  assert.equal(draft.trackOverrides[0].isDesired, false);
  assert.equal(draft.trackOverrides[0].remapStatus, 'resolved');
  assert.equal(hasDraftReleaseGroupTrackOverrideReview(draft, makeReleaseGroup()), false);
});

test('removeDraftTrackOverride clears the selected override by saved identity', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { monitoredReleaseGroupTypes: ['album'] },
      trackOverrides: [
        {
          isDesired: false,
          mediumPosition: 1,
          metadataReleaseGroupId: 'local-rg-1',
          metadataReleaseId: 'local-release-1',
          recordingMbid: 'mb-recording-roygbiv',
          remapStatus: 'review_needed',
          trackPosition: 3,
          trackTitleSnapshot: 'Roygbiv',
        },
        {
          isDesired: true,
          mediumPosition: 1,
          metadataReleaseGroupId: 'local-rg-1',
          metadataReleaseId: 'local-release-1',
          recordingMbid: 'mb-recording-other',
          remapStatus: 'resolved',
          trackPosition: 4,
          trackTitleSnapshot: 'Other Track',
        },
      ],
    },
  });

  removeDraftTrackOverride(draft, draft.trackOverrides[0]);

  assert.equal(draft.trackOverrides.length, 1);
  assert.equal(draft.trackOverrides[0].recordingMbid, 'mb-recording-other');
});

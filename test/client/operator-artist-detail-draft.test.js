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
  getDraftReleaseGroupSelectionState,
  setDraftReleaseGroupSelectionState,
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

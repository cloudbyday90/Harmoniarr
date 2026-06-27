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
  applyArtistDetailBulkSelection,
  buildArtistDetailBulkSelectionOperation,
  countArtistDetailBulkReleaseTracks,
  shouldConfirmArtistDetailBulkSelection,
  summarizeArtistDetailBulkSelection,
} from '../../src/client/lib/artist-detail-bulk-selection.js';
import {
  createOperatorArtistDetailDraft,
  getDraftReleaseGroupSelectionState,
} from '../../src/client/lib/operator-artist-detail-draft.js';

function makeReleaseGroup(overrides = {}) {
  return {
    id: overrides.id ?? 'rg-1',
    musicbrainzReleaseGroupId: overrides.musicbrainzReleaseGroupId ?? `mb-${overrides.id ?? 'rg-1'}`,
    primaryType: overrides.primaryType ?? 'Album',
    title: overrides.title ?? 'Test Release',
    ...overrides,
  };
}

function makeReleaseGroups(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => makeReleaseGroup({
    id: `rg-${index + 1}`,
    title: `Release ${index + 1}`,
    ...overrides,
  }));
}

test('Artist Detail bulk selection confirms only above release threshold', () => {
  assert.equal(shouldConfirmArtistDetailBulkSelection({ releaseCount: 25, trackCount: 0 }), false);
  assert.equal(shouldConfirmArtistDetailBulkSelection({ releaseCount: 26, trackCount: 0 }), true);
});

test('Artist Detail bulk selection confirms only above track threshold', () => {
  assert.equal(shouldConfirmArtistDetailBulkSelection({ releaseCount: 1, trackCount: 250 }), false);
  assert.equal(shouldConfirmArtistDetailBulkSelection({ releaseCount: 1, trackCount: 251 }), true);
});

test('countArtistDetailBulkReleaseTracks reads resolved release media track counts', () => {
  const releaseGroup = makeReleaseGroup({
    operatorState: {
      resolvedRelease: {
        media: [
          { tracks: [{ title: 'One' }, { title: 'Two' }] },
          { trackCount: 3 },
        ],
      },
    },
  });

  assert.equal(countArtistDetailBulkReleaseTracks({ sourceReleaseGroup: releaseGroup }), 5);
});

test('summarizeArtistDetailBulkSelection counts releases and known tracks', () => {
  const releases = [
    { sourceReleaseGroup: makeReleaseGroup({ id: 'rg-1', trackCount: 8 }) },
    { sourceReleaseGroup: makeReleaseGroup({ id: 'rg-2', trackCount: 10 }) },
  ];

  assert.deepEqual(summarizeArtistDetailBulkSelection(releases), {
    releaseCount: 2,
    trackCount: 18,
  });
});

test('buildArtistDetailBulkSelectionOperation carries threshold result and operation details', () => {
  const operation = buildArtistDetailBulkSelectionOperation({
    releases: makeReleaseGroups(26),
    sectionType: 'Album',
    selectionState: 'unselected',
  });

  assert.equal(operation.requiresConfirmation, true);
  assert.equal(operation.releaseCount, 26);
  assert.equal(operation.trackCount, 0);
  assert.equal(operation.sectionType, 'Album');
  assert.equal(operation.selectionState, 'unselected');
});

test('buildArtistDetailBulkSelectionOperation rejects unsupported bulk states', () => {
  assert.equal(buildArtistDetailBulkSelectionOperation({ selectionState: 'partial' }), null);
});

test('applyArtistDetailBulkSelection applies selected and unselected release-group draft states', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { monitoredReleaseGroupTypes: ['album'] },
    },
  });
  const releases = makeReleaseGroups(2).map((releaseGroup) => ({ sourceReleaseGroup: releaseGroup }));

  applyArtistDetailBulkSelection(draft, releases, 'unselected');

  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[0].sourceReleaseGroup), 'unselected');
  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[1].sourceReleaseGroup), 'unselected');
  assert.deepEqual(
    draft.releaseGroupSelections.map((selection) => selection.metadataReleaseGroupId).sort(),
    ['rg-1', 'rg-2'],
  );

  applyArtistDetailBulkSelection(draft, releases, 'selected');

  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[0].sourceReleaseGroup), 'selected');
  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[1].sourceReleaseGroup), 'selected');
  assert.deepEqual(draft.releaseGroupSelections, []);
});

test('applyArtistDetailBulkSelection creates selected overrides when policy excludes the section', () => {
  const draft = createOperatorArtistDetailDraft({
    operator: {
      monitoring: { monitoredReleaseGroupTypes: ['album'] },
    },
  });
  const releases = makeReleaseGroups(2, { primaryType: 'Single' })
    .map((releaseGroup) => ({ sourceReleaseGroup: releaseGroup }));

  applyArtistDetailBulkSelection(draft, releases, 'selected');

  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[0].sourceReleaseGroup), 'selected');
  assert.equal(getDraftReleaseGroupSelectionState(draft, releases[1].sourceReleaseGroup), 'selected');
  assert.equal(draft.releaseGroupSelections.length, 2);
});

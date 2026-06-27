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
  ARTIST_DETAIL_SECTION_SELECTION_FILTERS,
  ARTIST_DETAIL_SECTION_SORT_OPTIONS,
  applyArtistDetailSectionControls,
  defaultArtistDetailSectionControls,
  isArtistDetailSectionControlsActive,
} from '../../src/client/lib/artist-detail-section-controls.js';

function makeRelease(overrides = {}) {
  return {
    artistCredit: 'Boards of Canada',
    date: '2000-01-01',
    releaseGroup: { primaryType: 'Album' },
    secondaryTypes: [],
    selectionState: 'selected',
    title: 'Alpha',
    ...overrides,
  };
}

test('Artist Detail section controls expose stable option sets', () => {
  assert.deepEqual(
    ARTIST_DETAIL_SECTION_SELECTION_FILTERS.map((option) => option.value),
    ['all', 'selected', 'partial', 'unselected', 'manual_overrides', 'track_review'],
  );
  assert.deepEqual(
    ARTIST_DETAIL_SECTION_SORT_OPTIONS.map((option) => option.value),
    ['newest', 'oldest', 'title_asc', 'title_desc', 'selection_state'],
  );
});

test('isArtistDetailSectionControlsActive is false for defaults', () => {
  assert.equal(isArtistDetailSectionControlsActive(defaultArtistDetailSectionControls), false);
});

test('isArtistDetailSectionControlsActive is true for query, filter, or sort changes', () => {
  assert.equal(isArtistDetailSectionControlsActive({ query: 'geogaddi' }), true);
  assert.equal(isArtistDetailSectionControlsActive({ selectionFilter: 'partial' }), true);
  assert.equal(isArtistDetailSectionControlsActive({ sortMode: 'title_asc' }), true);
});

test('applyArtistDetailSectionControls filters by release title and metadata text', () => {
  const result = applyArtistDetailSectionControls({
    controls: { query: 'geogaddi' },
    releases: [
      makeRelease({ title: 'Music Has the Right to Children' }),
      makeRelease({ title: 'Geogaddi' }),
    ],
  });

  assert.equal(result.visibleCount, 1);
  assert.equal(result.releases[0].title, 'Geogaddi');
  assert.equal(result.isFiltered, true);
});

test('applyArtistDetailSectionControls filters by current draft selection state', () => {
  const result = applyArtistDetailSectionControls({
    controls: { selectionFilter: 'unselected' },
    getSelectionState: (release) => release.selectionState,
    releases: [
      makeRelease({ selectionState: 'selected', title: 'Selected' }),
      makeRelease({ selectionState: 'unselected', title: 'Unselected' }),
    ],
  });

  assert.equal(result.visibleCount, 1);
  assert.equal(result.releases[0].title, 'Unselected');
});

test('applyArtistDetailSectionControls filters manual overrides via injected predicate', () => {
  const result = applyArtistDetailSectionControls({
    controls: { selectionFilter: 'manual_overrides' },
    hasManualOverride: (release) => release.hasManualOverride === true,
    releases: [
      makeRelease({ hasManualOverride: false, title: 'Policy Default' }),
      makeRelease({ hasManualOverride: true, title: 'Manual Exclusion' }),
    ],
  });

  assert.equal(result.visibleCount, 1);
  assert.equal(result.releases[0].title, 'Manual Exclusion');
});

test('applyArtistDetailSectionControls filters track override review via injected predicate', () => {
  const result = applyArtistDetailSectionControls({
    controls: { selectionFilter: 'track_review' },
    hasTrackOverrideReview: (release) => release.hasTrackOverrideReview === true,
    releases: [
      makeRelease({ hasTrackOverrideReview: false, title: 'Clean Override' }),
      makeRelease({ hasTrackOverrideReview: true, title: 'Needs Review' }),
    ],
  });

  assert.equal(result.visibleCount, 1);
  assert.equal(result.releases[0].title, 'Needs Review');
});

test('applyArtistDetailSectionControls sorts newest and oldest by date', () => {
  const releases = [
    makeRelease({ date: '1998-04-20', title: 'Older' }),
    makeRelease({ date: '2002-11-18', title: 'Newer' }),
  ];

  assert.equal(
    applyArtistDetailSectionControls({ controls: { sortMode: 'newest' }, releases }).releases[0].title,
    'Newer',
  );
  assert.equal(
    applyArtistDetailSectionControls({ controls: { sortMode: 'oldest' }, releases }).releases[0].title,
    'Older',
  );
});

test('applyArtistDetailSectionControls sorts by title ascending and descending', () => {
  const releases = [
    makeRelease({ title: 'Zulu' }),
    makeRelease({ title: 'Alpha' }),
  ];

  assert.equal(
    applyArtistDetailSectionControls({ controls: { sortMode: 'title_asc' }, releases }).releases[0].title,
    'Alpha',
  );
  assert.equal(
    applyArtistDetailSectionControls({ controls: { sortMode: 'title_desc' }, releases }).releases[0].title,
    'Zulu',
  );
});

test('applyArtistDetailSectionControls sorts by selection state then date', () => {
  const releases = [
    makeRelease({ date: '2003-01-01', selectionState: 'unselected', title: 'Unselected' }),
    makeRelease({ date: '2002-01-01', selectionState: 'partial', title: 'Partial' }),
    makeRelease({ date: '2001-01-01', selectionState: 'selected', title: 'Selected' }),
  ];
  const result = applyArtistDetailSectionControls({
    controls: { sortMode: 'selection_state' },
    getSelectionState: (release) => release.selectionState,
    releases,
  });

  assert.deepEqual(result.releases.map((release) => release.title), [
    'Selected',
    'Partial',
    'Unselected',
  ]);
});

test('applyArtistDetailSectionControls does not mutate input releases', () => {
  const releases = [
    makeRelease({ title: 'Zulu' }),
    makeRelease({ title: 'Alpha' }),
  ];
  const originalTitles = releases.map((release) => release.title);

  applyArtistDetailSectionControls({ controls: { sortMode: 'title_asc' }, releases });

  assert.deepEqual(releases.map((release) => release.title), originalTitles);
});

test('applyArtistDetailSectionControls normalizes invalid controls to defaults', () => {
  const result = applyArtistDetailSectionControls({
    controls: { selectionFilter: 'bad', sortMode: 'bad' },
    releases: [makeRelease()],
  });

  assert.equal(result.controls.selectionFilter, 'all');
  assert.equal(result.controls.sortMode, 'newest');
  assert.equal(result.visibleCount, 1);
});

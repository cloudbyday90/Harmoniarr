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
  RELEASE_GROUP_TYPE_ORDER,
  buildArtistDetailLocation,
  groupReleaseGroupsByType,
  normalizeReleaseGroupForCard,
} from '../../src/client/lib/artist-detail-route.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReleaseGroup(overrides = {}) {
  return {
    id: 'rg-1',
    musicbrainzReleaseGroupId: 'rg-1',
    title: 'OK Computer',
    primaryType: 'Album',
    secondaryTypes: [],
    firstReleaseDate: '1997-05-21',
    artistCredit: 'Radiohead',
    disambiguation: null,
    sourceProvider: 'musicbrainz',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RELEASE_GROUP_TYPE_ORDER
// ---------------------------------------------------------------------------

test('artist-detail-route RELEASE_GROUP_TYPE_ORDER is a non-empty array', () => {
  assert.ok(Array.isArray(RELEASE_GROUP_TYPE_ORDER));
  assert.ok(RELEASE_GROUP_TYPE_ORDER.length > 0);
});

test('artist-detail-route RELEASE_GROUP_TYPE_ORDER contains Album, EP, Single', () => {
  assert.ok(RELEASE_GROUP_TYPE_ORDER.includes('Album'));
  assert.ok(RELEASE_GROUP_TYPE_ORDER.includes('EP'));
  assert.ok(RELEASE_GROUP_TYPE_ORDER.includes('Single'));
});

test('artist-detail-route RELEASE_GROUP_TYPE_ORDER has Album before EP before Single', () => {
  const albumIdx = RELEASE_GROUP_TYPE_ORDER.indexOf('Album');
  const epIdx = RELEASE_GROUP_TYPE_ORDER.indexOf('EP');
  const singleIdx = RELEASE_GROUP_TYPE_ORDER.indexOf('Single');
  assert.ok(albumIdx < epIdx);
  assert.ok(epIdx < singleIdx);
});

// ---------------------------------------------------------------------------
// buildArtistDetailLocation
// ---------------------------------------------------------------------------

test('buildArtistDetailLocation returns artist-detail route location', () => {
  const loc = buildArtistDetailLocation('some-mbid');
  assert.equal(loc.name, 'artist-detail');
  assert.equal(loc.params.mbid, 'some-mbid');
});

test('buildArtistDetailLocation without nameHint has no query property', () => {
  const loc = buildArtistDetailLocation('some-mbid');
  assert.equal(loc.query, undefined);
});

test('buildArtistDetailLocation with nameHint includes query.name', () => {
  const loc = buildArtistDetailLocation('some-mbid', 'Radiohead');
  assert.equal(loc.query?.name, 'Radiohead');
  assert.equal(loc.params.mbid, 'some-mbid');
});

test('buildArtistDetailLocation preserves the mbid exactly', () => {
  const mbid = '65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab';
  const loc = buildArtistDetailLocation(mbid);
  assert.equal(loc.params.mbid, mbid);
});

// ---------------------------------------------------------------------------
// normalizeReleaseGroupForCard
// ---------------------------------------------------------------------------

test('normalizeReleaseGroupForCard clears id so ArtworkImage uses release-group type', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup());
  assert.equal(normalized.id, null);
  assert.equal(normalized.musicbrainzReleaseId, null);
});

test('normalizeReleaseGroupForCard sets releaseGroupId to the release group MBID', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({
    id: 'local-rg-1',
    musicbrainzReleaseGroupId: 'rg-abc',
  }));
  assert.equal(normalized.releaseGroupId, 'rg-abc');
});

test('normalizeReleaseGroupForCard sets nested releaseGroup.id for ReleaseCard meta', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({
    id: 'local-rg-1',
    musicbrainzReleaseGroupId: 'rg-abc',
  }));
  assert.equal(normalized.releaseGroup.id, 'rg-abc');
});

test('normalizeReleaseGroupForCard preserves local release-group UUID separately', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({
    id: 'local-rg-1',
    musicbrainzReleaseGroupId: 'rg-abc',
  }));
  assert.equal(normalized.metadataReleaseGroupId, 'local-rg-1');
});

test('normalizeReleaseGroupForCard preserves operator release-group state', () => {
  const operatorState = { selectionState: 'partial', selectionSource: 'manual' };
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ operatorState }));
  assert.equal(normalized.operatorState, operatorState);
});

test('normalizeReleaseGroupForCard sets releaseGroup.primaryType from source primaryType', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ primaryType: 'EP' }));
  assert.equal(normalized.releaseGroup.primaryType, 'EP');
});

test('normalizeReleaseGroupForCard maps firstReleaseDate to date for getReleaseYear', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ firstReleaseDate: '2001-06-15' }));
  assert.equal(normalized.date, '2001-06-15');
});

test('normalizeReleaseGroupForCard preserves title', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ title: 'Kid A' }));
  assert.equal(normalized.title, 'Kid A');
});

test('normalizeReleaseGroupForCard preserves artistCredit', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ artistCredit: 'Radiohead' }));
  assert.equal(normalized.artistCredit, 'Radiohead');
});

test('normalizeReleaseGroupForCard handles null primaryType gracefully', () => {
  const normalized = normalizeReleaseGroupForCard(makeReleaseGroup({ primaryType: null }));
  assert.equal(normalized.releaseGroup.primaryType, null);
});

test('normalizeReleaseGroupForCard handles missing firstReleaseDate with null date', () => {
  const rg = makeReleaseGroup();
  delete rg.firstReleaseDate;
  const normalized = normalizeReleaseGroupForCard(rg);
  assert.equal(normalized.date, null);
});

// ---------------------------------------------------------------------------
// groupReleaseGroupsByType — empty and edge cases
// ---------------------------------------------------------------------------

test('groupReleaseGroupsByType returns empty array for empty input', () => {
  assert.deepEqual(groupReleaseGroupsByType([]), []);
});

test('groupReleaseGroupsByType returns empty array for null input', () => {
  assert.deepEqual(groupReleaseGroupsByType(null), []);
});

test('groupReleaseGroupsByType returns empty array for non-array input', () => {
  assert.deepEqual(groupReleaseGroupsByType('not an array'), []);
});

// ---------------------------------------------------------------------------
// groupReleaseGroupsByType — grouping
// ---------------------------------------------------------------------------

test('groupReleaseGroupsByType groups release groups by primaryType', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Album', title: 'Album 1', firstReleaseDate: '2020-01-01' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Single', title: 'Single 1', firstReleaseDate: '2021-06-01' }),
    makeReleaseGroup({ id: 'rg-3', primaryType: 'Album', title: 'Album 2', firstReleaseDate: '2022-01-01' }),
  ];
  const sections = groupReleaseGroupsByType(items);

  const albumSection = sections.find((s) => s.type === 'Album');
  const singleSection = sections.find((s) => s.type === 'Single');

  assert.ok(albumSection);
  assert.equal(albumSection.items.length, 2);
  assert.ok(singleSection);
  assert.equal(singleSection.items.length, 1);
});

test('groupReleaseGroupsByType produces sections in canonical type order', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Single', firstReleaseDate: '2020-01-01' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Album', firstReleaseDate: '2021-01-01' }),
    makeReleaseGroup({ id: 'rg-3', primaryType: 'EP', firstReleaseDate: '2022-01-01' }),
  ];
  const sections = groupReleaseGroupsByType(items);
  const types = sections.map((s) => s.type);

  assert.ok(types.indexOf('Album') < types.indexOf('EP'));
  assert.ok(types.indexOf('EP') < types.indexOf('Single'));
});

test('groupReleaseGroupsByType sorts each section newest first by firstReleaseDate', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Album', title: 'Older', firstReleaseDate: '1997-05-21' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Album', title: 'Newer', firstReleaseDate: '2000-10-02' }),
    makeReleaseGroup({ id: 'rg-3', primaryType: 'Album', title: 'Newest', firstReleaseDate: '2003-06-09' }),
  ];
  const sections = groupReleaseGroupsByType(items);
  const albumItems = sections[0].items;

  assert.equal(albumItems[0].title, 'Newest');
  assert.equal(albumItems[1].title, 'Newer');
  assert.equal(albumItems[2].title, 'Older');
});

test('groupReleaseGroupsByType uses title as sort tiebreaker for same date', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Album', title: 'Zebra', firstReleaseDate: '2020-01-01' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Album', title: 'Alpha', firstReleaseDate: '2020-01-01' }),
  ];
  const sections = groupReleaseGroupsByType(items);
  const albumItems = sections[0].items;

  assert.equal(albumItems[0].title, 'Alpha');
  assert.equal(albumItems[1].title, 'Zebra');
});

test('groupReleaseGroupsByType treats null primaryType as Other', () => {
  const items = [makeReleaseGroup({ id: 'rg-1', primaryType: null, firstReleaseDate: '2020-01-01' })];
  const sections = groupReleaseGroupsByType(items);

  const otherSection = sections.find((s) => s.type === 'Other');
  assert.ok(otherSection);
  assert.equal(otherSection.items.length, 1);
});

test('groupReleaseGroupsByType appends unknown types after canonical types', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Album', firstReleaseDate: '2020-01-01' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Audiobook', firstReleaseDate: '2021-01-01' }),
  ];
  const sections = groupReleaseGroupsByType(items);
  const types = sections.map((s) => s.type);

  assert.ok(types.includes('Album'));
  assert.ok(types.includes('Audiobook'));
  assert.ok(types.indexOf('Album') < types.indexOf('Audiobook'));
});

test('groupReleaseGroupsByType single item returns one section with one item', () => {
  const items = [makeReleaseGroup({ id: 'rg-1', primaryType: 'EP', firstReleaseDate: '2019-03-01' })];
  const sections = groupReleaseGroupsByType(items);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].type, 'EP');
  assert.equal(sections[0].items.length, 1);
});

test('groupReleaseGroupsByType does not mutate the input array', () => {
  const items = [
    makeReleaseGroup({ id: 'rg-1', primaryType: 'Album', firstReleaseDate: '2020-01-01' }),
    makeReleaseGroup({ id: 'rg-2', primaryType: 'Album', firstReleaseDate: '1997-05-21' }),
  ];
  const originalOrder = items.map((i) => i.id);
  groupReleaseGroupsByType(items);

  assert.deepEqual(items.map((i) => i.id), originalOrder);
});

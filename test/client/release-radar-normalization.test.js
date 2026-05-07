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
  getRadarWindowLabel,
  normalizeRadarReleaseForCard,
} from '../../src/client/lib/release-radar-normalization.js';

// ── normalizeRadarReleaseForCard ──────────────────────────────────────────────

test('normalizeRadarReleaseForCard returns empty object for null input', () => {
  assert.deepEqual(normalizeRadarReleaseForCard(null), {});
});

test('normalizeRadarReleaseForCard returns empty object for undefined input', () => {
  assert.deepEqual(normalizeRadarReleaseForCard(undefined), {});
});

test('normalizeRadarReleaseForCard sets id to null regardless of input', () => {
  const result = normalizeRadarReleaseForCard({ metadataReleaseGroupId: 'db-uuid' });
  assert.equal(result.id, null);
});

test('normalizeRadarReleaseForCard sets musicbrainzReleaseId to null', () => {
  const result = normalizeRadarReleaseForCard({ releaseGroupTitle: 'Album' });
  assert.equal(result.musicbrainzReleaseId, null);
});

test('normalizeRadarReleaseForCard maps musicbrainzReleaseGroupId to releaseGroupId for artwork', () => {
  const mbrgid = 'mb-rg-1234';
  const result = normalizeRadarReleaseForCard({ musicbrainzReleaseGroupId: mbrgid });
  assert.equal(result.releaseGroupId, mbrgid);
});

test('normalizeRadarReleaseForCard sets releaseGroupId to null when musicbrainzReleaseGroupId is absent', () => {
  const result = normalizeRadarReleaseForCard({ releaseGroupTitle: 'Album' });
  assert.equal(result.releaseGroupId, null);
});

test('normalizeRadarReleaseForCard maps releaseGroupTitle to title', () => {
  const result = normalizeRadarReleaseForCard({ releaseGroupTitle: 'NTS Sessions' });
  assert.equal(result.title, 'NTS Sessions');
});

test('normalizeRadarReleaseForCard maps artistName to artistCredit', () => {
  const result = normalizeRadarReleaseForCard({ artistName: 'Autechre' });
  assert.equal(result.artistCredit, 'Autechre');
});

test('normalizeRadarReleaseForCard maps firstReleaseDate to date', () => {
  const result = normalizeRadarReleaseForCard({ firstReleaseDate: '2026-04-10' });
  assert.equal(result.date, '2026-04-10');
});

test('normalizeRadarReleaseForCard maps releaseGroupType to releaseGroup.primaryType', () => {
  const result = normalizeRadarReleaseForCard({ releaseGroupType: 'Album' });
  assert.equal(result.releaseGroup.primaryType, 'Album');
});

test('normalizeRadarReleaseForCard sets releaseGroup.primaryType to null when releaseGroupType is absent', () => {
  const result = normalizeRadarReleaseForCard({ releaseGroupTitle: 'Album' });
  assert.equal(result.releaseGroup.primaryType, null);
});

test('normalizeRadarReleaseForCard forwards metadataArtistId', () => {
  const result = normalizeRadarReleaseForCard({ metadataArtistId: 'artist-uuid' });
  assert.equal(result.metadataArtistId, 'artist-uuid');
});

test('normalizeRadarReleaseForCard forwards metadataReleaseGroupId', () => {
  const result = normalizeRadarReleaseForCard({ metadataReleaseGroupId: 'rg-uuid' });
  assert.equal(result.metadataReleaseGroupId, 'rg-uuid');
});

test('normalizeRadarReleaseForCard normalizes a full radar item correctly', () => {
  const item = {
    artistName: 'Autechre',
    firstReleaseDate: '2026-04-10',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    musicbrainzArtistId: 'mb-artist-1',
    musicbrainzReleaseGroupId: 'mb-rg-1',
    releaseGroupTitle: 'NTS Sessions',
    releaseGroupType: 'Album',
  };

  const result = normalizeRadarReleaseForCard(item);

  assert.equal(result.id, null);
  assert.equal(result.musicbrainzReleaseId, null);
  assert.equal(result.releaseGroupId, 'mb-rg-1');
  assert.equal(result.title, 'NTS Sessions');
  assert.equal(result.artistCredit, 'Autechre');
  assert.equal(result.date, '2026-04-10');
  assert.equal(result.releaseGroup.primaryType, 'Album');
  assert.equal(result.metadataArtistId, 'artist-1');
  assert.equal(result.metadataReleaseGroupId, 'rg-1');
  assert.equal(result.musicbrainzArtistId, 'mb-artist-1');
});

// ── getRadarWindowLabel ───────────────────────────────────────────────────────

test('getRadarWindowLabel returns "New this week" for recent 7 days', () => {
  assert.equal(getRadarWindowLabel('recent', 7), 'New this week');
});

test('getRadarWindowLabel returns "New this month" for recent 30 days', () => {
  assert.equal(getRadarWindowLabel('recent', 30), 'New this month');
});

test('getRadarWindowLabel returns generic label for recent window over 30 days', () => {
  assert.equal(getRadarWindowLabel('recent', 60), 'New in the last 60 days');
});

test('getRadarWindowLabel returns "Coming this week" for upcoming 7 days', () => {
  assert.equal(getRadarWindowLabel('upcoming', 7), 'Coming this week');
});

test('getRadarWindowLabel returns "Coming this month" for upcoming 30 days', () => {
  assert.equal(getRadarWindowLabel('upcoming', 30), 'Coming this month');
});

test('getRadarWindowLabel returns "Coming soon" for upcoming 90 days', () => {
  assert.equal(getRadarWindowLabel('upcoming', 90), 'Coming soon');
});

test('getRadarWindowLabel returns generic label for upcoming window over 90 days', () => {
  assert.equal(getRadarWindowLabel('upcoming', 180), 'Coming in the next 180 days');
});

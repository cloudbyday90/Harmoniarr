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
  formatWantedTrackCounts,
  getWantedStatusLabel,
  getWantedStatusTone,
  normalizeWantedReleaseForCard,
} from '../../src/client/lib/wanted-release-normalization.js';

// ── normalizeWantedReleaseForCard ─────────────────────────────────────────────

test('normalizeWantedReleaseForCard returns empty object for null input', () => {
  assert.deepEqual(normalizeWantedReleaseForCard(null), {});
});

test('normalizeWantedReleaseForCard returns empty object for undefined input', () => {
  assert.deepEqual(normalizeWantedReleaseForCard(undefined), {});
});

test('normalizeWantedReleaseForCard sets id to null regardless of input id', () => {
  const result = normalizeWantedReleaseForCard({ id: 'db-uuid-not-mbid' });
  assert.equal(result.id, null);
});

test('normalizeWantedReleaseForCard maps musicbrainzReleaseId through for artwork', () => {
  const mbid = '550e8400-e29b-41d4-a716-446655440000';
  const result = normalizeWantedReleaseForCard({ musicbrainzReleaseId: mbid });
  assert.equal(result.musicbrainzReleaseId, mbid);
});

test('normalizeWantedReleaseForCard sets musicbrainzReleaseId to null when absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.musicbrainzReleaseId, null);
});

test('normalizeWantedReleaseForCard maps musicbrainzReleaseGroupId to releaseGroupId', () => {
  const rgid = 'aaaaaaaa-e29b-41d4-a716-446655440001';
  const result = normalizeWantedReleaseForCard({ musicbrainzReleaseGroupId: rgid });
  assert.equal(result.releaseGroupId, rgid);
});

test('normalizeWantedReleaseForCard sets releaseGroupId to null when absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.releaseGroupId, null);
});

test('normalizeWantedReleaseForCard maps releaseTitle to title', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Discovery' });
  assert.equal(result.title, 'Discovery');
});

test('normalizeWantedReleaseForCard maps artistName to artistCredit', () => {
  const result = normalizeWantedReleaseForCard({ artistName: 'Daft Punk' });
  assert.equal(result.artistCredit, 'Daft Punk');
});

test('normalizeWantedReleaseForCard maps releaseDisambiguation to disambiguation', () => {
  const result = normalizeWantedReleaseForCard({ releaseDisambiguation: 'US edition' });
  assert.equal(result.disambiguation, 'US edition');
});

test('normalizeWantedReleaseForCard maps releaseDate to date', () => {
  const result = normalizeWantedReleaseForCard({ releaseDate: '2001-03-12' });
  assert.equal(result.date, '2001-03-12');
});

test('normalizeWantedReleaseForCard maps releaseGroupType to releaseGroup.primaryType', () => {
  const result = normalizeWantedReleaseForCard({ releaseGroupType: 'Album' });
  assert.deepEqual(result.releaseGroup, { primaryType: 'Album' });
});

test('normalizeWantedReleaseForCard sets releaseGroup.primaryType to null when type absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.deepEqual(result.releaseGroup, { primaryType: null });
});

test('normalizeWantedReleaseForCard forwards wantedStatus', () => {
  const result = normalizeWantedReleaseForCard({ wantedStatus: 'missing' });
  assert.equal(result.wantedStatus, 'missing');
});

test('normalizeWantedReleaseForCard forwards partial wantedStatus', () => {
  const result = normalizeWantedReleaseForCard({ wantedStatus: 'partial' });
  assert.equal(result.wantedStatus, 'partial');
});

test('normalizeWantedReleaseForCard forwards track counts', () => {
  const result = normalizeWantedReleaseForCard({
    expectedTrackCount: 10,
    matchedTrackCount: 6,
    missingTrackCount: 4,
  });
  assert.equal(result.expectedTrackCount, 10);
  assert.equal(result.matchedTrackCount, 6);
  assert.equal(result.missingTrackCount, 4);
});

test('normalizeWantedReleaseForCard defaults track counts to 0 when absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.expectedTrackCount, 0);
  assert.equal(result.matchedTrackCount, 0);
  assert.equal(result.missingTrackCount, 0);
});

test('normalizeWantedReleaseForCard forwards metadataArtistId', () => {
  const result = normalizeWantedReleaseForCard({ metadataArtistId: 'local-artist-uuid' });
  assert.equal(result.metadataArtistId, 'local-artist-uuid');
});

test('normalizeWantedReleaseForCard sets metadataArtistId to null when absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.metadataArtistId, null);
});

test('normalizeWantedReleaseForCard does not mutate the input object', () => {
  const input = { id: 'some-db-id', releaseTitle: 'Album', musicbrainzReleaseId: 'mbid-123' };
  const frozen = Object.freeze({ ...input });
  normalizeWantedReleaseForCard(frozen);
  assert.equal(frozen.id, 'some-db-id');
});

test('normalizeWantedReleaseForCard maps a full realistic wanted release', () => {
  const input = {
    id: 'db-uuid-library-record',
    artistName: 'Radiohead',
    expectedTrackCount: 10,
    matchedTrackCount: 0,
    metadataArtistId: 'local-artist-1',
    metadataReleaseGroupId: 'local-rg-1',
    metadataReleaseId: 'local-release-1',
    missingTrackCount: 10,
    musicbrainzReleaseGroupId: 'rg-mbid-radiohead-ok',
    musicbrainzReleaseId: 'rel-mbid-radiohead-ok',
    releaseCountry: 'GB',
    releaseDate: '2000-10-02',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Kid A',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Kid A',
    wantedStatus: 'missing',
  };

  const result = normalizeWantedReleaseForCard(input);

  assert.equal(result.id, null);
  assert.equal(result.musicbrainzReleaseId, 'rel-mbid-radiohead-ok');
  assert.equal(result.releaseGroupId, 'rg-mbid-radiohead-ok');
  assert.equal(result.title, 'Kid A');
  assert.equal(result.artistCredit, 'Radiohead');
  assert.equal(result.date, '2000-10-02');
  assert.deepEqual(result.releaseGroup, { primaryType: 'Album' });
  assert.equal(result.wantedStatus, 'missing');
  assert.equal(result.expectedTrackCount, 10);
  assert.equal(result.matchedTrackCount, 0);
  assert.equal(result.missingTrackCount, 10);
  assert.equal(result.metadataArtistId, 'local-artist-1');
});

// ── getWantedStatusLabel ───────────────────────────────────────────────────────

test('getWantedStatusLabel returns "Missing" for missing status', () => {
  assert.equal(getWantedStatusLabel('missing'), 'Missing');
});

test('getWantedStatusLabel returns "Partial" for partial status', () => {
  assert.equal(getWantedStatusLabel('partial'), 'Partial');
});

test('getWantedStatusLabel returns the status string for unknown values', () => {
  assert.equal(getWantedStatusLabel('custom'), 'custom');
});

test('getWantedStatusLabel returns "Unknown" for null', () => {
  assert.equal(getWantedStatusLabel(null), 'Unknown');
});

test('getWantedStatusLabel returns "Unknown" for undefined', () => {
  assert.equal(getWantedStatusLabel(undefined), 'Unknown');
});

// ── getWantedStatusTone ───────────────────────────────────────────────────────

test('getWantedStatusTone returns "danger" for missing status', () => {
  assert.equal(getWantedStatusTone('missing'), 'danger');
});

test('getWantedStatusTone returns "warning" for partial status', () => {
  assert.equal(getWantedStatusTone('partial'), 'warning');
});

test('getWantedStatusTone returns "info" for unknown status', () => {
  assert.equal(getWantedStatusTone('unknown-value'), 'info');
});

test('getWantedStatusTone returns "info" for null', () => {
  assert.equal(getWantedStatusTone(null), 'info');
});

// ── formatWantedTrackCounts ───────────────────────────────────────────────────

test('formatWantedTrackCounts returns null for null input', () => {
  assert.equal(formatWantedTrackCounts(null), null);
});

test('formatWantedTrackCounts returns null when expectedTrackCount is 0', () => {
  assert.equal(formatWantedTrackCounts({ expectedTrackCount: 0, matchedTrackCount: 0 }), null);
});

test('formatWantedTrackCounts returns null when expectedTrackCount is absent', () => {
  assert.equal(formatWantedTrackCounts({ matchedTrackCount: 5 }), null);
});

test('formatWantedTrackCounts returns "0 / N tracks" for fully missing release', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 10, matchedTrackCount: 0 });
  assert.equal(result, '0 / 10 tracks');
});

test('formatWantedTrackCounts returns "M / N tracks" for partial release', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 12, matchedTrackCount: 8 });
  assert.equal(result, '8 / 12 tracks');
});

test('formatWantedTrackCounts handles single track correctly', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 0 });
  assert.equal(result, '0 / 1 tracks');
});

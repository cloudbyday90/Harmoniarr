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
  formatLibraryTrackCounts,
  getReconciliationStatusLabel,
  getReconciliationStatusTone,
  normalizeLibraryReleaseForCard,
} from '../../src/client/lib/library-release-normalization.js';

// ── normalizeLibraryReleaseForCard ────────────────────────────────────────────

test('normalizeLibraryReleaseForCard returns empty object for null input', () => {
  assert.deepEqual(normalizeLibraryReleaseForCard(null), {});
});

test('normalizeLibraryReleaseForCard returns empty object for undefined input', () => {
  assert.deepEqual(normalizeLibraryReleaseForCard(undefined), {});
});

test('normalizeLibraryReleaseForCard sets id to null regardless of input id', () => {
  const result = normalizeLibraryReleaseForCard({ id: 'reconciliation-db-uuid' });
  assert.equal(result.id, null);
});

test('normalizeLibraryReleaseForCard maps musicbrainzReleaseId through for artwork', () => {
  const mbid = '550e8400-e29b-41d4-a716-446655440000';
  const result = normalizeLibraryReleaseForCard({ musicbrainzReleaseId: mbid });
  assert.equal(result.musicbrainzReleaseId, mbid);
});

test('normalizeLibraryReleaseForCard sets musicbrainzReleaseId to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.musicbrainzReleaseId, null);
});

test('normalizeLibraryReleaseForCard maps musicbrainzReleaseGroupId to releaseGroupId', () => {
  const rgid = 'rg-mbid-00000001';
  const result = normalizeLibraryReleaseForCard({ musicbrainzReleaseGroupId: rgid });
  assert.equal(result.releaseGroupId, rgid);
});

test('normalizeLibraryReleaseForCard sets releaseGroupId to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.releaseGroupId, null);
});

test('normalizeLibraryReleaseForCard maps releaseTitle to title', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'OK Computer' });
  assert.equal(result.title, 'OK Computer');
});

test('normalizeLibraryReleaseForCard maps artistName to artistCredit', () => {
  const result = normalizeLibraryReleaseForCard({ artistName: 'Radiohead' });
  assert.equal(result.artistCredit, 'Radiohead');
});

test('normalizeLibraryReleaseForCard maps releaseDisambiguation to disambiguation', () => {
  const result = normalizeLibraryReleaseForCard({ releaseDisambiguation: 'Remaster' });
  assert.equal(result.disambiguation, 'Remaster');
});

test('normalizeLibraryReleaseForCard maps releaseDate to date', () => {
  const result = normalizeLibraryReleaseForCard({ releaseDate: '1997-05-21' });
  assert.equal(result.date, '1997-05-21');
});

test('normalizeLibraryReleaseForCard maps releaseGroupType to releaseGroup.primaryType', () => {
  const result = normalizeLibraryReleaseForCard({ releaseGroupType: 'Album' });
  assert.deepEqual(result.releaseGroup, { primaryType: 'Album' });
});

test('normalizeLibraryReleaseForCard sets releaseGroup.primaryType to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.deepEqual(result.releaseGroup, { primaryType: null });
});

test('normalizeLibraryReleaseForCard forwards reconciliationStatus', () => {
  assert.equal(normalizeLibraryReleaseForCard({ reconciliationStatus: 'complete' }).reconciliationStatus, 'complete');
  assert.equal(normalizeLibraryReleaseForCard({ reconciliationStatus: 'partial' }).reconciliationStatus, 'partial');
  assert.equal(normalizeLibraryReleaseForCard({ reconciliationStatus: 'duplicate' }).reconciliationStatus, 'duplicate');
});

test('normalizeLibraryReleaseForCard forwards all track counts', () => {
  const result = normalizeLibraryReleaseForCard({
    expectedTrackCount: 12,
    matchedTrackCount: 10,
    missingTrackCount: 2,
    matchedFileCount: 11,
    duplicateTrackCount: 1,
  });
  assert.equal(result.expectedTrackCount, 12);
  assert.equal(result.matchedTrackCount, 10);
  assert.equal(result.missingTrackCount, 2);
  assert.equal(result.matchedFileCount, 11);
  assert.equal(result.duplicateTrackCount, 1);
});

test('normalizeLibraryReleaseForCard defaults track counts to 0 when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.expectedTrackCount, 0);
  assert.equal(result.matchedTrackCount, 0);
  assert.equal(result.missingTrackCount, 0);
  assert.equal(result.matchedFileCount, 0);
  assert.equal(result.duplicateTrackCount, 0);
});

test('normalizeLibraryReleaseForCard forwards metadataArtistId', () => {
  const result = normalizeLibraryReleaseForCard({ metadataArtistId: 'local-artist-uuid' });
  assert.equal(result.metadataArtistId, 'local-artist-uuid');
});

test('normalizeLibraryReleaseForCard sets metadataArtistId to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.metadataArtistId, null);
});

test('normalizeLibraryReleaseForCard does not mutate the input object', () => {
  const input = Object.freeze({ id: 'some-reconciliation-id', releaseTitle: 'Album', musicbrainzReleaseId: 'mbid' });
  normalizeLibraryReleaseForCard(input);
  assert.equal(input.id, 'some-reconciliation-id');
});

test('normalizeLibraryReleaseForCard maps a full realistic library release', () => {
  const input = {
    id: 'reconciliation-uuid-1',
    artistName: 'Radiohead',
    artistSortName: 'Radiohead',
    duplicateTrackCount: 0,
    expectedTrackCount: 12,
    lastReconciledAt: '2026-04-30T10:00:00.000Z',
    matchedFileCount: 12,
    matchedTrackCount: 12,
    metadataArtistId: 'local-artist-1',
    metadataReleaseGroupId: 'local-rg-1',
    metadataReleaseId: 'local-release-1',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'rg-mbid-ok-computer',
    musicbrainzReleaseId: 'rel-mbid-ok-computer',
    reconciliationStatus: 'complete',
    releaseCountry: 'GB',
    releaseDate: '1997-05-21',
    releaseDisambiguation: null,
    releaseGroupTitle: 'OK Computer',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'OK Computer',
  };

  const result = normalizeLibraryReleaseForCard(input);

  assert.equal(result.id, null);
  assert.equal(result.musicbrainzReleaseId, 'rel-mbid-ok-computer');
  assert.equal(result.releaseGroupId, 'rg-mbid-ok-computer');
  assert.equal(result.title, 'OK Computer');
  assert.equal(result.artistCredit, 'Radiohead');
  assert.equal(result.date, '1997-05-21');
  assert.deepEqual(result.releaseGroup, { primaryType: 'Album' });
  assert.equal(result.reconciliationStatus, 'complete');
  assert.equal(result.expectedTrackCount, 12);
  assert.equal(result.matchedTrackCount, 12);
  assert.equal(result.missingTrackCount, 0);
  assert.equal(result.metadataArtistId, 'local-artist-1');
});

// ── getReconciliationStatusLabel ──────────────────────────────────────────────

test('getReconciliationStatusLabel returns "In Library" for complete', () => {
  assert.equal(getReconciliationStatusLabel('complete'), 'In Library');
});

test('getReconciliationStatusLabel returns "Partial" for partial', () => {
  assert.equal(getReconciliationStatusLabel('partial'), 'Partial');
});

test('getReconciliationStatusLabel returns "Duplicate" for duplicate', () => {
  assert.equal(getReconciliationStatusLabel('duplicate'), 'Duplicate');
});

test('getReconciliationStatusLabel returns the raw status for unknown values', () => {
  assert.equal(getReconciliationStatusLabel('custom'), 'custom');
});

test('getReconciliationStatusLabel returns "Unknown" for null', () => {
  assert.equal(getReconciliationStatusLabel(null), 'Unknown');
});

test('getReconciliationStatusLabel returns "Unknown" for undefined', () => {
  assert.equal(getReconciliationStatusLabel(undefined), 'Unknown');
});

// ── getReconciliationStatusTone ───────────────────────────────────────────────

test('getReconciliationStatusTone returns "success" for complete', () => {
  assert.equal(getReconciliationStatusTone('complete'), 'success');
});

test('getReconciliationStatusTone returns "warning" for partial', () => {
  assert.equal(getReconciliationStatusTone('partial'), 'warning');
});

test('getReconciliationStatusTone returns "info" for duplicate', () => {
  assert.equal(getReconciliationStatusTone('duplicate'), 'info');
});

test('getReconciliationStatusTone returns "info" for unknown value', () => {
  assert.equal(getReconciliationStatusTone('unknown'), 'info');
});

test('getReconciliationStatusTone returns "info" for null', () => {
  assert.equal(getReconciliationStatusTone(null), 'info');
});

// ── formatLibraryTrackCounts ──────────────────────────────────────────────────

test('formatLibraryTrackCounts returns null for null input', () => {
  assert.equal(formatLibraryTrackCounts(null), null);
});

test('formatLibraryTrackCounts returns null when expectedTrackCount is 0', () => {
  assert.equal(formatLibraryTrackCounts({ expectedTrackCount: 0, matchedTrackCount: 0 }), null);
});

test('formatLibraryTrackCounts returns null when expectedTrackCount is absent', () => {
  assert.equal(formatLibraryTrackCounts({ matchedTrackCount: 5 }), null);
});

test('formatLibraryTrackCounts returns "N tracks" when fully matched', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 10, matchedTrackCount: 10 });
  assert.equal(result, '10 tracks');
});

test('formatLibraryTrackCounts returns "N tracks" when matched exceeds expected', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 10, matchedTrackCount: 12 });
  assert.equal(result, '10 tracks');
});

test('formatLibraryTrackCounts returns "M / N tracks" for partial match', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 12, matchedTrackCount: 8 });
  assert.equal(result, '8 / 12 tracks');
});

test('formatLibraryTrackCounts returns "0 / N tracks" for fully unmatched', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 5, matchedTrackCount: 0 });
  assert.equal(result, '0 / 5 tracks');
});

test('formatLibraryTrackCounts handles single track correctly', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 1 });
  assert.equal(result, '1 tracks');
});

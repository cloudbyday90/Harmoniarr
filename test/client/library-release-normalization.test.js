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
  buildLibraryDuplicateReviewLocation,
  buildLibraryNeedsAttention,
  buildLibraryPageSubtitle,
  buildLibraryReleasesCardSubtitle,
  buildLibraryStatCards,
  formatLibraryDuplicateFileCount,
  formatLibraryTrackCounts,
  formatRemainingTrackRequestLabel,
  getLibraryDuplicateFileCount,
  getReconciliationStatusLabel,
  getReconciliationStatusTone,
  getRemainingLibraryTrackCount,
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
    duplicateFileCount: 2,
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
  assert.equal(result.duplicateFileCount, 2);
});

test('normalizeLibraryReleaseForCard forwards operator visibility state', () => {
  const result = normalizeLibraryReleaseForCard({
    operatorVisibility: {
      reason: 'Wrong edition',
      removedAt: '2026-06-30T10:00:00.000Z',
      state: 'removed',
    },
  });

  assert.deepEqual(result.operatorVisibility, {
    reason: 'Wrong edition',
    removedAt: '2026-06-30T10:00:00.000Z',
    state: 'removed',
  });
});

test('normalizeLibraryReleaseForCard defaults operator visibility to visible', () => {
  assert.deepEqual(normalizeLibraryReleaseForCard({ releaseTitle: 'Album' }).operatorVisibility, {
    state: 'visible',
  });
});

test('normalizeLibraryReleaseForCard defaults track counts to 0 when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.expectedTrackCount, 0);
  assert.equal(result.matchedTrackCount, 0);
  assert.equal(result.missingTrackCount, 0);
  assert.equal(result.matchedFileCount, 0);
  assert.equal(result.duplicateTrackCount, 0);
  assert.equal(result.duplicateFileCount, 0);
});

test('normalizeLibraryReleaseForCard forwards metadataArtistId', () => {
  const result = normalizeLibraryReleaseForCard({ metadataArtistId: 'local-artist-uuid' });
  assert.equal(result.metadataArtistId, 'local-artist-uuid');
});

test('normalizeLibraryReleaseForCard sets metadataArtistId to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.metadataArtistId, null);
});

test('normalizeLibraryReleaseForCard forwards local metadata release identifiers', () => {
  const result = normalizeLibraryReleaseForCard({
    metadataReleaseGroupId: 'local-rg-uuid',
    metadataReleaseId: 'local-release-uuid',
  });

  assert.equal(result.metadataReleaseGroupId, 'local-rg-uuid');
  assert.equal(result.metadataReleaseId, 'local-release-uuid');
});

test('normalizeLibraryReleaseForCard sets local metadata release identifiers to null when absent', () => {
  const result = normalizeLibraryReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.metadataReleaseGroupId, null);
  assert.equal(result.metadataReleaseId, null);
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
  assert.equal(result.metadataReleaseGroupId, 'local-rg-1');
  assert.equal(result.metadataReleaseId, 'local-release-1');
});

// ── Needs Attention helpers ──────────────────────────────────────────────────

test('getRemainingLibraryTrackCount prefers explicit missingTrackCount', () => {
  assert.equal(getRemainingLibraryTrackCount({
    expectedTrackCount: 12,
    matchedTrackCount: 8,
    missingTrackCount: 3,
  }), 3);
});

test('getRemainingLibraryTrackCount derives remaining count from expected and matched counts', () => {
  assert.equal(getRemainingLibraryTrackCount({
    expectedTrackCount: 12,
    matchedTrackCount: 8,
    missingTrackCount: 0,
  }), 4);
});

test('getRemainingLibraryTrackCount never returns a negative number', () => {
  assert.equal(getRemainingLibraryTrackCount({
    expectedTrackCount: 8,
    matchedTrackCount: 12,
  }), 0);
});

test('formatRemainingTrackRequestLabel pluralizes remaining tracks', () => {
  assert.equal(formatRemainingTrackRequestLabel({ missingTrackCount: 1 }), 'Request remaining 1 track');
  assert.equal(formatRemainingTrackRequestLabel({ missingTrackCount: 3 }), 'Request remaining 3 tracks');
});

test('getLibraryDuplicateFileCount prefers duplicateFileCount over duplicateTrackCount', () => {
  assert.equal(getLibraryDuplicateFileCount({
    duplicateFileCount: 5,
    duplicateTrackCount: 2,
  }), 5);
});

test('formatLibraryDuplicateFileCount pluralizes duplicate file counts', () => {
  assert.equal(formatLibraryDuplicateFileCount({ duplicateFileCount: 1 }), '1 duplicate file');
  assert.equal(formatLibraryDuplicateFileCount({ duplicateFileCount: 2 }), '2 duplicate files');
});

test('buildLibraryNeedsAttention separates partial and duplicate releases', () => {
  const releases = [
    { id: 'complete', reconciliationStatus: 'complete', expectedTrackCount: 10, matchedTrackCount: 10 },
    { id: 'partial', reconciliationStatus: 'partial', expectedTrackCount: 10, matchedTrackCount: 8 },
    { id: 'duplicate', reconciliationStatus: 'duplicate', duplicateFileCount: 2 },
  ];

  const result = buildLibraryNeedsAttention(releases);

  assert.deepEqual(result.partialReleases.map((release) => release.id), ['partial']);
  assert.deepEqual(result.duplicateReleases.map((release) => release.id), ['duplicate']);
  assert.equal(result.partialOverflowCount, 0);
  assert.equal(result.hasAttention, true);
});

test('buildLibraryNeedsAttention limits partial releases and reports overflow', () => {
  const releases = Array.from({ length: 7 }, (_, index) => ({
    id: `partial-${index + 1}`,
    reconciliationStatus: 'partial',
    expectedTrackCount: 10,
    matchedTrackCount: 8,
  }));

  const result = buildLibraryNeedsAttention(releases, { partialLimit: 5 });

  assert.deepEqual(result.partialReleases.map((release) => release.id), [
    'partial-1',
    'partial-2',
    'partial-3',
    'partial-4',
    'partial-5',
  ]);
  assert.equal(result.partialOverflowCount, 2);
});

test('buildLibraryNeedsAttention omits partial releases with no remaining tracks and duplicates with zero duplicates', () => {
  const result = buildLibraryNeedsAttention([
    { id: 'partial-complete', reconciliationStatus: 'partial', expectedTrackCount: 10, matchedTrackCount: 10 },
    { id: 'duplicate-empty', reconciliationStatus: 'duplicate', duplicateFileCount: 0 },
  ]);

  assert.deepEqual(result.partialReleases, []);
  assert.deepEqual(result.duplicateReleases, []);
  assert.equal(result.hasAttention, false);
});

test('buildLibraryDuplicateReviewLocation deep-links to the Library Browser release-group state', () => {
  assert.deepEqual(
    buildLibraryDuplicateReviewLocation({ metadataReleaseGroupId: ' local-rg-1 ' }),
    {
      name: 'settings-library-browser',
      query: { releaseGroupId: 'local-rg-1' },
    },
  );
});

test('buildLibraryDuplicateReviewLocation returns null when local release-group id is absent', () => {
  assert.equal(buildLibraryDuplicateReviewLocation({ releaseGroupId: 'musicbrainz-rg-mbid' }), null);
  assert.equal(buildLibraryDuplicateReviewLocation(null), null);
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

// ── buildLibraryPageSubtitle ──────────────────────────────────────────────────────────────

test('buildLibraryPageSubtitle returns a non-empty string', () => {
  const result = buildLibraryPageSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildLibraryPageSubtitle does not contain the word reconcil', () => {
  const result = buildLibraryPageSubtitle();
  assert.ok(!result.toLowerCase().includes('reconcil'), 'subtitle must not expose implementation term "reconcil"');
});

test('buildLibraryPageSubtitle is deterministic across calls', () => {
  assert.equal(buildLibraryPageSubtitle(), buildLibraryPageSubtitle());
});

// ── buildLibraryStatCards ────────────────────────────────────────────────────────────────────

test('buildLibraryStatCards returns exactly 4 cards', () => {
  const cards = buildLibraryStatCards(10, 7, 2, 1);
  assert.equal(cards.length, 4);
});

test('buildLibraryStatCards first card is Total releases with total value', () => {
  const cards = buildLibraryStatCards(10, 7, 2, 1);
  assert.equal(cards[0].label, 'Total releases');
  assert.equal(cards[0].value, 10);
});

test('buildLibraryStatCards second card is In Library with complete count', () => {
  const cards = buildLibraryStatCards(10, 7, 2, 1);
  assert.equal(cards[1].label, 'In Library');
  assert.equal(cards[1].value, 7);
});

test('buildLibraryStatCards third card is Partial with partial count', () => {
  const cards = buildLibraryStatCards(10, 7, 2, 1);
  assert.equal(cards[2].label, 'Partial');
  assert.equal(cards[2].value, 2);
});

test('buildLibraryStatCards fourth card is Duplicate with duplicate count', () => {
  const cards = buildLibraryStatCards(10, 7, 2, 1);
  assert.equal(cards[3].label, 'Duplicate');
  assert.equal(cards[3].value, 1);
});

test('buildLibraryStatCards each card has label, value, and meta fields', () => {
  const cards = buildLibraryStatCards(5, 3, 1, 1);
  for (const card of cards) {
    assert.ok('label' in card, 'card must have a label');
    assert.ok('value' in card, 'card must have a value');
    assert.ok('meta' in card, 'card must have a meta');
    assert.ok(typeof card.label === 'string' && card.label.length > 0, 'label must be a non-empty string');
    assert.ok(typeof card.meta === 'string' && card.meta.length > 0, 'meta must be a non-empty string');
  }
});

test('buildLibraryStatCards Total releases meta does not say "reconcil"', () => {
  const cards = buildLibraryStatCards(5, 3, 1, 1);
  assert.ok(!cards[0].meta.toLowerCase().includes('reconcil'));
});

test('buildLibraryStatCards result and each card are frozen', () => {
  const cards = buildLibraryStatCards(5, 3, 1, 1);
  assert.ok(Object.isFrozen(cards), 'result array must be frozen');
  for (const card of cards) {
    assert.ok(Object.isFrozen(card), `card "${card.label}" must be frozen`);
  }
});

test('buildLibraryStatCards reflects passed values faithfully', () => {
  const cards = buildLibraryStatCards(0, 0, 0, 0);
  assert.equal(cards[0].value, 0);
  assert.equal(cards[1].value, 0);
  assert.equal(cards[2].value, 0);
  assert.equal(cards[3].value, 0);
});

// ── buildLibraryReleasesCardSubtitle ───────────────────────────────────────────────────

test('buildLibraryReleasesCardSubtitle returns null for 0', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(0), null);
});

test('buildLibraryReleasesCardSubtitle returns null for negative', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(-1), null);
});

test('buildLibraryReleasesCardSubtitle returns null for null', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(null), null);
});

test('buildLibraryReleasesCardSubtitle returns null for undefined', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(undefined), null);
});

test('buildLibraryReleasesCardSubtitle returns "1 release" for 1', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(1), '1 release');
});

test('buildLibraryReleasesCardSubtitle returns "N releases" for N > 1', () => {
  assert.equal(buildLibraryReleasesCardSubtitle(2), '2 releases');
  assert.equal(buildLibraryReleasesCardSubtitle(100), '100 releases');
});

test('buildLibraryReleasesCardSubtitle does not pluralise 1 as "1 releases"', () => {
  assert.notEqual(buildLibraryReleasesCardSubtitle(1), '1 releases');
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

test('formatLibraryTrackCounts returns "M of N tracks" for partial match', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 12, matchedTrackCount: 8 });
  assert.equal(result, '8 of 12 tracks');
});

test('formatLibraryTrackCounts returns "0 of N tracks" for fully unmatched', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 5, matchedTrackCount: 0 });
  assert.equal(result, '0 of 5 tracks');
});

test('formatLibraryTrackCounts returns "1 track" for a single fully-matched track', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 1 });
  assert.equal(result, '1 track');
});

test('formatLibraryTrackCounts regression: 1 track is not pluralised as "1 tracks"', () => {
  const result = formatLibraryTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 1 });
  assert.notEqual(result, '1 tracks', 'singular track count must not use plural form');
});

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
  buildDiscoveryDispatchResult,
  buildDownloadRecoveryNotice,
  buildImportExecutionReadinessGuidance,
  buildImportReviewWorkflowResult,
  buildMissingPageSubtitle,
  buildMissingStatCards,
  buildWantedReleasesCardSubtitle,
  formatLastReconciledAt,
  formatMissingSummaryStatus,
  formatWantedTrackCounts,
  getMissingSummaryTone,
  getWantedStatusLabel,
  getWantedStatusTone,
  normalizeWantedReleaseForCard,
  shouldShowMissingSummaryPill,
  sortWantedReleases,
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

test('normalizeWantedReleaseForCard preserves manual-selection state needed by Missing Music actions', () => {
  const result = normalizeWantedReleaseForCard({
    evidence: { selectionSource: 'manual', selectionState: 'selected' },
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
  });

  assert.equal(result.metadataReleaseGroupId, 'release-group-1');
  assert.equal(result.metadataReleaseId, 'release-1');
  assert.equal(result.selectionSource, 'manual');
  assert.equal(result.selectionState, 'selected');
});

test('normalizeWantedReleaseForCard preserves the durable wanted-release identity for Music Queue navigation', () => {
  const result = normalizeWantedReleaseForCard({ id: 'wanted-amber' });

  assert.equal(result.id, null);
  assert.equal(result.wantedReleaseId, 'wanted-amber');
});

test('normalizeWantedReleaseForCard forwards metadataReleaseId for recovery actions', () => {
  const result = normalizeWantedReleaseForCard({ metadataReleaseId: 'local-release-uuid' });
  assert.equal(result.metadataReleaseId, 'local-release-uuid');
});

test('normalizeWantedReleaseForCard sets metadataArtistId to null when absent', () => {
  const result = normalizeWantedReleaseForCard({ releaseTitle: 'Album' });
  assert.equal(result.metadataArtistId, null);
});

test('normalizeWantedReleaseForCard forwards discoveryRequest for operator evidence', () => {
  const discoveryRequest = {
    blockedReason: 'download_recovery_exhausted',
    requestStatus: 'blocked',
  };
  const result = normalizeWantedReleaseForCard({ discoveryRequest, releaseTitle: 'Album' });
  assert.deepEqual(result.discoveryRequest, discoveryRequest);
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
  assert.equal(result.metadataReleaseId, 'local-release-1');
});

// ── getWantedStatusLabel ───────────────────────────────────────────────────────

test('getWantedStatusLabel returns a descriptive library state for missing status', () => {
  assert.equal(getWantedStatusLabel('missing'), 'Not in library');
});

test('getWantedStatusLabel returns a descriptive library state for partial status', () => {
  assert.equal(getWantedStatusLabel('partial'), 'Some tracks missing');
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

// ── sortWantedReleases ──────────────────────────────────────────────────────────────────

const sampleReleases = [
  { artistSortName: 'Radiohead', artistName: 'Radiohead', releaseGroupTitle: 'Kid A', releaseDate: '2000-10-02', wantedStatus: 'missing' },
  { artistSortName: 'Boards of Canada', artistName: 'Boards of Canada', releaseGroupTitle: 'Music Has the Right to Children', releaseDate: '1998-04-20', wantedStatus: 'partial' },
  { artistSortName: 'Aphex Twin', artistName: 'Aphex Twin', releaseGroupTitle: 'Selected Ambient Works 85-92', releaseDate: '1992-11-09', wantedStatus: 'missing' },
];

test('sortWantedReleases sorts by artist ascending', () => {
  const result = sortWantedReleases(sampleReleases, 'artist', 'asc');
  assert.equal(result[0].artistSortName, 'Aphex Twin');
  assert.equal(result[1].artistSortName, 'Boards of Canada');
  assert.equal(result[2].artistSortName, 'Radiohead');
});

test('sortWantedReleases sorts by artist descending', () => {
  const result = sortWantedReleases(sampleReleases, 'artist', 'desc');
  assert.equal(result[0].artistSortName, 'Radiohead');
  assert.equal(result[2].artistSortName, 'Aphex Twin');
});

test('sortWantedReleases sorts by title ascending', () => {
  const result = sortWantedReleases(sampleReleases, 'title', 'asc');
  assert.equal(result[0].releaseGroupTitle, 'Kid A');
  assert.equal(result[1].releaseGroupTitle, 'Music Has the Right to Children');
  assert.equal(result[2].releaseGroupTitle, 'Selected Ambient Works 85-92');
});

test('sortWantedReleases sorts by date ascending', () => {
  const result = sortWantedReleases(sampleReleases, 'date', 'asc');
  assert.equal(result[0].releaseDate, '1992-11-09');
  assert.equal(result[1].releaseDate, '1998-04-20');
  assert.equal(result[2].releaseDate, '2000-10-02');
});

test('sortWantedReleases sorts by date descending', () => {
  const result = sortWantedReleases(sampleReleases, 'date', 'desc');
  assert.equal(result[0].releaseDate, '2000-10-02');
});

test('sortWantedReleases returns empty array for empty input', () => {
  assert.deepEqual(sortWantedReleases([], 'artist', 'asc'), []);
});

test('sortWantedReleases returns same ref for empty array', () => {
  const empty = [];
  assert.equal(sortWantedReleases(empty, 'artist', 'asc'), empty);
});

test('sortWantedReleases returns empty array for non-array input', () => {
  assert.deepEqual(sortWantedReleases(null, 'artist', 'asc'), []);
});

test('sortWantedReleases does not mutate the original array', () => {
  const original = [...sampleReleases];
  sortWantedReleases(sampleReleases, 'artist', 'asc');
  assert.deepEqual(sampleReleases, original);
});

test('sortWantedReleases falls back to artistName when artistSortName is absent', () => {
  const releases = [
    { artistName: 'Zombie Nation' },
    { artistName: 'Autechre' },
  ];
  const result = sortWantedReleases(releases, 'artist', 'asc');
  assert.equal(result[0].artistName, 'Autechre');
});

// ── buildMissingPageSubtitle ───────────────────────────────────────────────────────────

test('buildMissingPageSubtitle returns a non-empty string', () => {
  const result = buildMissingPageSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildMissingPageSubtitle does not contain the word reconcil', () => {
  const result = buildMissingPageSubtitle();
  assert.ok(!result.toLowerCase().includes('reconcil'), 'subtitle must not expose internal term "reconcil"');
});

test('buildMissingPageSubtitle is deterministic across calls', () => {
  assert.equal(buildMissingPageSubtitle(), buildMissingPageSubtitle());
});

// ── buildMissingStatCards ───────────────────────────────────────────────────────────────────

test('buildMissingStatCards returns exactly 4 cards', () => {
  assert.equal(buildMissingStatCards(2, 5, 3, 2).length, 4);
});

test('buildMissingStatCards first card is Monitored artists with given count', () => {
  const cards = buildMissingStatCards(2, 5, 3, 2);
  assert.equal(cards[0].label, 'Monitored artists');
  assert.equal(cards[0].value, 2);
});

test('buildMissingStatCards second card is Selected releases with totalWanted', () => {
  const cards = buildMissingStatCards(2, 5, 3, 2);
  assert.equal(cards[1].label, 'Selected releases');
  assert.equal(cards[1].value, 5);
});

test('buildMissingStatCards third card is Not in library with missingCount', () => {
  const cards = buildMissingStatCards(2, 5, 3, 2);
  assert.equal(cards[2].label, 'Not in library');
  assert.equal(cards[2].value, 3);
});

test('buildMissingStatCards fourth card is Some tracks missing with partialCount', () => {
  const cards = buildMissingStatCards(2, 5, 3, 2);
  assert.equal(cards[3].label, 'Some tracks missing');
  assert.equal(cards[3].value, 2);
});

test('buildMissingStatCards each card has label, value, and meta fields', () => {
  const cards = buildMissingStatCards(0, 0, 0, 0);
  for (const card of cards) {
    assert.ok('label' in card);
    assert.ok('value' in card);
    assert.ok('meta' in card);
    assert.ok(typeof card.label === 'string' && card.label.length > 0);
  }
});

test('buildMissingStatCards result and each card are frozen', () => {
  const cards = buildMissingStatCards(1, 1, 1, 0);
  assert.ok(Object.isFrozen(cards));
  for (const card of cards) {
    assert.ok(Object.isFrozen(card), `card "${card.label}" must be frozen`);
  }
});

test('buildMissingStatCards reflects zero values faithfully', () => {
  const cards = buildMissingStatCards(0, 0, 0, 0);
  assert.equal(cards[0].value, 0);
  assert.equal(cards[1].value, 0);
  assert.equal(cards[2].value, 0);
  assert.equal(cards[3].value, 0);
});

// ── buildWantedReleasesCardSubtitle ──────────────────────────────────────────────────

test('buildWantedReleasesCardSubtitle returns null for 0', () => {
  assert.equal(buildWantedReleasesCardSubtitle(0), null);
});

test('buildWantedReleasesCardSubtitle returns null for negative', () => {
  assert.equal(buildWantedReleasesCardSubtitle(-3), null);
});

test('buildWantedReleasesCardSubtitle returns null for null', () => {
  assert.equal(buildWantedReleasesCardSubtitle(null), null);
});

test('buildWantedReleasesCardSubtitle returns null for undefined', () => {
  assert.equal(buildWantedReleasesCardSubtitle(undefined), null);
});

test('buildWantedReleasesCardSubtitle returns a singular selection state for 1', () => {
  assert.equal(buildWantedReleasesCardSubtitle(1), '1 selected release is not yet fully in your library');
});

test('buildWantedReleasesCardSubtitle returns a plural selection state for N > 1', () => {
  assert.equal(buildWantedReleasesCardSubtitle(7), '7 selected releases are not yet fully in your library');
});

test('buildWantedReleasesCardSubtitle does not pluralise 1 as "1 releases"', () => {
  assert.ok(!buildWantedReleasesCardSubtitle(1)?.includes('releases'));
});

// ── getMissingSummaryTone ──────────────────────────────────────────────────────────────────

test('getMissingSummaryTone returns "success" for complete', () => {
  assert.equal(getMissingSummaryTone('complete'), 'success');
});

test('getMissingSummaryTone returns "success" for healthy', () => {
  assert.equal(getMissingSummaryTone('healthy'), 'success');
});

test('getMissingSummaryTone returns "danger" for unavailable', () => {
  assert.equal(getMissingSummaryTone('unavailable'), 'danger');
});

test('getMissingSummaryTone returns "danger" for failed', () => {
  assert.equal(getMissingSummaryTone('failed'), 'danger');
});

test('getMissingSummaryTone returns "warning" for partial', () => {
  assert.equal(getMissingSummaryTone('partial'), 'warning');
});

test('getMissingSummaryTone returns "warning" for unknown status', () => {
  assert.equal(getMissingSummaryTone('some-other-status'), 'warning');
});

test('getMissingSummaryTone returns "warning" for null', () => {
  assert.equal(getMissingSummaryTone(null), 'warning');
});

// ── shouldShowMissingSummaryPill ───────────────────────────────────────────────────────

test('shouldShowMissingSummaryPill returns true for complete', () => {
  assert.equal(shouldShowMissingSummaryPill('complete'), true);
});

test('shouldShowMissingSummaryPill returns true for failed', () => {
  assert.equal(shouldShowMissingSummaryPill('failed'), true);
});

test('shouldShowMissingSummaryPill returns false for empty', () => {
  assert.equal(shouldShowMissingSummaryPill('empty'), false);
});

test('shouldShowMissingSummaryPill returns false for null', () => {
  assert.equal(shouldShowMissingSummaryPill(null), false);
});

test('shouldShowMissingSummaryPill returns false for undefined', () => {
  assert.equal(shouldShowMissingSummaryPill(undefined), false);
});

// ── formatMissingSummaryStatus ─────────────────────────────────────────────────────────

test('formatMissingSummaryStatus returns "Complete" for complete', () => {
  assert.equal(formatMissingSummaryStatus('complete'), 'Complete');
});

test('formatMissingSummaryStatus returns "Healthy" for healthy', () => {
  assert.equal(formatMissingSummaryStatus('healthy'), 'Healthy');
});

test('formatMissingSummaryStatus returns "Partial" for partial', () => {
  assert.equal(formatMissingSummaryStatus('partial'), 'Partial');
});

test('formatMissingSummaryStatus returns "Unavailable" for unavailable', () => {
  assert.equal(formatMissingSummaryStatus('unavailable'), 'Unavailable');
});

test('formatMissingSummaryStatus returns "Failed" for failed', () => {
  assert.equal(formatMissingSummaryStatus('failed'), 'Failed');
});

test('formatMissingSummaryStatus capitalises first letter of unknown values', () => {
  assert.equal(formatMissingSummaryStatus('scanning'), 'Scanning');
});

test('formatMissingSummaryStatus returns empty string for null', () => {
  assert.equal(formatMissingSummaryStatus(null), '');
});

test('formatMissingSummaryStatus returns empty string for undefined', () => {
  assert.equal(formatMissingSummaryStatus(undefined), '');
});

// ── formatLastReconciledAt ───────────────────────────────────────────────────────────────

test('formatLastReconciledAt returns "Never updated" for null', () => {
  assert.equal(formatLastReconciledAt(null), 'Never updated');
});

test('formatLastReconciledAt returns "Never updated" for undefined', () => {
  assert.equal(formatLastReconciledAt(undefined), 'Never updated');
});

test('formatLastReconciledAt returns "Never updated" for empty string', () => {
  assert.equal(formatLastReconciledAt(''), 'Never updated');
});

test('formatLastReconciledAt returns a string starting with "Last updated" for a valid ISO 8601 datetime', () => {
  const result = formatLastReconciledAt('2026-05-12T10:30:00.000Z');
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.ok(result.startsWith('Last updated '), `expected result to start with "Last updated ", got: ${result}`);
});

test('formatLastReconciledAt does not return a raw ISO 8601 string for a valid datetime', () => {
  const iso = '2026-05-12T10:30:00.000Z';
  const result = formatLastReconciledAt(iso);
  assert.notEqual(result, iso, 'raw ISO string must be formatted for display');
});

test('formatLastReconciledAt returns the raw value for an unparseable string', () => {
  assert.equal(formatLastReconciledAt('not-a-date'), 'not-a-date');
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

test('formatWantedTrackCounts returns "0 of N tracks" for fully missing release', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 10, matchedTrackCount: 0 });
  assert.equal(result, '0 of 10 tracks');
});

test('formatWantedTrackCounts returns "M of N tracks" for partial release', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 12, matchedTrackCount: 8 });
  assert.equal(result, '8 of 12 tracks');
});

test('formatWantedTrackCounts returns "0 of 1 track" for a single missing release', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 0 });
  assert.equal(result, '0 of 1 track');
});

test('formatWantedTrackCounts regression: single track is not pluralised as "0 / 1 tracks"', () => {
  const result = formatWantedTrackCounts({ expectedTrackCount: 1, matchedTrackCount: 0 });
  assert.notEqual(result, '0 / 1 tracks', 'single-track count must not use old slash format or plural form');
});

// ── buildDownloadRecoveryNotice ──────────────────────────────────────────────

test('buildDownloadRecoveryNotice returns null without a discovery request', () => {
  assert.equal(buildDownloadRecoveryNotice({ releaseTitle: 'Kid A' }), null);
});

test('buildDownloadRecoveryNotice returns null for non-exhausted discovery requests', () => {
  const notice = buildDownloadRecoveryNotice({
    discoveryRequest: {
      blockedReason: 'automatic_cooldown',
      requestStatus: 'cooldown',
    },
  });

  assert.equal(notice, null);
});

test('buildDownloadRecoveryNotice summarizes exhausted recovery evidence', () => {
  const notice = buildDownloadRecoveryNotice({
    discoveryRequest: {
      blockedReason: 'download_recovery_exhausted',
      evidence: {
        downloadRecoveryExhausted: {
          maxResearchAttemptCount: 3,
          sourceOperationRunId: 'operation-run-123456789',
          sourceSearchId: 'search-123456789',
          triggeredByFailedCandidateId: 'candidate-123456789',
        },
      },
      lastSearchAt: '2026-05-31T14:30:00.000Z',
      requestStatus: 'blocked',
      researchAttemptCount: 3,
      searchAttemptCount: 2,
    },
  });

  assert.equal(notice.title, 'Search stopped');
  assert.match(notice.message, /Automatic search attempts have stopped/);
  assert.deepEqual(notice.details.slice(0, 2), [
    { label: 'Research attempts', value: '3/3' },
    { label: 'Search attempts', value: '2' },
  ]);
  assert.ok(notice.details.some((detail) => detail.label === 'Last search' && detail.value.length > 0));
  assert.ok(notice.details.some((detail) => detail.label === 'Failed candidate' && detail.value === 'candidat...'));
  assert.ok(notice.details.some((detail) => detail.label === 'Operation run' && detail.value === 'operatio...'));
  assert.ok(notice.details.some((detail) => detail.label === 'Search' && detail.value === 'search-1...'));
});

// ── buildDiscoveryDispatchResult ────────────────────────────────────────────

test('buildDiscoveryDispatchResult reports releases without discovery request as not queued', () => {
  const result = buildDiscoveryDispatchResult({ releaseTitle: 'Amber' });

  assert.equal(result.label, 'Not queued');
  assert.equal(result.tone, 'info');
  assert.match(result.message, /has not created a search request/);
});

test('buildDiscoveryDispatchResult reports successful candidate-producing search', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {
        lastSearchAttemptCount: 1,
        lastSearchId: 'search-123456789',
        lastSearchResult: {
          candidateCount: 2,
          fileCount: 17,
          sourceProvider: 'slskd',
        },
      },
      lastSearchAt: '2026-06-27T21:02:00.000Z',
      requestStatus: 'cooldown',
      searchAttemptCount: 1,
    },
  });

  assert.equal(result.label, '2 candidates');
  assert.equal(result.tone, 'success');
  assert.equal(result.message, 'Last search found matching downloads.');
  assert.ok(result.details.some((detail) => detail.label === 'Search' && detail.value === 'search-1...'));
  assert.ok(result.details.some((detail) => detail.label === 'Files' && detail.value === '17'));
});

test('buildDiscoveryDispatchResult reports zero-candidate cooldown', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {
        lastSearchResult: {
          candidateCount: 0,
          fileCount: 0,
          sourceProvider: 'slskd',
        },
      },
      requestStatus: 'cooldown',
      searchAttemptCount: 2,
    },
  });

  assert.equal(result.label, 'No candidates');
  assert.equal(result.tone, 'warning');
  assert.match(result.message, /retry after cooldown/);
});

test('buildDiscoveryDispatchResult explains zero-candidate ingestion diagnostics', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {
        lastSearchResult: {
          candidateCount: 0,
          fileCount: 0,
          ingestionDiagnostics: {
            blacklistedFileCount: 3,
            candidateCount: 0,
            fileCount: 0,
            filteredResponseCount: 0,
            ignoredUserResponseCount: 0,
            provider: 'slskd',
            reasonCodes: ['all_responses_filtered', 'blacklisted_files'],
            responseCount: 2,
            responseFileCount: 3,
          },
          sourceProvider: 'slskd',
        },
      },
      requestStatus: 'cooldown',
      searchAttemptCount: 1,
    },
  });

  assert.equal(result.label, 'No candidates');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, 'Soulseek responded, but every file matched a blocked title term.');
  assert.ok(result.details.some((detail) => detail.label === 'Responses' && detail.value === '2'));
  assert.ok(result.details.some((detail) => detail.label === 'Provider files' && detail.value === '3'));
  assert.ok(result.details.some((detail) => detail.label === 'Filtered' && detail.value === '3'));
  assert.ok(result.details.some((detail) => detail.label === 'Reason' && detail.value.includes('blacklisted_files')));
  assert.equal(JSON.stringify(result).includes('apiKey'), false);
});

test('buildDiscoveryDispatchResult reports dispatch failure without leaking provider secrets', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {
        lastDispatchFailure: {
          code: 'slskd_unavailable',
          message: 'Soulseek search endpoint timed out.',
        },
      },
      requestStatus: 'cooldown',
    },
  });

  assert.equal(result.label, 'Search failed');
  assert.equal(result.tone, 'danger');
  assert.equal(result.message, 'Soulseek search endpoint timed out.');
  assert.ok(!JSON.stringify(result).includes('apiKey'));
});

test('buildDiscoveryDispatchResult reports exhausted automatic search attempts', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {
        searchExhausted: {
          reasonCode: 'discovery_search_attempts_exhausted',
          searchAttemptCount: 3,
        },
      },
      requestStatus: 'blocked',
      searchAttemptCount: 3,
    },
  });

  assert.equal(result.label, 'No results');
  assert.equal(result.tone, 'danger');
  assert.match(result.message, /exhausted/);
  assert.ok(result.details.some((detail) => detail.label === 'Reason'));
});

test('buildDiscoveryDispatchResult reports queued ready requests', () => {
  const result = buildDiscoveryDispatchResult({
    discoveryRequest: {
      evidence: {},
      requestStatus: 'ready',
    },
  });

  assert.equal(result.label, 'Ready to search');
  assert.equal(result.tone, 'info');
});

// ── buildImportReviewWorkflowResult ─────────────────────────────────────────

test('buildImportReviewWorkflowResult returns null without candidate workflow state', () => {
  assert.equal(buildImportReviewWorkflowResult({ discoveryRequest: null }), null);
  assert.equal(buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        totalCount: 0,
      },
    },
  }), null);
});

test('buildImportReviewWorkflowResult reports selected candidates', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'selected',
        latestUpdatedAt: '2026-06-27T21:10:00.000Z',
        statusCounts: {
          pending: 1,
          selected: 2,
        },
        totalCount: 3,
      },
    },
  });

  assert.equal(result.label, 'Selected for download');
  assert.equal(result.tone, 'info');
  assert.equal(result.message, '2 candidates selected for download.');
  assert.deepEqual(result.details.slice(0, 3), [
    { label: 'Candidates', value: '3' },
    { label: 'Pending', value: '1' },
    { label: 'Selected', value: '2' },
  ]);
});

test('buildImportReviewWorkflowResult reports high-confidence candidates awaiting selection', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'pending',
        selectionReadiness: {
          bestCompositeScore: 91,
          code: 'auto_selectable',
          scoreGap: 11,
          thresholds: {
            minCompositeScore: 85,
          },
        },
        statusCounts: {
          pending: 2,
        },
        totalCount: 2,
      },
    },
  });

  assert.equal(result.label, 'Ready for selection');
  assert.equal(result.tone, 'info');
  assert.equal(result.message, 'Best score 91 meets the 85 threshold. Select it in Import Review to start download handoff.');
  assert.ok(result.details.some((detail) => detail.label === 'Best score' && detail.value === '91'));
  assert.ok(result.details.some((detail) => detail.label === 'Score gap' && detail.value === '11'));
});

test('buildImportReviewWorkflowResult reports ambiguous candidates before download handoff', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'pending',
        selectionReadiness: {
          bestCompositeScore: 88.5,
          code: 'ambiguous',
          scoreGap: 3.3,
          thresholds: {
            minCompositeScore: 85,
          },
        },
        statusCounts: {
          pending: 3,
        },
        totalCount: 3,
      },
    },
  });

  assert.equal(result.label, 'Review candidates');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, 'Multiple candidates are close in score; choose one in Import Review before download handoff.');
});

test('buildImportReviewWorkflowResult prioritizes active downloading state over stale latest status', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'pending',
        statusCounts: {
          downloading: 1,
          pending: 4,
        },
        totalCount: 5,
      },
    },
  });

  assert.equal(result.label, 'Downloading');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, '1 candidate in the download pipeline.');
});

test('buildImportReviewWorkflowResult reports candidates accepted by Downloader', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 4,
          failedFilenameCount: 0,
          itemStatusCounts: {
            queued: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'downloading',
        statusCounts: {
          downloading: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.label, 'Queued in Downloader');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, '4 Downloader transfers accepted.');
  assert.ok(result.details.some((detail) => detail.label === 'Downloader transfers' && detail.value === '4'));
});

test('buildImportReviewWorkflowResult reports download enqueue warnings', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 3,
          failedFilenameCount: 1,
          itemStatusCounts: {
            queued_with_warnings: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'downloading',
        statusCounts: {
          downloading: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.label, 'Queued with warnings');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, '3 Downloader transfers accepted with warnings.');
  assert.ok(result.details.some((detail) => detail.label === 'Queue failures' && detail.value === '1'));
});

test('buildImportReviewWorkflowResult reports candidates blocked before Downloader enqueue', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 0,
          failedFilenameCount: 0,
          itemStatusCounts: {
            blocked: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'selected',
        statusCounts: {
          selected: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.label, 'Download blocked');
  assert.equal(result.tone, 'warning');
  assert.equal(result.message, '1 candidate blocked before Downloader enqueue.');
});

test('buildImportReviewWorkflowResult reports candidates that failed before reaching Downloader', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 0,
          failedFilenameCount: 2,
          itemStatusCounts: {
            queue_failed: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'failed',
        statusCounts: {
          failed: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.label, 'Download queue failed');
  assert.equal(result.tone, 'danger');
  assert.equal(result.message, '1 candidate failed before reaching Downloader.');
});

test('buildImportReviewWorkflowResult reports failed candidates with singular grammar', () => {
  const result = buildImportReviewWorkflowResult({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'failed',
        statusCounts: {
          failed: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.label, 'Candidate failed');
  assert.equal(result.tone, 'danger');
  assert.equal(result.message, '1 candidate needs review before acquisition can continue.');
});

// ── buildImportExecutionReadinessGuidance ───────────────────────────────────

test('buildImportExecutionReadinessGuidance prompts discovery before candidates exist', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: null,
  });

  assert.equal(result.title, 'Run discovery');
  assert.equal(result.message, 'Search again before Downloader can start.');
  assert.equal(result.tone, 'info');
});

test('buildImportExecutionReadinessGuidance prompts candidate review after search results', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      evidence: {
        lastSearchResult: {
          candidateCount: 4,
        },
      },
      importReviewSummary: {
        totalCount: 0,
      },
    },
  });

  assert.equal(result.title, 'Open match diagnostics');
  assert.equal(result.message, 'Open advanced diagnostics to inspect matching options before a download can start.');
});

test('buildImportExecutionReadinessGuidance prompts selection for pending candidates', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'pending',
        statusCounts: {
          pending: 2,
        },
        totalCount: 2,
      },
    },
  });

  assert.equal(result.title, 'Review matching options');
  assert.equal(result.message, 'Open advanced diagnostics to inspect matching options when automatic selection needs help.');
});

test('buildImportExecutionReadinessGuidance prompts download run after candidate selection', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'selected',
        statusCounts: {
          selected: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.title, 'Review download diagnostics');
  assert.equal(result.message, 'A match is selected. Open advanced diagnostics only if the download does not begin automatically.');
});

test('buildImportExecutionReadinessGuidance points accepted transfers to Downloader', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 2,
          itemStatusCounts: {
            queued: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'downloading',
        statusCounts: {
          downloading: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.title, 'Watch Downloader');
  assert.equal(result.tone, 'success');
});

test('buildImportExecutionReadinessGuidance points queue failures to diagnostics', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 0,
          itemStatusCounts: {
            queue_failed: 1,
          },
          totalItemCount: 1,
        },
        latestStatus: 'selected',
        statusCounts: {
          selected: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result.title, 'Review the download diagnostic');
  assert.equal(result.tone, 'danger');
});

test('buildImportExecutionReadinessGuidance suppresses completed applied candidates', () => {
  const result = buildImportExecutionReadinessGuidance({
    discoveryRequest: {
      importReviewSummary: {
        latestStatus: 'applied',
        statusCounts: {
          applied: 1,
        },
        totalCount: 1,
      },
    },
  });

  assert.equal(result, null);
});

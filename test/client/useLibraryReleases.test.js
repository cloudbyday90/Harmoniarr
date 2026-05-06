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
import { useLibraryReleases } from '../../src/client/composables/useLibraryReleases.js';

function makeRelease(overrides = {}) {
  return {
    id: 'reconciliation-uuid-1',
    artistName: 'Radiohead',
    artistSortName: 'Radiohead',
    duplicateTrackCount: 0,
    expectedTrackCount: 12,
    lastReconciledAt: '2026-04-30T10:00:00.000Z',
    matchedFileCount: 12,
    matchedTrackCount: 12,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'rg-mbid-1',
    musicbrainzReleaseId: 'rel-mbid-1',
    reconciliationStatus: 'complete',
    releaseDate: '1997-05-21',
    releaseDisambiguation: null,
    releaseGroupTitle: 'OK Computer',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'OK Computer',
    ...overrides,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

test('useLibraryReleases has correct initial state', () => {
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 0, releases: [] }),
  });

  assert.equal(composable.isLoading.value, true);
  assert.equal(composable.errorMessage.value, '');
  assert.deepEqual(composable.releases.value, []);
  assert.equal(composable.totalCount.value, 0);
  assert.deepEqual(composable.completeReleases.value, []);
  assert.deepEqual(composable.partialReleases.value, []);
  assert.deepEqual(composable.duplicateReleases.value, []);
});

// ── Happy path ────────────────────────────────────────────────────────────────

test('useLibraryReleases loads releases and exposes them', async (t) => {
  const releases = [
    makeRelease({ reconciliationStatus: 'complete' }),
    makeRelease({ id: 'uuid-2', releaseTitle: 'Amnesiac', reconciliationStatus: 'partial', matchedTrackCount: 6 }),
  ];
  const fetchLibraryReleases = t.mock.fn(async () => ({ total: 2, releases }));

  const composable = useLibraryReleases({ fetchLibraryReleases });
  await composable.loadReleases();

  assert.equal(fetchLibraryReleases.mock.callCount(), 1);
  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, '');
  assert.equal(composable.totalCount.value, 2);
  assert.equal(composable.releases.value.length, 2);
});

test('useLibraryReleases passes reconciliationStatus filter to fetch', async (t) => {
  const fetchLibraryReleases = t.mock.fn(async () => ({ total: 0, releases: [] }));

  const composable = useLibraryReleases({ fetchLibraryReleases });
  await composable.loadReleases({ reconciliationStatus: 'complete' });

  const callArgs = fetchLibraryReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, 'complete');
});

test('useLibraryReleases passes partial reconciliationStatus filter', async (t) => {
  const fetchLibraryReleases = t.mock.fn(async () => ({ total: 0, releases: [] }));

  const composable = useLibraryReleases({ fetchLibraryReleases });
  await composable.loadReleases({ reconciliationStatus: 'partial' });

  const callArgs = fetchLibraryReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, 'partial');
});

test('useLibraryReleases passes duplicate reconciliationStatus filter', async (t) => {
  const fetchLibraryReleases = t.mock.fn(async () => ({ total: 0, releases: [] }));

  const composable = useLibraryReleases({ fetchLibraryReleases });
  await composable.loadReleases({ reconciliationStatus: 'duplicate' });

  const callArgs = fetchLibraryReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, 'duplicate');
});

test('useLibraryReleases passes null reconciliationStatus when omitted', async (t) => {
  const fetchLibraryReleases = t.mock.fn(async () => ({ total: 0, releases: [] }));

  const composable = useLibraryReleases({ fetchLibraryReleases });
  await composable.loadReleases();

  const callArgs = fetchLibraryReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, null);
});

// ── Computed derivations ──────────────────────────────────────────────────────

test('useLibraryReleases completeReleases filters to complete status', async () => {
  const releases = [
    makeRelease({ id: '1', reconciliationStatus: 'complete' }),
    makeRelease({ id: '2', reconciliationStatus: 'partial', matchedTrackCount: 4 }),
    makeRelease({ id: '3', reconciliationStatus: 'complete' }),
  ];
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 3, releases }),
  });

  await composable.loadReleases();

  assert.equal(composable.completeReleases.value.length, 2);
  assert.ok(composable.completeReleases.value.every((r) => r.reconciliationStatus === 'complete'));
});

test('useLibraryReleases partialReleases filters to partial status', async () => {
  const releases = [
    makeRelease({ id: '1', reconciliationStatus: 'complete' }),
    makeRelease({ id: '2', reconciliationStatus: 'partial', matchedTrackCount: 4 }),
  ];
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 2, releases }),
  });

  await composable.loadReleases();

  assert.equal(composable.partialReleases.value.length, 1);
  assert.equal(composable.partialReleases.value[0].reconciliationStatus, 'partial');
});

test('useLibraryReleases duplicateReleases filters to duplicate status', async () => {
  const releases = [
    makeRelease({ id: '1', reconciliationStatus: 'complete' }),
    makeRelease({ id: '2', reconciliationStatus: 'duplicate', duplicateTrackCount: 2 }),
  ];
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 2, releases }),
  });

  await composable.loadReleases();

  assert.equal(composable.duplicateReleases.value.length, 1);
  assert.equal(composable.duplicateReleases.value[0].reconciliationStatus, 'duplicate');
});

test('useLibraryReleases includes musicbrainzReleaseId in returned releases', async () => {
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({
      total: 1,
      releases: [makeRelease({ musicbrainzReleaseId: 'test-mbid' })],
    }),
  });

  await composable.loadReleases();

  assert.equal(composable.releases.value[0].musicbrainzReleaseId, 'test-mbid');
});

// ── Error handling ────────────────────────────────────────────────────────────

test('useLibraryReleases surfaces fetch errors in errorMessage', async () => {
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => {
      throw new Error('network error fetching library releases');
    },
  });

  await composable.loadReleases();

  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, 'network error fetching library releases');
  assert.deepEqual(composable.releases.value, []);
  assert.equal(composable.totalCount.value, 0);
});

test('useLibraryReleases preserves staleData on fetch error (SWR)', async () => {
  let callCount = 0;
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => {
      callCount++;
      if (callCount === 1) return { total: 1, releases: [makeRelease()] };
      throw new Error('second call failed');
    },
  });

  await composable.loadReleases();
  assert.equal(composable.releases.value.length, 1);

  await composable.loadReleases();
  // SWR: staleData preserves last-good result; data/releases also preserves it
  assert.equal(composable.staleData.value.length, 1, 'staleData should hold last-good data');
  assert.equal(composable.errorMessage.value, 'second call failed');
});

test('useLibraryReleases clears error on successful reload', async () => {
  let callCount = 0;
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => {
      callCount++;
      if (callCount === 1) throw new Error('transient error');
      return { total: 0, releases: [] };
    },
  });

  await composable.loadReleases();
  assert.equal(composable.errorMessage.value, 'transient error');

  await composable.loadReleases();
  assert.equal(composable.errorMessage.value, '');
});

// ── Empty response ────────────────────────────────────────────────────────────

test('useLibraryReleases handles empty releases array', async () => {
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 0, releases: [] }),
  });

  await composable.loadReleases();

  assert.equal(composable.totalCount.value, 0);
  assert.deepEqual(composable.releases.value, []);
  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, '');
});

test('useLibraryReleases handles missing releases field gracefully', async () => {
  const composable = useLibraryReleases({
    fetchLibraryReleases: async () => ({ total: 0 }),
  });

  await composable.loadReleases();

  assert.deepEqual(composable.releases.value, []);
});

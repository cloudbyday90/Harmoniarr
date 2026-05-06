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
import { useLibraryWantedReleases } from '../../src/client/composables/useLibraryWantedReleases.js';

function makeRelease(overrides = {}) {
  return {
    id: 'db-uuid-1',
    artistName: 'Radiohead',
    expectedTrackCount: 10,
    matchedTrackCount: 0,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 10,
    musicbrainzReleaseGroupId: 'rg-mbid-1',
    musicbrainzReleaseId: 'rel-mbid-1',
    releaseDate: '2000-10-02',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Kid A',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Kid A',
    wantedStatus: 'missing',
    ...overrides,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

test('useLibraryWantedReleases has correct initial state', () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({ total: 0, wantedReleases: [] }),
  });

  assert.equal(composable.isLoading.value, true);
  assert.equal(composable.errorMessage.value, '');
  assert.deepEqual(composable.wantedReleases.value, []);
  assert.equal(composable.totalCount.value, 0);
  assert.deepEqual(composable.missingReleases.value, []);
  assert.deepEqual(composable.partialReleases.value, []);
});

// ── Happy path ────────────────────────────────────────────────────────────────

test('useLibraryWantedReleases loads releases and exposes them', async (t) => {
  const releases = [
    makeRelease({ wantedStatus: 'missing' }),
    makeRelease({ id: 'db-uuid-2', releaseTitle: 'Amnesiac', wantedStatus: 'partial', matchedTrackCount: 6 }),
  ];
  const fetchLibraryWantedReleases = t.mock.fn(async () => ({
    total: 2,
    wantedReleases: releases,
  }));

  const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases });
  await composable.loadWantedReleases();

  assert.equal(fetchLibraryWantedReleases.mock.callCount(), 1);
  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, '');
  assert.equal(composable.totalCount.value, 2);
  assert.equal(composable.wantedReleases.value.length, 2);
});

test('useLibraryWantedReleases passes wantedStatus filter to fetch', async (t) => {
  const fetchLibraryWantedReleases = t.mock.fn(async () => ({
    total: 1,
    wantedReleases: [makeRelease({ wantedStatus: 'missing' })],
  }));

  const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases });
  await composable.loadWantedReleases({ wantedStatus: 'missing' });

  assert.equal(fetchLibraryWantedReleases.mock.callCount(), 1);
  const callArgs = fetchLibraryWantedReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.wantedStatus, 'missing');
});

test('useLibraryWantedReleases passes partial wantedStatus filter', async (t) => {
  const fetchLibraryWantedReleases = t.mock.fn(async () => ({
    total: 0,
    wantedReleases: [],
  }));

  const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases });
  await composable.loadWantedReleases({ wantedStatus: 'partial' });

  const callArgs = fetchLibraryWantedReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.wantedStatus, 'partial');
});

test('useLibraryWantedReleases passes null wantedStatus when omitted', async (t) => {
  const fetchLibraryWantedReleases = t.mock.fn(async () => ({
    total: 0,
    wantedReleases: [],
  }));

  const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases });
  await composable.loadWantedReleases();

  const callArgs = fetchLibraryWantedReleases.mock.calls[0].arguments[0];
  assert.equal(callArgs.wantedStatus, null);
});

// ── Computed derivations ──────────────────────────────────────────────────────

test('useLibraryWantedReleases missingReleases filters to missing status', async () => {
  const releases = [
    makeRelease({ id: '1', wantedStatus: 'missing' }),
    makeRelease({ id: '2', wantedStatus: 'partial', matchedTrackCount: 4 }),
    makeRelease({ id: '3', wantedStatus: 'missing' }),
  ];
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({ total: 3, wantedReleases: releases }),
  });

  await composable.loadWantedReleases();

  assert.equal(composable.missingReleases.value.length, 2);
  assert.ok(composable.missingReleases.value.every((r) => r.wantedStatus === 'missing'));
});

test('useLibraryWantedReleases partialReleases filters to partial status', async () => {
  const releases = [
    makeRelease({ id: '1', wantedStatus: 'missing' }),
    makeRelease({ id: '2', wantedStatus: 'partial', matchedTrackCount: 4 }),
  ];
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({ total: 2, wantedReleases: releases }),
  });

  await composable.loadWantedReleases();

  assert.equal(composable.partialReleases.value.length, 1);
  assert.equal(composable.partialReleases.value[0].wantedStatus, 'partial');
});

test('useLibraryWantedReleases includes musicbrainzReleaseId in returned releases', async () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({
      total: 1,
      wantedReleases: [makeRelease({ musicbrainzReleaseId: 'test-mbid' })],
    }),
  });

  await composable.loadWantedReleases();

  assert.equal(composable.wantedReleases.value[0].musicbrainzReleaseId, 'test-mbid');
});

test('useLibraryWantedReleases includes musicbrainzReleaseGroupId in returned releases', async () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({
      total: 1,
      wantedReleases: [makeRelease({ musicbrainzReleaseGroupId: 'test-rg-mbid' })],
    }),
  });

  await composable.loadWantedReleases();

  assert.equal(composable.wantedReleases.value[0].musicbrainzReleaseGroupId, 'test-rg-mbid');
});

// ── Error handling ────────────────────────────────────────────────────────────

test('useLibraryWantedReleases surfaces fetch errors in errorMessage', async () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => {
      throw new Error('network error fetching wanted releases');
    },
  });

  await composable.loadWantedReleases();

  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, 'network error fetching wanted releases');
  assert.deepEqual(composable.wantedReleases.value, []);
  assert.equal(composable.totalCount.value, 0);
});

test('useLibraryWantedReleases clears previous data on fetch error', async () => {
  let callCount = 0;
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => {
      callCount++;
      if (callCount === 1) {
        return { total: 1, wantedReleases: [makeRelease()] };
      }
      throw new Error('second call failed');
    },
  });

  await composable.loadWantedReleases();
  assert.equal(composable.wantedReleases.value.length, 1);

  await composable.loadWantedReleases();
  assert.deepEqual(composable.wantedReleases.value, []);
  assert.equal(composable.errorMessage.value, 'second call failed');
});

test('useLibraryWantedReleases clears error on successful reload', async () => {
  let callCount = 0;
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => {
      callCount++;
      if (callCount === 1) throw new Error('transient error');
      return { total: 0, wantedReleases: [] };
    },
  });

  await composable.loadWantedReleases();
  assert.equal(composable.errorMessage.value, 'transient error');

  await composable.loadWantedReleases();
  assert.equal(composable.errorMessage.value, '');
});

// ── Empty response ────────────────────────────────────────────────────────────

test('useLibraryWantedReleases handles empty wantedReleases array', async () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({ total: 0, wantedReleases: [] }),
  });

  await composable.loadWantedReleases();

  assert.equal(composable.totalCount.value, 0);
  assert.deepEqual(composable.wantedReleases.value, []);
  assert.equal(composable.isLoading.value, false);
  assert.equal(composable.errorMessage.value, '');
});

test('useLibraryWantedReleases handles missing wantedReleases field gracefully', async () => {
  const composable = useLibraryWantedReleases({
    fetchLibraryWantedReleases: async () => ({ total: 0 }),
  });

  await composable.loadWantedReleases();

  assert.deepEqual(composable.wantedReleases.value, []);
});

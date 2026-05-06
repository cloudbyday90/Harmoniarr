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
import { useArtistDetail } from '../../src/client/composables/useArtistDetail.js';

// ---------------------------------------------------------------------------
// Doubles / Helpers
// ---------------------------------------------------------------------------

function makeArtist(overrides = {}) {
  return {
    id: 'local-1',
    musicbrainzArtistId: 'mb-1',
    name: 'Radiohead',
    type: 'Group',
    country: 'GB',
    ...overrides,
  };
}

function makeMonitoring(overrides = {}) {
  return { monitored: false, ...overrides };
}

function makeReleaseGroup(overrides = {}) {
  return {
    id: 'rg-1',
    musicbrainzReleaseGroupId: 'rg-1',
    title: 'OK Computer',
    primaryType: 'Album',
    firstReleaseDate: '1997-05-21',
    artistCredit: 'Radiohead',
    ...overrides,
  };
}

function makeSimilar(overrides = {}) {
  return { id: 'sim-1', name: 'Portishead', score: 0.9, ...overrides };
}

function createLocalDouble({ artist = makeArtist(), monitoring = makeMonitoring(), throws = null } = {}) {
  return async (_mbid, _opts) => {
    if (throws) throw throws;
    return { artist, monitoring, aliases: [], releaseGroups: [], releases: [] };
  };
}

function createBrowseDouble({ results = [], throws = null } = {}) {
  return async (_opts) => {
    if (throws) throw throws;
    return { results, total: results.length, offset: 0, limit: 100 };
  };
}

function createSimilarDouble({ similar = [], throws = null } = {}) {
  return async (_mbid, _opts) => {
    if (throws) throw throws;
    return { similar };
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test('useArtistDetail isLoading is false before loadArtistDetail is called', () => {
  const { isLoading } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });
  assert.equal(isLoading.value, false);
});

test('useArtistDetail artist is null before loadArtistDetail is called', () => {
  const { artist } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });
  assert.equal(artist.value, null);
});

test('useArtistDetail releaseGroups is empty before loadArtistDetail is called', () => {
  const { releaseGroups } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });
  assert.deepEqual(releaseGroups.value, []);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — happy path
// ---------------------------------------------------------------------------

test('useArtistDetail loadArtistDetail populates artist from local resolve', async () => {
  const { artist, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ name: 'Radiohead' }) }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(artist.value?.name, 'Radiohead');
});

test('useArtistDetail loadArtistDetail sets monitoring from local resolve', async () => {
  const { monitoring, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ monitoring: makeMonitoring({ monitored: true }) }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(monitoring.value?.monitored, true);
});

test('useArtistDetail isMonitored is true when monitoring.monitored is true', async () => {
  const { isMonitored, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ monitoring: { monitored: true } }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(isMonitored.value, true);
});

test('useArtistDetail isMonitored is false when monitoring.monitored is false', async () => {
  const { isMonitored, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ monitoring: { monitored: false } }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(isMonitored.value, false);
});

test('useArtistDetail loadArtistDetail populates releaseGroups from browse', async () => {
  const rgs = [makeReleaseGroup({ id: 'rg-1' }), makeReleaseGroup({ id: 'rg-2' })];
  const { releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble({ results: rgs }),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(releaseGroups.value.length, 2);
});

test('useArtistDetail loadArtistDetail populates relatedArtists from fetchSimilar', async () => {
  const similar = [makeSimilar({ id: 'sim-1', name: 'Portishead' })];
  const { relatedArtists, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble({ similar }),
  });

  await loadArtistDetail('mb-1');

  assert.equal(relatedArtists.value.length, 1);
  assert.equal(relatedArtists.value[0].name, 'Portishead');
});

test('useArtistDetail loadArtistDetail sets isLoading false after resolution', async () => {
  const { isLoading, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(isLoading.value, false);
});

test('useArtistDetail loadArtistDetail passes the mbid to resolveLocal', async (t) => {
  const resolveLocal = t.mock.fn(createLocalDouble());
  const { loadArtistDetail } = useArtistDetail({
    resolveLocal,
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('target-mbid');

  assert.equal(resolveLocal.mock.callCount(), 1);
  assert.equal(resolveLocal.mock.calls[0].arguments[0], 'target-mbid');
});

test('useArtistDetail loadArtistDetail passes the mbid to browseReleaseGroups', async (t) => {
  const browseReleaseGroups = t.mock.fn(createBrowseDouble());
  const { loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups,
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('target-mbid');

  assert.equal(browseReleaseGroups.mock.callCount(), 1);
  assert.equal(browseReleaseGroups.mock.calls[0].arguments[0].artistId, 'target-mbid');
});

test('useArtistDetail loadArtistDetail passes the mbid to fetchSimilar', async (t) => {
  const fetchSimilar = t.mock.fn(createSimilarDouble());
  const { loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar,
  });

  await loadArtistDetail('target-mbid');

  assert.equal(fetchSimilar.mock.callCount(), 1);
  assert.equal(fetchSimilar.mock.calls[0].arguments[0], 'target-mbid');
});

test('useArtistDetail loadArtistDetail is a no-op when mbid is empty', async (t) => {
  const resolveLocal = t.mock.fn(createLocalDouble());
  const { loadArtistDetail } = useArtistDetail({
    resolveLocal,
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('');

  assert.equal(resolveLocal.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — similarLimit slicing
// ---------------------------------------------------------------------------

test('useArtistDetail respects similarLimit when slicing relatedArtists', async () => {
  const similar = Array.from({ length: 10 }, (_, i) => makeSimilar({ id: `sim-${i}`, name: `Artist ${i}` }));
  const { relatedArtists, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble({ similar }),
    similarLimit: 4,
  });

  await loadArtistDetail('mb-1');

  assert.equal(relatedArtists.value.length, 4);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — 404 on local resolve treated as "not imported yet"
// ---------------------------------------------------------------------------

test('useArtistDetail treats 404 from resolveLocal as null artist (not an error)', async () => {
  const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
  const { artist, artistError, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ throws: notFoundError }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(artist.value, null);
  assert.equal(artistError.value, null);
});

test('useArtistDetail non-404 resolveLocal failure sets artistError', async () => {
  const serverError = Object.assign(new Error('Internal Server Error'), { status: 500 });
  const { artistError, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ throws: serverError }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.ok(artistError.value && artistError.value.length > 0);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — discography failure
// ---------------------------------------------------------------------------

test('useArtistDetail discography failure sets discographyError and empty releaseGroups', async () => {
  const { releaseGroups, discographyError, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble({ throws: new Error('MB unreachable') }),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.deepEqual(releaseGroups.value, []);
  assert.ok(discographyError.value && discographyError.value.length > 0);
});

test('useArtistDetail discography failure does not block artist load', async () => {
  const { artist, discographyError, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ name: 'Radiohead' }) }),
    browseReleaseGroups: createBrowseDouble({ throws: new Error('timeout') }),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(artist.value?.name, 'Radiohead');
  assert.ok(discographyError.value);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — related artists failure
// ---------------------------------------------------------------------------

test('useArtistDetail similar failure sets relatedError and empty relatedArtists', async () => {
  const { relatedArtists, relatedError, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble({ throws: new Error('similar unavailable') }),
  });

  await loadArtistDetail('mb-1');

  assert.deepEqual(relatedArtists.value, []);
  assert.ok(relatedError.value && relatedError.value.length > 0);
});

test('useArtistDetail similar failure does not block discography or artist load', async () => {
  const rgs = [makeReleaseGroup()];
  const { releaseGroups, artist, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist() }),
    browseReleaseGroups: createBrowseDouble({ results: rgs }),
    fetchSimilar: createSimilarDouble({ throws: new Error('LB offline') }),
  });

  await loadArtistDetail('mb-1');

  assert.equal(artist.value?.name, 'Radiohead');
  assert.equal(releaseGroups.value.length, 1);
});

// ---------------------------------------------------------------------------
// loadArtistDetail — handles missing results array gracefully
// ---------------------------------------------------------------------------

test('useArtistDetail treats missing browse results as empty array', async () => {
  const { releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: async () => ({}),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.deepEqual(releaseGroups.value, []);
});

test('useArtistDetail treats missing similar array as empty', async () => {
  const { relatedArtists, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: async () => ({}),
  });

  await loadArtistDetail('mb-1');

  assert.deepEqual(relatedArtists.value, []);
});

// ---------------------------------------------------------------------------
// setMonitoring
// ---------------------------------------------------------------------------

test('useArtistDetail setMonitoring updates monitoring state without reload', async () => {
  const { monitoring, isMonitored, loadArtistDetail, setMonitoring } = useArtistDetail({
    resolveLocal: createLocalDouble({ monitoring: { monitored: false } }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');
  assert.equal(isMonitored.value, false);

  setMonitoring({ monitored: true });

  assert.equal(monitoring.value?.monitored, true);
  assert.equal(isMonitored.value, true);
});

test('useArtistDetail setMonitoring works even before loadArtistDetail is called', () => {
  const { monitoring, setMonitoring } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  setMonitoring({ monitored: true });

  assert.equal(monitoring.value?.monitored, true);
});

// ---------------------------------------------------------------------------
// Repeated loads (reload behaviour)
// ---------------------------------------------------------------------------

test('useArtistDetail clears errors on a successful second load', async (t) => {
  let callCount = 0;
  const browseReleaseGroups = async (opts) => {
    callCount++;
    if (callCount === 1) throw new Error('first call fails');
    return { results: [makeReleaseGroup()], total: 1, offset: 0, limit: 100 };
  };

  const { discographyError, releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups,
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');
  assert.ok(discographyError.value);

  await loadArtistDetail('mb-1');
  assert.equal(discographyError.value, null);
  assert.equal(releaseGroups.value.length, 1);
});

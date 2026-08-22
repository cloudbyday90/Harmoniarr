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

function createOperatorProjectionDouble({ projection = null, throws = null } = {}) {
  return async (_artistId, _opts) => {
    if (throws) throw throws;
    return projection ?? {
      artist: makeArtist({ id: 'local-1', name: 'Radiohead' }),
      operator: {
        monitoring: {
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
        },
      },
      releaseGroups: [makeReleaseGroup({ id: 'local-rg-1', musicbrainzReleaseGroupId: 'rg-1' })],
    };
  };
}

function createDeferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function flushAsyncWork() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
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

test('useArtistDetail unwraps the metadata route browse envelope and retains safe cache diagnostics', async () => {
  const cache = {
    lookup: 'stale',
    refresh: 'background',
    refreshDurationMs: null,
    state: 'stale',
  };
  const { discographyCache, loadArtistDetail, releaseGroups } = useArtistDetail({
    resolveLocal: createLocalDouble({ throws: Object.assign(new Error('Not Found'), { status: 404 }) }),
    browseReleaseGroups: async () => ({
      browse: {
        cache,
        results: [makeReleaseGroup({ id: 'route-enveloped-rg' })],
      },
      ok: true,
      provider: 'musicbrainz',
    }),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(releaseGroups.value[0].id, 'route-enveloped-rg');
  assert.deepEqual(discographyCache.value, cache);
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

test('useArtistDetail retains related-artist cache diagnostics independently', async () => {
  const cache = { lookup: 'fresh', refresh: 'none', refreshDurationMs: null, state: 'fresh' };
  const { loadArtistDetail, relatedArtistsCache } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: async () => ({ cache, similar: [makeSimilar()] }),
  });

  await loadArtistDetail('mb-1');

  assert.deepEqual(relatedArtistsCache.value, cache);
});

test('useArtistDetail resolves the critical path before related-artist enrichment finishes', async () => {
  const relatedArtistsDeferred = createDeferred();
  const releaseGroups = [makeReleaseGroup({ id: 'browse-rg' })];
  const {
    isLoading,
    isLoadingRelatedArtists,
    loadArtistDetail,
    relatedArtists,
    releaseGroups: loadedReleaseGroups,
  } = useArtistDetail({
    resolveLocal: createLocalDouble({ throws: Object.assign(new Error('Not Found'), { status: 404 }) }),
    browseReleaseGroups: createBrowseDouble({ results: releaseGroups }),
    fetchSimilar: () => relatedArtistsDeferred.promise,
  });

  await loadArtistDetail('mb-1');

  assert.equal(isLoading.value, false);
  assert.equal(isLoadingRelatedArtists.value, true);
  assert.equal(loadedReleaseGroups.value.length, 1);
  assert.deepEqual(relatedArtists.value, []);

  relatedArtistsDeferred.resolve({ similar: [makeSimilar()] });
  await flushAsyncWork();

  assert.equal(isLoadingRelatedArtists.value, false);
  assert.equal(relatedArtists.value[0].name, 'Portishead');
});

test('useArtistDetail loads operator projection for local artist detail', async (t) => {
  const fetchOperatorProjection = t.mock.fn(createOperatorProjectionDouble());
  const { operator, projection, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ id: 'local-1' }) }),
    fetchOperatorProjection,
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(fetchOperatorProjection.mock.callCount(), 1);
  assert.equal(fetchOperatorProjection.mock.calls[0].arguments[0], 'local-1');
  assert.equal(operator.value?.monitoring?.isMonitored, true);
  assert.equal(projection.value?.artist?.id, 'local-1');
});

test('useArtistDetail uses operator projection release groups instead of browse fallback', async (t) => {
  const browseReleaseGroups = t.mock.fn(createBrowseDouble({ results: [makeReleaseGroup({ id: 'browse-rg' })] }));
  const { releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ id: 'local-1' }) }),
    fetchOperatorProjection: createOperatorProjectionDouble({
      projection: {
        artist: makeArtist({ id: 'local-1' }),
        operator: { monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] } },
        releaseGroups: [makeReleaseGroup({ id: 'local-rg-1', musicbrainzReleaseGroupId: 'rg-operator' })],
      },
    }),
    browseReleaseGroups,
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(browseReleaseGroups.mock.callCount(), 0);
  assert.equal(releaseGroups.value.length, 1);
  assert.equal(releaseGroups.value[0].id, 'local-rg-1');
});

test('useArtistDetail browses the cached provider catalog when an operator projection has no release groups', async (t) => {
  const browseReleaseGroups = t.mock.fn(createBrowseDouble({ results: [makeReleaseGroup({ id: 'browse-rg' })] }));
  const { releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ id: 'local-1' }) }),
    fetchOperatorProjection: createOperatorProjectionDouble({
      projection: {
        artist: makeArtist({ id: 'local-1' }),
        operator: { monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] } },
        releaseGroups: [],
      },
    }),
    browseReleaseGroups,
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(browseReleaseGroups.mock.callCount(), 1);
  assert.equal(releaseGroups.value[0].id, 'browse-rg');
});

test('useArtistDetail falls back to browse when operator projection is not found', async (t) => {
  const browseReleaseGroups = t.mock.fn(createBrowseDouble({ results: [makeReleaseGroup({ id: 'browse-rg' })] }));
  const { artistError, releaseGroups, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ artist: makeArtist({ id: 'local-1' }) }),
    fetchOperatorProjection: createOperatorProjectionDouble({
      throws: Object.assign(new Error('Not Found'), { status: 404 }),
    }),
    browseReleaseGroups,
    fetchSimilar: createSimilarDouble(),
  });

  await loadArtistDetail('mb-1');

  assert.equal(artistError.value, null);
  assert.equal(browseReleaseGroups.mock.callCount(), 1);
  assert.equal(releaseGroups.value[0].id, 'browse-rg');
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

test('useArtistDetail keeps provider-backed discography and related enrichment independent after a local loader error', async () => {
  const { artistError, isLoading, loadArtistDetail, releaseGroups, relatedArtists } = useArtistDetail({
    resolveLocal: () => {
      throw new Error('unexpected local resolver failure');
    },
    browseReleaseGroups: createBrowseDouble({ results: [makeReleaseGroup()] }),
    fetchSimilar: createSimilarDouble({ similar: [makeSimilar()] }),
  });

  await loadArtistDetail('mb-1');

  assert.equal(isLoading.value, false);
  assert.ok(artistError.value);
  assert.equal(releaseGroups.value.length, 1);
  assert.equal(relatedArtists.value.length, 1);
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

test('useArtistDetail ignores a late related-artist response after a newer artist load begins', async () => {
  const firstRelatedArtists = createDeferred();
  const secondRelatedArtists = createDeferred();
  const { relatedArtists, loadArtistDetail } = useArtistDetail({
    resolveLocal: createLocalDouble({ throws: Object.assign(new Error('Not Found'), { status: 404 }) }),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: (artistId) => (artistId === 'first-mbid'
      ? firstRelatedArtists.promise
      : secondRelatedArtists.promise),
  });

  await loadArtistDetail('first-mbid');
  await loadArtistDetail('second-mbid');
  firstRelatedArtists.resolve({ similar: [makeSimilar({ id: 'first-related' })] });
  await flushAsyncWork();

  assert.deepEqual(relatedArtists.value, []);

  secondRelatedArtists.resolve({ similar: [makeSimilar({ id: 'second-related' })] });
  await flushAsyncWork();

  assert.equal(relatedArtists.value[0].id, 'second-related');
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

test('useArtistDetail setOperatorProjection updates projection-backed state without reload', () => {
  const { artist, isMonitored, releaseGroups, setOperatorProjection } = useArtistDetail({
    resolveLocal: createLocalDouble(),
    browseReleaseGroups: createBrowseDouble(),
    fetchSimilar: createSimilarDouble(),
  });

  setOperatorProjection({
    artist: makeArtist({ id: 'local-2', name: 'Portishead' }),
    operator: { monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] } },
    releaseGroups: [makeReleaseGroup({ id: 'local-rg-2', title: 'Dummy' })],
  });

  assert.equal(artist.value?.name, 'Portishead');
  assert.equal(isMonitored.value, true);
  assert.equal(releaseGroups.value[0].title, 'Dummy');
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

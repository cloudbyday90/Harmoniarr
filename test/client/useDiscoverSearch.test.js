import assert from 'node:assert/strict';
import test from 'node:test';
import { useDiscoverSearch } from '../../src/client/composables/useDiscoverSearch.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToastDouble(t) {
  return {
    success: t.mock.fn(),
    error: t.mock.fn(),
    info: t.mock.fn(),
    warning: t.mock.fn(),
    dismiss: t.mock.fn(),
  };
}

function createSearchDouble(results = []) {
  return async ({ query, limit }) => ({
    search: { query, limit, results },
  });
}

function createImportDouble({ artistId = 'local-artist-1' } = {}) {
  return async () => ({
    ok: true,
    imported: { artistId, source: 'musicbrainz' },
  });
}

function createMonitorDouble() {
  return async () => ({ ok: true });
}

// ---------------------------------------------------------------------------
// runSearch
// ---------------------------------------------------------------------------

test('useDiscoverSearch runSearch sends trimmed query and populates results', async (t) => {
  const searchArtists = t.mock.fn(createSearchDouble([{ id: 'mb-1', name: 'Radiohead' }]));
  const toast = createToastDouble(t);
  const { query, results, hasSearched, isSearching, runSearch } = useDiscoverSearch({
    searchArtists,
    toast,
  });

  query.value = '  Radiohead  ';
  await runSearch();

  assert.equal(searchArtists.mock.callCount(), 1);
  assert.deepEqual(searchArtists.mock.calls[0].arguments[0], { query: 'Radiohead', limit: 20 });
  assert.deepEqual(results.value, [{ id: 'mb-1', name: 'Radiohead' }]);
  assert.equal(hasSearched.value, true);
  assert.equal(isSearching.value, false);
});

test('useDiscoverSearch runSearch skips the API call when query is blank after trimming', async (t) => {
  const searchArtists = t.mock.fn();
  const toast = createToastDouble(t);
  const { query, hasSearched, runSearch } = useDiscoverSearch({ searchArtists, toast });

  query.value = '   ';
  await runSearch();

  assert.equal(searchArtists.mock.callCount(), 0);
  assert.equal(hasSearched.value, false);
});

test('useDiscoverSearch runSearch clears previous results before each new search', async (t) => {
  const toast = createToastDouble(t);
  let callCount = 0;
  const searchArtists = t.mock.fn(async () => {
    callCount++;
    return {
      search: {
        results: callCount === 1
          ? [{ id: 'mb-1', name: 'First' }]
          : [{ id: 'mb-2', name: 'Second' }],
      },
    };
  });
  const { query, results, runSearch } = useDiscoverSearch({ searchArtists, toast });

  query.value = 'First';
  await runSearch();
  assert.equal(results.value.length, 1);

  query.value = 'Second';
  await runSearch();
  assert.equal(results.value.length, 1);
  assert.equal(results.value[0].name, 'Second');
});

test('useDiscoverSearch runSearch sets hasSearched to true even when the search returns no results', async (t) => {
  const toast = createToastDouble(t);
  const { query, results, hasSearched, runSearch } = useDiscoverSearch({
    searchArtists: async () => ({ search: { results: [] } }),
    toast,
  });

  query.value = 'unlikely artist name xyzzy';
  await runSearch();

  assert.equal(hasSearched.value, true);
  assert.deepEqual(results.value, []);
});

test('useDiscoverSearch runSearch populates searchError and sets hasSearched on API failure', async (t) => {
  const toast = createToastDouble(t);
  const { query, searchError, hasSearched, results, runSearch } = useDiscoverSearch({
    searchArtists: async () => { throw new Error('network timeout'); },
    toast,
  });

  query.value = 'Björk';
  await runSearch();

  assert.equal(searchError.value, 'network timeout');
  assert.equal(hasSearched.value, true);
  assert.deepEqual(results.value, []);
});

// ---------------------------------------------------------------------------
// monitorArtist — happy path
// ---------------------------------------------------------------------------

test('useDiscoverSearch monitorArtist passes the MusicBrainz artist ID to importArtist', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { monitorArtist } = useDiscoverSearch({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-artist-42', name: 'Boards of Canada' });

  assert.equal(importArtist.mock.callCount(), 1);
  assert.equal(importArtist.mock.calls[0].arguments[0], 'mb-artist-42');
});

test('useDiscoverSearch monitorArtist passes imported.artistId — not artist.id — to updateMonitoring', async (t) => {
  // Regression: original code used importResult?.artist?.id which is always
  // undefined for the import route response shape { imported: { artistId } }.
  const updateMonitoring = t.mock.fn(createMonitorDouble());
  const toast = createToastDouble(t);
  const { monitorArtist } = useDiscoverSearch({
    importArtist: async () => ({
      ok: true,
      imported: { artistId: 'local-99', source: 'musicbrainz' },
    }),
    updateMonitoring,
    toast,
  });

  await monitorArtist({ id: 'mb-artist-42', name: 'Autechre' });

  assert.equal(updateMonitoring.mock.callCount(), 1);
  assert.equal(updateMonitoring.mock.calls[0].arguments[0], 'local-99');
});

test('useDiscoverSearch monitorArtist transitions card to monitored state on success', async (t) => {
  const toast = createToastDouble(t);
  const { artistStates, hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-1', name: 'Portishead' });

  assert.equal(artistStates.value['mb-1'], 'monitored');
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 1);
  assert.match(toast.success.mock.calls[0].arguments[0], /Portishead/);
});

// ---------------------------------------------------------------------------
// monitorArtist — regression: missing imported.artistId must be an error
// ---------------------------------------------------------------------------

test('useDiscoverSearch monitorArtist treats a missing imported.artistId as an error and does not call updateMonitoring', async (t) => {
  // Regression: original code silently skipped updateMonitoring and still
  // showed "Monitored" when the import response lacked a local artist ID.
  const updateMonitoring = t.mock.fn();
  const toast = createToastDouble(t);
  const { artistStates, hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: async () => ({ ok: true, imported: { source: 'musicbrainz' } }), // no artistId
    updateMonitoring,
    toast,
  });

  await monitorArtist({ id: 'mb-broken', name: 'Unknown Artist' });

  assert.equal(artistStates.value['mb-broken'], 'error');
  assert.equal(hasMonitored.value, false);
  assert.equal(updateMonitoring.mock.callCount(), 0);
  assert.equal(toast.success.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

test('useDiscoverSearch monitorArtist treats a null imported response as an error and does not call updateMonitoring', async (t) => {
  const updateMonitoring = t.mock.fn();
  const toast = createToastDouble(t);
  const { artistStates, monitorArtist } = useDiscoverSearch({
    importArtist: async () => null,
    updateMonitoring,
    toast,
  });

  await monitorArtist({ id: 'mb-null', name: 'Null Artist' });

  assert.equal(artistStates.value['mb-null'], 'error');
  assert.equal(updateMonitoring.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

// ---------------------------------------------------------------------------
// monitorArtist — failure paths
// ---------------------------------------------------------------------------

test('useDiscoverSearch monitorArtist transitions card to error state when importArtist throws', async (t) => {
  const toast = createToastDouble(t);
  const { artistStates, hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: async () => { throw new Error('import service unavailable'); },
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-err', name: 'Failure Artist' });

  assert.equal(artistStates.value['mb-err'], 'error');
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /import service unavailable/);
});

test('useDiscoverSearch monitorArtist transitions card to error state when updateMonitoring throws', async (t) => {
  const toast = createToastDouble(t);
  const { artistStates, hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    updateMonitoring: async () => { throw new Error('monitoring update failed'); },
    toast,
  });

  await monitorArtist({ id: 'mb-fail', name: 'Monitor Fail' });

  assert.equal(artistStates.value['mb-fail'], 'error');
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /monitoring update failed/);
});

// ---------------------------------------------------------------------------
// monitorArtist — idempotency and per-card independence
// ---------------------------------------------------------------------------

test('useDiscoverSearch monitorArtist is a no-op when the card is already in monitoring state', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { artistStates, monitorArtist } = useDiscoverSearch({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  // Simulate card already in monitoring state.
  artistStates.value = { 'mb-1': 'monitoring' };
  await monitorArtist({ id: 'mb-1', name: 'Double Monitor' });

  assert.equal(importArtist.mock.callCount(), 0);
});

test('useDiscoverSearch monitorArtist is a no-op when the card is already monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { artistStates, monitorArtist } = useDiscoverSearch({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  artistStates.value = { 'mb-1': 'monitored' };
  await monitorArtist({ id: 'mb-1', name: 'Already Monitored' });

  assert.equal(importArtist.mock.callCount(), 0);
});

test('useDiscoverSearch monitorArtist tracks state per card independently', async (t) => {
  const toast = createToastDouble(t);
  const { artistStates, hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: createImportDouble({ artistId: 'local-x' }),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await Promise.all([
    monitorArtist({ id: 'mb-a', name: 'Artist A' }),
    monitorArtist({ id: 'mb-b', name: 'Artist B' }),
  ]);

  assert.equal(artistStates.value['mb-a'], 'monitored');
  assert.equal(artistStates.value['mb-b'], 'monitored');
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 2);
});

// ---------------------------------------------------------------------------
// hasMonitored computed
// ---------------------------------------------------------------------------

test('useDiscoverSearch hasMonitored is false initially and becomes true after the first successful monitor', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: createImportDouble(),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  assert.equal(hasMonitored.value, false);

  await monitorArtist({ id: 'mb-first', name: 'First Artist' });

  assert.equal(hasMonitored.value, true);
});

test('useDiscoverSearch hasMonitored remains false when every monitor attempt fails', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, monitorArtist } = useDiscoverSearch({
    importArtist: async () => { throw new Error('fail'); },
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-bad', name: 'Bad Artist' });

  assert.equal(hasMonitored.value, false);
});

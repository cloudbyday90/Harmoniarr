import assert from 'node:assert/strict';
import test from 'node:test';
import { useDiscoverSearch } from '../../src/client/composables/useDiscoverSearch.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSearchDouble(results = []) {
  return async ({ query, limit }) => ({
    search: { query, limit, results },
  });
}

// ---------------------------------------------------------------------------
// runSearch
// ---------------------------------------------------------------------------

test('useDiscoverSearch runSearch sends trimmed query and populates results', async (t) => {
  const searchArtists = t.mock.fn(createSearchDouble([{ id: 'mb-1', name: 'Radiohead' }]));
  const { query, results, hasSearched, isSearching, runSearch } = useDiscoverSearch({
    searchArtists,
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
  const { query, hasSearched, runSearch } = useDiscoverSearch({ searchArtists });

  query.value = '   ';
  await runSearch();

  assert.equal(searchArtists.mock.callCount(), 0);
  assert.equal(hasSearched.value, false);
});

test('useDiscoverSearch runSearch clears previous results before each new search', async (t) => {
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
  const { query, results, runSearch } = useDiscoverSearch({ searchArtists });

  query.value = 'First';
  await runSearch();
  assert.equal(results.value.length, 1);

  query.value = 'Second';
  await runSearch();
  assert.equal(results.value.length, 1);
  assert.equal(results.value[0].name, 'Second');
});

test('useDiscoverSearch runSearch sets hasSearched to true even when the search returns no results', async (t) => {
  const { query, results, hasSearched, runSearch } = useDiscoverSearch({
    searchArtists: t.mock.fn(async () => ({ search: { results: [] } })),
  });

  query.value = 'unlikely artist name xyzzy';
  await runSearch();

  assert.equal(hasSearched.value, true);
  assert.deepEqual(results.value, []);
});

test('useDiscoverSearch runSearch populates searchError and sets hasSearched on API failure', async (t) => {
  const { query, searchError, hasSearched, results, runSearch } = useDiscoverSearch({
    searchArtists: t.mock.fn(async () => { throw new Error('network timeout'); }),
  });

  query.value = 'Björk';
  await runSearch();

  assert.equal(searchError.value, 'network timeout');
  assert.equal(hasSearched.value, true);
  assert.deepEqual(results.value, []);
});


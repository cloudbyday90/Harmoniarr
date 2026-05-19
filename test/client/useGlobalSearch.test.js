import assert from 'node:assert/strict';
import test from 'node:test';
import { useGlobalSearch } from '../../src/client/composables/useGlobalSearch.js';

function defaultJsonResponse(body = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, artists: [], releaseGroups: [], releases: [], ...body }),
  };
}

function mockFetch(jsonBody = {}) {
  globalThis.fetch = async () => defaultJsonResponse(jsonBody);
}

function setupComposable({ router } = {}) {
  const mockRouter = router ?? { push: async () => {} };
  const composable = useGlobalSearch({ router: mockRouter });

  function advanceTime(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }

  return {
    ...composable,
    advanceTime,
  };
}

test('useGlobalSearch debounces search by 200ms', async (t) => {
  let callCount = 0;
  const double = async () => {
    callCount++;
    return { ok: true, artists: [], releaseGroups: [], releases: [] };
  };
  globalThis.fetch = t.mock.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => double(),
  }));

  const { query, scheduleSearch, advanceTime } = setupComposable();

  query.value = 'r';
  scheduleSearch(query.value);
  query.value = 'ra';
  scheduleSearch(query.value);
  query.value = 'rad';
  scheduleSearch(query.value);
  query.value = 'radi';
  scheduleSearch(query.value);
  query.value = 'radio';
  scheduleSearch(query.value);

  await advanceTime(250);

  assert.equal(callCount, 1, 'should only call fetch once after debounce settles');
});

test('useGlobalSearch does not search when query is shorter than 2 characters', async (t) => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return defaultJsonResponse();
  };

  const { query, scheduleSearch, advanceTime, loading, results } = setupComposable();

  query.value = 'r';
  scheduleSearch(query.value);
  await advanceTime(250);

  assert.equal(callCount, 0, 'should not call fetch for single character');
  assert.equal(loading.value, false);
  assert.deepEqual(results.value, { artists: [], releaseGroups: [], releases: [] });
});

test('useGlobalSearch searches when query is 2 or more characters', async (t) => {
  let receivedQuery = null;
  globalThis.fetch = t.mock.fn(async (url) => {
    const parsed = new URL(url, 'http://localhost');
    receivedQuery = parsed.searchParams.get('q');
    return defaultJsonResponse();
  });

  const { query, scheduleSearch, advanceTime } = setupComposable();

  query.value = 'ab';
  scheduleSearch(query.value);
  await advanceTime(250);

  assert.equal(receivedQuery, 'ab');
});

test('useGlobalSearch cancels pending search when new searchImmediate is called', async (t) => {
  let abortCount = 0;
  globalThis.fetch = t.mock.fn(async (url, options) => {
    const signal = options?.signal;
    if (signal) {
      signal.addEventListener('abort', () => { abortCount++; });
    }
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    return defaultJsonResponse();
  });

  const { query, searchImmediate } = setupComposable();

  query.value = 'first';
  const firstSearch = searchImmediate(query.value);
  query.value = 'second';
  await searchImmediate(query.value);

  try { await firstSearch; } catch { /* expected — request was aborted */ }

  assert.equal(abortCount, 1, 'first request should be aborted');
});

test('useGlobalSearch flatResults flattens grouped results into indexed list', async (t) => {
  mockFetch({
    artists: [{ id: 'a1', name: 'Artist 1', source: {} }],
    releaseGroups: [{ id: 'rg1', title: 'Album 1', artistName: 'Artist 1', source: {} }],
    releases: [{ id: 'r1', title: 'Release 1', artistName: 'Artist 1', source: {} }],
  });

  const { query, searchImmediate, flatResults } = setupComposable();

  query.value = 'test query';
  await searchImmediate(query.value);

  assert.equal(flatResults.value.count, 3);
  assert.equal(flatResults.value.items[0].type, 'artist');
  assert.equal(flatResults.value.items[1].type, 'releaseGroup');
  assert.equal(flatResults.value.items[2].type, 'release');
  assert.equal(flatResults.value.items[0].flatIndex, 0);
  assert.equal(flatResults.value.items[1].flatIndex, 1);
  assert.equal(flatResults.value.items[2].flatIndex, 2);
});

test('useGlobalSearch hasAnyResults returns false when all result groups are empty', async (t) => {
  mockFetch();

  const { query, searchImmediate, hasAnyResults } = setupComposable();

  assert.equal(hasAnyResults.value, false);

  query.value = 'test';
  await searchImmediate(query.value);

  assert.equal(hasAnyResults.value, false);
});

test('useGlobalSearch hasAnyResults returns true when artists exist', async (t) => {
  mockFetch({
    artists: [{ id: 'a1', name: 'Test', source: {} }],
  });

  const { query, searchImmediate, hasAnyResults, hasArtistResults } = setupComposable();

  query.value = 'test';
  await searchImmediate(query.value);

  assert.equal(hasAnyResults.value, true);
  assert.equal(hasArtistResults.value, true);
});

test('useGlobalSearch keyboard navigation cycles through results', async (t) => {
  mockFetch({
    artists: [
      { id: 'a1', name: 'Artist A', source: {} },
      { id: 'a2', name: 'Artist B', source: {} },
    ],
  });

  const { query, searchImmediate, activeIndex, handleKeydown } = setupComposable();

  query.value = 'test';
  await searchImmediate(query.value);

  assert.equal(activeIndex.value, -1);

  handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(activeIndex.value, 0);

  handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(activeIndex.value, 1);

  handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(activeIndex.value, 0, 'wraps around to start');

  handleKeydown({ key: 'ArrowUp', preventDefault: () => {} });
  assert.equal(activeIndex.value, 1, 'wraps around to end');

  handleKeydown({ key: 'Home', preventDefault: () => {} });
  assert.equal(activeIndex.value, 0);

  handleKeydown({ key: 'End', preventDefault: () => {} });
  assert.equal(activeIndex.value, 1);
});

test('useGlobalSearch does nothing on keydown when results are empty', async (t) => {
  mockFetch();

  const { query, searchImmediate, activeIndex, handleKeydown } = setupComposable();

  query.value = 'nonexistent';
  await searchImmediate(query.value);

  handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
  assert.equal(activeIndex.value, -1);
});

test('useGlobalSearch handleEnter returns true when no result is active', async (t) => {
  mockFetch();
  const { handleEnter } = setupComposable();
  assert.equal(handleEnter(), true);
});

test('useGlobalSearch handleEnter returns false and closes when an active result is selected', async (t) => {
  const pushFn = t.mock.fn(async () => {});
  const mockRouter = { push: pushFn };
  mockFetch({
    artists: [{ id: 'a1', name: 'Artist', source: { musicbrainzArtistId: 'mb-123' } }],
  });

  const { query, searchImmediate, activeIndex, handleEnter } = setupComposable({ router: mockRouter });

  query.value = 'test';
  await searchImmediate(query.value);

  activeIndex.value = 0;

  let closed = false;
  const handled = handleEnter({ close: () => { closed = true; } });
  assert.equal(handled, false);
  assert.equal(closed, true);
  assert.equal(pushFn.mock.callCount(), 1);
});

test('useGlobalSearch resetQuery clears query, results, loading, and error', async (t) => {
  mockFetch({
    artists: [{ id: 'a1', name: 'Artist', source: {} }],
  });

  const {
    query,
    searchImmediate,
    resetQuery,
    results,
    loading,
    errorMessage,
    activeIndex,
  } = setupComposable();

  query.value = 'test';
  await searchImmediate(query.value);

  assert.equal(results.value.artists.length, 1);

  resetQuery();

  assert.equal(query.value, '');
  assert.deepEqual(results.value, { artists: [], releaseGroups: [], releases: [] });
  assert.equal(loading.value, false);
  assert.equal(errorMessage.value, '');
  assert.equal(activeIndex.value, -1);
});

test('useGlobalSearch handles API errors gracefully', async (t) => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: { code: 'internal_error', message: 'Database unavailable' } }),
  });

  const { query, searchImmediate, errorMessage, loading, results } = setupComposable();

  query.value = 'test';
  await searchImmediate(query.value);

  assert.equal(loading.value, false);
  assert.ok(errorMessage.value, 'should set error message');
  assert.deepEqual(results.value, { artists: [], releaseGroups: [], releases: [] });
});

test('useGlobalSearch selectActive returns the currently highlighted result', async (t) => {
  mockFetch({
    artists: [
      { id: 'a1', name: 'Artist A', source: {} },
      { id: 'a2', name: 'Artist B', source: {} },
    ],
    releaseGroups: [
      { id: 'rg1', title: 'Album A', artistName: 'Artist A', source: {} },
    ],
  });

  const { query, searchImmediate, activeIndex, selectActive } = setupComposable();

  query.value = 'test';
  await searchImmediate(query.value);

  activeIndex.value = 2;
  const selected = selectActive();
  assert.equal(selected.type, 'releaseGroup');
  assert.equal(selected.item.title, 'Album A');
});

test('useGlobalSearch buildArtistNavigateLocation uses musicbrainzArtistId when available', () => {
  mockFetch();
  const { buildArtistNavigateLocation } = useGlobalSearch({ router: { push: async () => {} } });

  const artist = {
    id: 42,
    name: 'Radiohead',
    source: { musicbrainzArtistId: 'a74b1b7f-71a5-4011-9441-d0b5e4122711' },
  };

  const location = buildArtistNavigateLocation(artist);

  assert.equal(location.name, 'artist-detail');
  assert.equal(location.params.mbid, 'a74b1b7f-71a5-4011-9441-d0b5e4122711');
  assert.equal(location.query.name, 'Radiohead');
});

test('useGlobalSearch buildArtistNavigateLocation falls back to local id when no musicbrainzArtistId', () => {
  mockFetch();
  const { buildArtistNavigateLocation } = useGlobalSearch({ router: { push: async () => {} } });

  const artist = {
    id: 42,
    name: 'Local Artist',
    source: {},
  };

  const location = buildArtistNavigateLocation(artist);

  assert.equal(location.name, 'artist-detail');
  assert.equal(location.params.mbid, '42');
});

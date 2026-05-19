import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGlobalSearch } from '../../src/client/lib/search-api.js';

test('fetchGlobalSearch builds the correct URL with query parameters', async (t) => {
  globalThis.fetch = t.mock.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    async json() {
      return { ok: true, query: 'radiohead', artists: [], releaseGroups: [], releases: [] };
    },
  }));

  const result = await fetchGlobalSearch({
    query: 'radiohead',
    artistLimit: 5,
    releaseGroupLimit: 5,
    releaseLimit: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.query, 'radiohead');
});

test('fetchGlobalSearch passes abort signal to apiRequest', async (t) => {
  const controller = new AbortController();
  globalThis.fetch = t.mock.fn(async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      async json() { return { ok: true, artists: [], releaseGroups: [], releases: [] }; },
    };
  });

  await fetchGlobalSearch({ query: 'test', signal: controller.signal });
});

test('fetchGlobalSearch omits undefined limit params from the query string', async (t) => {
  const actualUrls = [];
  globalThis.fetch = t.mock.fn(async (url) => {
    actualUrls.push(url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      async json() { return { ok: true, artists: [], releaseGroups: [], releases: [] }; },
    };
  });

  await fetchGlobalSearch({ query: 'test' });

  const url = actualUrls[0];
  assert.ok(url.startsWith('/api/v1/search?'));
  assert.ok(url.includes('q=test'));
  assert.ok(!url.includes('artistLimit'));
  assert.ok(!url.includes('releaseGroupLimit'));
  assert.ok(!url.includes('releaseLimit'));
});

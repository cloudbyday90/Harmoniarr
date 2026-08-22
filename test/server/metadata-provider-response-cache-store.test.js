import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';

function buildRow(overrides = {}) {
  return {
    cache_key: 'artist=artist-1&limit=25',
    cache_namespace: 'musicbrainz.artist_release_groups',
    created_at: '2026-08-22T11:00:00.000Z',
    fetched_at: '2026-08-22T12:00:00.000Z',
    id: 'cache-1',
    payload: { results: [] },
    updated_at: '2026-08-22T12:00:00.000Z',
    ...overrides,
  };
}

test('getCacheEntry queries the normalized identity and maps a row', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [buildRow()] }));
  const store = createMetadataProviderResponseCacheStore({ getPoolFn: () => ({ query }) });

  const result = await store.getCacheEntry({
    cacheKey: ' artist=artist-1&limit=25 ',
    cacheNamespace: ' musicbrainz.artist_release_groups ',
  });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /FROM metadata_provider_response_cache/);
  assert.deepEqual(params, ['musicbrainz.artist_release_groups', 'artist=artist-1&limit=25']);
  assert.deepEqual(result, {
    cacheKey: 'artist=artist-1&limit=25',
    cacheNamespace: 'musicbrainz.artist_release_groups',
    createdAt: '2026-08-22T11:00:00.000Z',
    fetchedAt: '2026-08-22T12:00:00.000Z',
    id: 'cache-1',
    payload: { results: [] },
    updatedAt: '2026-08-22T12:00:00.000Z',
  });
});

test('getCacheEntry rejects blank cache identity values before querying', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createMetadataProviderResponseCacheStore({ getPoolFn: () => ({ query }) });

  await assert.rejects(
    () => store.getCacheEntry({ cacheNamespace: ' ', cacheKey: 'key' }),
    /cacheNamespace/,
  );
  await assert.rejects(
    () => store.getCacheEntry({ cacheNamespace: 'scope', cacheKey: ' ' }),
    /cacheKey/,
  );
  assert.equal(query.mock.callCount(), 0);
});

test('upsertCacheEntry uses the unique cache identity and serializes its payload', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [buildRow()] }));
  const store = createMetadataProviderResponseCacheStore({ getPoolFn: () => ({ query }) });
  const payload = { results: [{ id: 'release-group-1' }] };

  await store.upsertCacheEntry({
    cacheKey: 'artist=artist-1&limit=25',
    cacheNamespace: 'musicbrainz.artist_release_groups',
    fetchedAt: new Date('2026-08-22T12:00:00.000Z'),
    payload,
  });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO metadata_provider_response_cache/);
  assert.match(sql, /ON CONFLICT \(cache_namespace, cache_key\)/);
  assert.deepEqual(params, [
    'musicbrainz.artist_release_groups',
    'artist=artist-1&limit=25',
    JSON.stringify(payload),
    '2026-08-22T12:00:00.000Z',
  ]);
});

test('upsertCacheEntry rejects non-object payloads', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createMetadataProviderResponseCacheStore({ getPoolFn: () => ({ query }) });

  await assert.rejects(
    () => store.upsertCacheEntry({
      cacheKey: 'key',
      cacheNamespace: 'scope',
      fetchedAt: new Date(),
      payload: [],
    }),
    /payload/,
  );
  assert.equal(query.mock.callCount(), 0);
});

test('pruneCacheEntries deletes cache records older than its cutoff', async (t) => {
  const query = t.mock.fn(async () => ({ rowCount: 3 }));
  const store = createMetadataProviderResponseCacheStore({ getPoolFn: () => ({ query }) });

  const removed = await store.pruneCacheEntries({
    olderThan: new Date('2026-08-01T00:00:00.000Z'),
  });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM metadata_provider_response_cache/);
  assert.deepEqual(params, ['2026-08-01T00:00:00.000Z']);
  assert.equal(removed, 3);
});

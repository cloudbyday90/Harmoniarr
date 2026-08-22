import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataProviderCacheService } from '../../src/server/metadata/metadata-provider-cache-service.js';

const identity = {
  cacheKey: 'artist=artist-1',
  cacheNamespace: 'musicbrainz.artist_release_groups',
};
const policy = { freshTtlMs: 60_000, staleTtlMs: 120_000 };

test('getOrLoad returns a fresh cached payload without calling the provider', async (t) => {
  const load = t.mock.fn(async () => ({ results: ['provider'] }));
  const cacheStore = {
    getCacheEntry: t.mock.fn(async () => ({
      ...identity,
      fetchedAt: '2026-08-22T11:59:30.000Z',
      payload: { results: ['cached'] },
    })),
    upsertCacheEntry: t.mock.fn(async () => ({})),
  };
  const service = createMetadataProviderCacheService({
    cacheStore,
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
  });

  const result = await service.getOrLoad({ ...identity, load, policy });

  assert.deepEqual(result.payload, { results: ['cached'] });
  assert.equal(result.cache.state, 'fresh');
  assert.equal(result.cache.refresh, 'none');
  assert.equal(load.mock.callCount(), 0);
});

test('getOrLoad serves a stale payload and refreshes it in the background', async (t) => {
  let resolveLoad;
  const loaded = new Promise((resolve) => {
    resolveLoad = resolve;
  });
  const load = t.mock.fn(() => loaded);
  const upsertCacheEntry = t.mock.fn(async ({ fetchedAt, payload }) => ({
    ...identity,
    fetchedAt,
    payload,
  }));
  const service = createMetadataProviderCacheService({
    cacheStore: {
      getCacheEntry: async () => ({
        ...identity,
        fetchedAt: '2026-08-22T11:58:30.000Z',
        payload: { results: ['stale'] },
      }),
      upsertCacheEntry,
    },
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
  });

  const result = await service.getOrLoad({ ...identity, load, policy });

  assert.deepEqual(result.payload, { results: ['stale'] });
  assert.equal(result.cache.state, 'stale');
  assert.equal(result.cache.refresh, 'background');
  assert.equal(load.mock.callCount(), 1);

  resolveLoad({ results: ['refreshed'] });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(upsertCacheEntry.mock.callCount(), 1);
  assert.deepEqual(upsertCacheEntry.mock.calls[0].arguments[0].payload, { results: ['refreshed'] });
});

test('getOrLoad coalesces concurrent cold cache misses', async (t) => {
  let loadCount = 0;
  let resolveLoad;
  const loaded = new Promise((resolve) => {
    resolveLoad = resolve;
  });
  const load = t.mock.fn(async () => {
    loadCount += 1;
    return loaded;
  });
  const service = createMetadataProviderCacheService({
    cacheStore: {
      getCacheEntry: async () => null,
      upsertCacheEntry: async ({ fetchedAt, payload }) => ({ ...identity, fetchedAt, payload }),
    },
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
  });

  const first = service.getOrLoad({ ...identity, load, policy });
  const second = service.getOrLoad({ ...identity, load, policy });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  resolveLoad({ results: ['loaded'] });

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(loadCount, 1);
  assert.deepEqual(firstResult.payload, { results: ['loaded'] });
  assert.deepEqual(secondResult.payload, { results: ['loaded'] });
  assert.equal(firstResult.cache.refresh, 'foreground');
});

test('getOrLoad reports background refresh failures while retaining the stale response', async (t) => {
  const refreshError = new Error('provider unavailable');
  const onRefreshError = t.mock.fn();
  const service = createMetadataProviderCacheService({
    cacheStore: {
      getCacheEntry: async () => ({
        ...identity,
        fetchedAt: '2026-08-22T11:58:30.000Z',
        payload: { results: ['stale'] },
      }),
      upsertCacheEntry: async () => {
        throw new Error('should not persist');
      },
    },
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
    onRefreshError,
  });

  const result = await service.getOrLoad({
    ...identity,
    load: async () => {
      throw refreshError;
    },
    policy,
  });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });

  assert.deepEqual(result.payload, { results: ['stale'] });
  assert.equal(onRefreshError.mock.callCount(), 1);
  assert.equal(onRefreshError.mock.calls[0].arguments[1], refreshError);
});

test('getOrLoad remains available when cache persistence fails after a cold fetch', async (t) => {
  const onCacheError = t.mock.fn();
  const persistenceError = new Error('database unavailable');
  const service = createMetadataProviderCacheService({
    cacheStore: {
      getCacheEntry: async () => null,
      upsertCacheEntry: async () => {
        throw persistenceError;
      },
    },
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
    onCacheError,
  });

  const result = await service.getOrLoad({
    ...identity,
    load: async () => ({ results: ['provider'] }),
    policy,
  });

  assert.deepEqual(result.payload, { results: ['provider'] });
  assert.equal(result.cache.state, 'fresh');
  assert.equal(onCacheError.mock.callCount(), 1);
  assert.equal(onCacheError.mock.calls[0].arguments[1], persistenceError);
});

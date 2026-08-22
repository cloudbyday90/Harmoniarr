import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMetadataProviderCacheEntry,
  normalizeMetadataProviderCachePolicy,
} from '../../src/server/metadata/metadata-provider-cache-policy.js';

const policy = { freshTtlMs: 60_000, staleTtlMs: 120_000 };
const now = new Date('2026-08-22T12:00:00.000Z');

test('classifyMetadataProviderCacheEntry returns a cache miss without a usable entry', () => {
  const result = classifyMetadataProviderCacheEntry({ now, policy });

  assert.deepEqual(result, {
    expiresAt: null,
    fetchedAt: null,
    freshUntil: null,
    state: 'miss',
  });
});

test('classifyMetadataProviderCacheEntry treats a null fetched timestamp as a cache miss', () => {
  const result = classifyMetadataProviderCacheEntry({
    entry: {
      fetchedAt: null,
      payload: { results: ['incomplete'] },
    },
    now,
    policy,
  });

  assert.equal(result.state, 'miss');
});

test('classifyMetadataProviderCacheEntry marks a recent entry fresh', () => {
  const result = classifyMetadataProviderCacheEntry({
    entry: {
      fetchedAt: '2026-08-22T11:59:30.000Z',
      payload: { results: [] },
    },
    now,
    policy,
  });

  assert.equal(result.state, 'fresh');
  assert.equal(result.freshUntil, '2026-08-22T12:00:30.000Z');
  assert.equal(result.expiresAt, '2026-08-22T12:02:30.000Z');
});

test('classifyMetadataProviderCacheEntry marks an entry stale within the SWR window', () => {
  const result = classifyMetadataProviderCacheEntry({
    entry: {
      fetchedAt: '2026-08-22T11:58:30.000Z',
      payload: { results: [] },
    },
    now,
    policy,
  });

  assert.equal(result.state, 'stale');
});

test('classifyMetadataProviderCacheEntry marks an entry expired after its stale window', () => {
  const result = classifyMetadataProviderCacheEntry({
    entry: {
      fetchedAt: '2026-08-22T11:56:00.000Z',
      payload: { results: [] },
    },
    now,
    policy,
  });

  assert.equal(result.state, 'expired');
});

test('normalizeMetadataProviderCachePolicy rejects invalid freshness values', () => {
  assert.throws(
    () => normalizeMetadataProviderCachePolicy({ freshTtlMs: -1, staleTtlMs: 0 }),
    /freshTtlMs/,
  );
  assert.throws(
    () => normalizeMetadataProviderCachePolicy({ freshTtlMs: 0, staleTtlMs: Number.NaN }),
    /staleTtlMs/,
  );
});

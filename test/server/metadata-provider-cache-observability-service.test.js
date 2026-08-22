import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataProviderCacheObservabilityService } from '../../src/server/metadata/metadata-provider-cache-observability-service.js';

const namespace = 'musicbrainz.artist_release_groups';

test('metadata provider cache observability aggregates only fixed low-cardinality cache outcomes', () => {
  const observability = createMetadataProviderCacheObservabilityService({
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
  });

  observability.recordCacheLookup({ cacheKey: 'artist=private-id', cacheNamespace: namespace, lookup: 'cold' });
  observability.recordCacheLookup({ cacheNamespace: namespace, lookup: 'fresh' });
  observability.recordCacheLookup({ cacheNamespace: namespace, lookup: 'stale' });
  observability.recordRefreshStart({ cacheNamespace: namespace, refresh: 'foreground' });
  observability.recordRefreshSuccess({ cacheNamespace: namespace, durationMs: 42.8, refresh: 'foreground' });
  observability.recordRefreshStart({ cacheNamespace: namespace, refresh: 'background' });
  observability.recordRefreshFailure({ cacheNamespace: namespace, error: new Error('provider token=secret'), refresh: 'background' });
  observability.recordCacheStoreError({ cacheNamespace: namespace, operation: 'read' });

  const summary = observability.getSummary();

  assert.equal(summary.updatedAt, '2026-08-22T12:00:00.000Z');
  assert.equal(summary.namespaces.length, 1);
  assert.deepEqual(summary.namespaces[0], {
    cacheNamespace: namespace,
    cacheStoreErrors: { read: 1, write: 0 },
    lookups: { cold: 1, fresh: 1, stale: 1 },
    refreshes: {
      background: {
        failed: 1,
        inFlight: 0,
        lastCompletedAt: null,
        lastDurationMs: null,
        lastFailedAt: '2026-08-22T12:00:00.000Z',
        succeeded: 0,
      },
      foreground: {
        failed: 0,
        inFlight: 0,
        lastCompletedAt: '2026-08-22T12:00:00.000Z',
        lastDurationMs: 43,
        lastFailedAt: null,
        succeeded: 1,
      },
    },
  });
  assert.equal(JSON.stringify(summary).includes('private-id'), false);
  assert.equal(JSON.stringify(summary).includes('secret'), false);
});

test('metadata provider cache observability ignores invalid dimensions', () => {
  const observability = createMetadataProviderCacheObservabilityService();

  observability.recordCacheLookup({ cacheNamespace: namespace, lookup: 'expired' });
  observability.recordRefreshStart({ cacheNamespace: namespace, refresh: 'blocking' });
  observability.recordCacheStoreError({ cacheNamespace: namespace, operation: 'delete' });

  assert.deepEqual(observability.getSummary(), { namespaces: [], updatedAt: null });
});

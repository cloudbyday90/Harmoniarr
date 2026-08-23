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
import { applyPendingMigrations } from '../../src/server/migrations.js';
import {
  metadataProviderCacheNamespaces,
} from '../../src/server/metadata/metadata-provider-cache-policy.js';
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import { runArtistDetailCacheSampleWorkload } from '../../testing/metadata/artist-detail-cache-sample-workload.js';
import {
  createArtistDetailCacheSampleProviderCalls,
  createCacheBackedArtistDetailSampleServices,
  createObservedArtistDetailCacheService,
} from '../../testing/metadata/artist-detail-cache-sample-workload-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

const expectedSampleCount = artistDetailCacheSampleCatalog.length;

function getNamespaceMetrics(summary, cacheNamespace) {
  const metrics = summary.namespaces.find((candidate) => candidate.cacheNamespace === cacheNamespace);
  assert.ok(metrics, `expected metrics for ${cacheNamespace}`);
  return metrics;
}

function assertNamespaceMetrics(summary, cacheNamespace, { cold, fresh, foregroundSucceeded }) {
  const metrics = getNamespaceMetrics(summary, cacheNamespace);
  assert.deepEqual(metrics.cacheStoreErrors, { read: 0, write: 0 });
  assert.deepEqual(metrics.lookups, { cold, fresh, stale: 0 });
  assert.equal(metrics.refreshes.foreground.failed, 0);
  assert.equal(metrics.refreshes.foreground.inFlight, 0);
  assert.equal(metrics.refreshes.foreground.succeeded, foregroundSucceeded);
  assert.equal(metrics.refreshes.background.failed, 0);
  assert.equal(metrics.refreshes.background.inFlight, 0);
  assert.equal(metrics.refreshes.background.succeeded, 0);
}

function assertWorkloadResult(result) {
  assert.deepEqual(result, {
    artistCount: artistDetailCacheSampleCatalog.length,
    discographyRequestCount: artistDetailCacheSampleCatalog.length,
    relatedArtistRequestCount: artistDetailCacheSampleCatalog.length,
  });
}

test('Artist Detail samples progress from cold to fresh and remain fresh after service recreation', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const cacheStore = createMetadataProviderResponseCacheStore({ getPoolFn });
      const firstProcess = createObservedArtistDetailCacheService({
        cacheStore,
        nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
      });
      const firstProviderCalls = createArtistDetailCacheSampleProviderCalls();
      const firstServices = createCacheBackedArtistDetailSampleServices({
        cacheService: firstProcess.cacheService,
        providerCalls: firstProviderCalls,
      });

      assertWorkloadResult(await runArtistDetailCacheSampleWorkload(firstServices));
      assert.deepEqual(firstProviderCalls, {
        discography: artistDetailCacheSampleCatalog.length,
        lastFm: artistDetailCacheSampleCatalog.length,
        listenBrainz: artistDetailCacheSampleCatalog.length,
        musicBrainzRelations: artistDetailCacheSampleCatalog.length,
      });

      assertWorkloadResult(await runArtistDetailCacheSampleWorkload(firstServices));
      assertNamespaceMetrics(
        firstProcess.observability.getSummary(),
        metadataProviderCacheNamespaces.musicBrainzArtistReleaseGroups,
        { cold: expectedSampleCount, foregroundSucceeded: expectedSampleCount, fresh: expectedSampleCount },
      );
      assertNamespaceMetrics(
        firstProcess.observability.getSummary(),
        metadataProviderCacheNamespaces.similarArtists,
        { cold: expectedSampleCount, foregroundSucceeded: expectedSampleCount, fresh: expectedSampleCount },
      );
      assert.deepEqual(firstProviderCalls, {
        discography: artistDetailCacheSampleCatalog.length,
        lastFm: artistDetailCacheSampleCatalog.length,
        listenBrainz: artistDetailCacheSampleCatalog.length,
        musicBrainzRelations: artistDetailCacheSampleCatalog.length,
      });

      const cacheRows = await getPoolFn().query(
        `SELECT cache_namespace, COUNT(*)::int AS entry_count
           FROM metadata_provider_response_cache
          GROUP BY cache_namespace
          ORDER BY cache_namespace ASC`,
      );
      assert.deepEqual(cacheRows.rows, [
        {
          cache_namespace: metadataProviderCacheNamespaces.similarArtists,
          entry_count: artistDetailCacheSampleCatalog.length,
        },
        {
          cache_namespace: metadataProviderCacheNamespaces.musicBrainzArtistReleaseGroups,
          entry_count: artistDetailCacheSampleCatalog.length,
        },
      ]);

      const recreatedProcess = createObservedArtistDetailCacheService({
        cacheStore,
        nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
      });
      const recreatedProviderCalls = createArtistDetailCacheSampleProviderCalls();
      const recreatedServices = createCacheBackedArtistDetailSampleServices({
        cacheService: recreatedProcess.cacheService,
        providerCalls: recreatedProviderCalls,
      });

      assertWorkloadResult(await runArtistDetailCacheSampleWorkload(recreatedServices));
      assertNamespaceMetrics(
        recreatedProcess.observability.getSummary(),
        metadataProviderCacheNamespaces.musicBrainzArtistReleaseGroups,
        { cold: 0, foregroundSucceeded: 0, fresh: expectedSampleCount },
      );
      assertNamespaceMetrics(
        recreatedProcess.observability.getSummary(),
        metadataProviderCacheNamespaces.similarArtists,
        { cold: 0, foregroundSucceeded: 0, fresh: expectedSampleCount },
      );
      assert.deepEqual(recreatedProviderCalls, createArtistDetailCacheSampleProviderCalls());
    },
  });
});

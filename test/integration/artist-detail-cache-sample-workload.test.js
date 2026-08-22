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
import { createMetadataProviderCacheObservabilityService } from '../../src/server/metadata/metadata-provider-cache-observability-service.js';
import { createMetadataProviderCacheService } from '../../src/server/metadata/metadata-provider-cache-service.js';
import {
  metadataProviderCacheNamespaces,
} from '../../src/server/metadata/metadata-provider-cache-policy.js';
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';
import { createMusicBrainzCatalogService } from '../../src/server/metadata/musicbrainz-catalog-service.js';
import { createSimilarArtistsService } from '../../src/server/metadata/similar-artists-service.js';
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import { runArtistDetailCacheSampleWorkload } from '../../testing/metadata/artist-detail-cache-sample-workload.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

const expectedSampleCount = artistDetailCacheSampleCatalog.length;

function createProviderCalls() {
  return {
    discography: 0,
    lastFm: 0,
    listenBrainz: 0,
    musicBrainzRelations: 0,
  };
}

function createDeterministicSimilarArtists(artistMbid) {
  return Array.from({ length: 12 }, (_, index) => ({
    mbid: `fixture-related-${artistMbid}-${index + 1}`,
    name: `Fixture related artist ${index + 1}`,
    score: 1 - (index * 0.02),
  }));
}

function createCacheBackedArtistDetailServices({ cacheService, providerCalls }) {
  const musicBrainzCatalogService = createMusicBrainzCatalogService({
    metadataProviderCacheService: cacheService,
    musicBrainzClient: {
      async browseArtistReleaseGroups({ artistId, offset }) {
        providerCalls.discography += 1;
        return {
          'release-group-count': 1,
          'release-groups': [{
            'first-release-date': '2026-01-01',
            'primary-type': 'Album',
            id: `fixture-release-group-${artistId}`,
            title: 'Fixture discography result',
          }],
          offset,
        };
      },
    },
  });
  const similarArtistsService = createSimilarArtistsService({
    lastFmClient: {
      async getSimilarArtists() {
        providerCalls.lastFm += 1;
        return [];
      },
    },
    listenBrainzClient: {
      async getRadioSimilarArtists() {
        throw new Error('similarity fallback must not run for the controlled workload');
      },
      async getSimilarArtists({ mbid }) {
        providerCalls.listenBrainz += 1;
        return createDeterministicSimilarArtists(mbid);
      },
    },
    metadataProviderCacheService: cacheService,
    musicBrainzClient: {
      async lookupArtistRelations() {
        providerCalls.musicBrainzRelations += 1;
        return { relations: [] };
      },
      async searchArtists() {
        throw new Error('similarity fallback must not run for the controlled workload');
      },
    },
  });

  return {
    browseArtistReleaseGroups: musicBrainzCatalogService.browseArtistReleaseGroups,
    getSimilarArtists: similarArtistsService.getSimilarArtists,
  };
}

function createObservedCacheService({ cacheStore }) {
  const observability = createMetadataProviderCacheObservabilityService({
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
  });
  const cacheService = createMetadataProviderCacheService({
    cacheStore,
    nowFn: () => new Date('2026-08-22T12:00:00.000Z'),
    onCacheError: observability.recordCacheStoreError,
    onCacheLookup: observability.recordCacheLookup,
    onRefreshFailure: observability.recordRefreshFailure,
    onRefreshStart: observability.recordRefreshStart,
    onRefreshSuccess: observability.recordRefreshSuccess,
  });

  return { cacheService, observability };
}

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
      const firstProcess = createObservedCacheService({ cacheStore });
      const firstProviderCalls = createProviderCalls();
      const firstServices = createCacheBackedArtistDetailServices({
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

      const recreatedProcess = createObservedCacheService({ cacheStore });
      const recreatedProviderCalls = createProviderCalls();
      const recreatedServices = createCacheBackedArtistDetailServices({
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
      assert.deepEqual(recreatedProviderCalls, createProviderCalls());
    },
  });
});

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
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import {
  createArtistDetailCacheSampleProviderCalls,
  createCacheBackedArtistDetailSampleServices,
  createObservedArtistDetailCacheService,
} from '../../testing/metadata/artist-detail-cache-sample-workload-fixtures.js';
import { createArtistDetailCacheRouteTestApp } from '../../testing/server/artist-detail-cache-route-test-app.js';
import { withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

const expectedProviderCalls = Object.freeze({
  discography: 1,
  lastFm: 1,
  listenBrainz: 1,
  musicBrainzRelations: 1,
});

function assertCacheMetadata(cache, { lookup, refresh }) {
  assert.equal(cache.lookup, lookup);
  assert.equal(cache.refresh, refresh);
  assert.equal(cache.state, 'fresh');
  assert.match(cache.fetchedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(cache.freshUntil, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(cache.expiresAt, /^\d{4}-\d{2}-\d{2}T/u);
}

async function requestArtistDetailProviderData(baseUrl, artistId) {
  const [discographyResponse, relatedArtistsResponse] = await Promise.all([
    fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/${encodeURIComponent(artistId)}/release-groups?limit=100`),
    fetch(`${baseUrl}/api/v1/metadata/artists/${encodeURIComponent(artistId)}/similar?limit=8`),
  ]);

  assert.equal(discographyResponse.status, 200);
  assert.equal(relatedArtistsResponse.status, 200);

  return {
    discography: await discographyResponse.json(),
    relatedArtists: await relatedArtistsResponse.json(),
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createReadObservedCacheStore(cacheStore) {
  let cacheReadCount = 0;

  return {
    cacheStore: {
      async getCacheEntry(identity) {
        const entry = await cacheStore.getCacheEntry(identity);
        cacheReadCount += 1;
        return entry;
      },
      upsertCacheEntry: cacheStore.upsertCacheEntry,
    },
    getCacheReadCount: () => cacheReadCount,
  };
}

async function waitForCondition(condition, message) {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  throw new Error(message);
}

function assertArtistDetailProviderPayloads({ discography, relatedArtists }, cacheExpectation) {
  assert.equal(discography.ok, true);
  assert.equal(discography.provider, 'musicbrainz');
  assert.equal(discography.browse.results.length, 1);
  assertCacheMetadata(discography.browse.cache, cacheExpectation);

  assert.equal(relatedArtists.ok, true);
  assert.equal(relatedArtists.similar.length, 8);
  assertCacheMetadata(relatedArtists.cache, cacheExpectation);
}

test('Artist Detail provider routes preserve the cold-then-fresh cache contract', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const cacheStore = createMetadataProviderResponseCacheStore({ getPoolFn });
      const { cacheService } = createObservedArtistDetailCacheService({ cacheStore });
      const providerCalls = createArtistDetailCacheSampleProviderCalls();
      const providerServices = createCacheBackedArtistDetailSampleServices({
        cacheService,
        providerCalls,
      });
      const sample = artistDetailCacheSampleCatalog[0];
      const app = createArtistDetailCacheRouteTestApp({
        browseMusicBrainzArtistReleaseGroups: providerServices.browseArtistReleaseGroups,
        getSimilarArtists: providerServices.getSimilarArtists,
      });

      await withServer(app, async (baseUrl) => {
        const cold = await requestArtistDetailProviderData(baseUrl, sample.musicBrainzArtistId);
        assertArtistDetailProviderPayloads(cold, { lookup: 'cold', refresh: 'foreground' });
        assert.deepEqual(providerCalls, expectedProviderCalls);

        const fresh = await requestArtistDetailProviderData(baseUrl, sample.musicBrainzArtistId);
        assertArtistDetailProviderPayloads(fresh, { lookup: 'fresh', refresh: 'none' });
        assert.deepEqual(providerCalls, expectedProviderCalls);
      });
    },
  });
});

test('Artist Detail provider routes coalesce simultaneous cold cache requests', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const persistedCacheStore = createMetadataProviderResponseCacheStore({ getPoolFn });
      const readObservedCacheStore = createReadObservedCacheStore(persistedCacheStore);
      const { cacheService } = createObservedArtistDetailCacheService({
        cacheStore: readObservedCacheStore.cacheStore,
      });
      const providerGate = createDeferred();
      const providerCalls = createArtistDetailCacheSampleProviderCalls();
      const providerServices = createCacheBackedArtistDetailSampleServices({
        beforeProviderCall: () => providerGate.promise,
        cacheService,
        providerCalls,
      });
      const sample = artistDetailCacheSampleCatalog[0];
      const app = createArtistDetailCacheRouteTestApp({
        browseMusicBrainzArtistReleaseGroups: providerServices.browseArtistReleaseGroups,
        getSimilarArtists: providerServices.getSimilarArtists,
      });
      const requestCount = 4;

      await withServer(app, async (baseUrl) => {
        const concurrentRequests = Promise.all(Array.from(
          { length: requestCount },
          () => requestArtistDetailProviderData(baseUrl, sample.musicBrainzArtistId),
        ));

        try {
          await waitForCondition(
            () => readObservedCacheStore.getCacheReadCount() === requestCount * 2,
            'simultaneous Artist Detail requests did not all reach the cache',
          );
          await waitForCondition(
            () => Object.values(providerCalls).every((count) => count === 1),
            'the controlled Artist Detail providers did not begin one shared refresh',
          );
        } finally {
          providerGate.resolve();
        }

        const concurrentPayloads = await concurrentRequests;
        for (const payloads of concurrentPayloads) {
          assertArtistDetailProviderPayloads(payloads, { lookup: 'cold', refresh: 'foreground' });
        }
        assert.deepEqual(providerCalls, expectedProviderCalls);

        const fresh = await requestArtistDetailProviderData(baseUrl, sample.musicBrainzArtistId);
        assertArtistDetailProviderPayloads(fresh, { lookup: 'fresh', refresh: 'none' });
        assert.deepEqual(providerCalls, expectedProviderCalls);
      });
    },
  });
});

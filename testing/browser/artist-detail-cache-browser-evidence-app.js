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

import { createApp } from '../../src/server/app.js';
import { createMetadataModule } from '../../src/server/metadata/metadata-module.js';
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';
import {
  createArtistDetailCacheSampleProviderCalls,
  createCacheBackedArtistDetailSampleServices,
  createObservedArtistDetailCacheService,
} from '../metadata/artist-detail-cache-sample-workload-fixtures.js';

const staleRelatedArtistCacheOffsetMs = (24 * 60 * 60 * 1000) + 1;
const defaultInitialTimeMs = Date.UTC(2026, 7, 29, 12, 0, 0);

function normalizeInitialTimeMs(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Artist Detail cache browser evidence initial time must be a valid date');
  }

  return date.getTime();
}

function createControlledMusicBrainzCatalogService(providerServices) {
  return {
    browseArtistReleaseGroups: providerServices.browseArtistReleaseGroups,
    async getReleaseGroupReleases() {
      return {
        limit: 25,
        offset: 0,
        results: [],
        total: 0,
      };
    },
  };
}

/**
 * Builds a test-only app factory with real route wiring and a PostgreSQL-backed
 * provider cache. Only the external provider clients are controlled. Advancing
 * the clock after a cold and fresh read puts both Artist Detail namespaces into
 * their SWR windows without waiting in real time.
 */
export function createArtistDetailCacheBrowserEvidenceAppFactory({
  initialTime = new Date(defaultInitialTimeMs),
} = {}) {
  const initialTimeMs = normalizeInitialTimeMs(initialTime);
  let currentTimeMs = initialTimeMs;
  let providerCalls = null;

  function getProviderCalls() {
    if (!providerCalls) {
      throw new Error('Artist Detail cache browser evidence provider calls are unavailable before app startup');
    }

    return Object.freeze({ ...providerCalls });
  }

  function createAppFn(appOptions) {
    return createApp({
      ...appOptions,
      createMetadataModule(metadataModuleOptions) {
        const cacheStore = createMetadataProviderResponseCacheStore();
        const { cacheService, observability } = createObservedArtistDetailCacheService({
          cacheStore,
          nowFn: () => new Date(currentTimeMs),
        });
        providerCalls = createArtistDetailCacheSampleProviderCalls();
        const providerServices = createCacheBackedArtistDetailSampleServices({
          cacheService,
          providerCalls,
        });

        return createMetadataModule({
          ...metadataModuleOptions,
          metadataProviderCacheObservabilityService: observability,
          metadataProviderCacheService: cacheService,
          metadataProviderResponseCacheStore: cacheStore,
          musicBrainzCatalogService: createControlledMusicBrainzCatalogService(providerServices),
          similarArtistsService: {
            getSimilarArtists: providerServices.getSimilarArtists,
          },
        });
      },
    });
  }

  return {
    advanceToStalePhase() {
      currentTimeMs = initialTimeMs + staleRelatedArtistCacheOffsetMs;
    },
    createAppFn,
    getProviderCalls,
  };
}

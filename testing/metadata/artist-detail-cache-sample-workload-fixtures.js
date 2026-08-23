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

import { createMetadataProviderCacheObservabilityService } from '../../src/server/metadata/metadata-provider-cache-observability-service.js';
import { createMetadataProviderCacheService } from '../../src/server/metadata/metadata-provider-cache-service.js';
import { createMusicBrainzCatalogService } from '../../src/server/metadata/musicbrainz-catalog-service.js';
import { createSimilarArtistsService } from '../../src/server/metadata/similar-artists-service.js';

export function createArtistDetailCacheSampleProviderCalls() {
  return {
    discography: 0,
    lastFm: 0,
    listenBrainz: 0,
    musicBrainzRelations: 0,
  };
}

export function getArtistDetailCacheSampleUpstreamCallCount(providerCalls) {
  return Object.values(providerCalls).reduce((total, value) => total + value, 0);
}

function createDeterministicSimilarArtists(artistMbid) {
  return Array.from({ length: 12 }, (_, index) => ({
    mbid: `fixture-related-${artistMbid}-${index + 1}`,
    name: `Fixture related artist ${index + 1}`,
    score: 1 - (index * 0.02),
  }));
}

function normalizeBeforeProviderCall(beforeProviderCall) {
  if (beforeProviderCall == null) {
    return async () => {};
  }

  if (typeof beforeProviderCall !== 'function') {
    throw new TypeError('beforeProviderCall must be a function when provided');
  }

  return beforeProviderCall;
}

/**
 * Creates deterministic cache-backed providers for Artist Detail integration
 * tests. `beforeProviderCall` provides a test-only synchronization boundary
 * for exercising concurrent requests without contacting a live provider.
 */
export function createCacheBackedArtistDetailSampleServices({
  beforeProviderCall,
  cacheService,
  providerCalls,
}) {
  const waitBeforeProviderCall = normalizeBeforeProviderCall(beforeProviderCall);
  const musicBrainzCatalogService = createMusicBrainzCatalogService({
    metadataProviderCacheService: cacheService,
    musicBrainzClient: {
      async browseArtistReleaseGroups({ artistId, offset }) {
        providerCalls.discography += 1;
        await waitBeforeProviderCall('discography');
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
        await waitBeforeProviderCall('lastFm');
        return [];
      },
    },
    listenBrainzClient: {
      async getRadioSimilarArtists() {
        throw new Error('similarity fallback must not run for the controlled workload');
      },
      async getSimilarArtists({ mbid }) {
        providerCalls.listenBrainz += 1;
        await waitBeforeProviderCall('listenBrainz');
        return createDeterministicSimilarArtists(mbid);
      },
    },
    metadataProviderCacheService: cacheService,
    musicBrainzClient: {
      async lookupArtistRelations() {
        providerCalls.musicBrainzRelations += 1;
        await waitBeforeProviderCall('musicBrainzRelations');
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

export function createObservedArtistDetailCacheService({ cacheStore, nowFn = () => new Date() }) {
  const observability = createMetadataProviderCacheObservabilityService({ nowFn });
  const cacheService = createMetadataProviderCacheService({
    cacheStore,
    nowFn,
    onCacheError: observability.recordCacheStoreError,
    onCacheLookup: observability.recordCacheLookup,
    onRefreshFailure: observability.recordRefreshFailure,
    onRefreshStart: observability.recordRefreshStart,
    onRefreshSuccess: observability.recordRefreshSuccess,
  });

  return { cacheService, observability };
}

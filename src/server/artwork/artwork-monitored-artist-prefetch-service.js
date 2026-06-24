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

import { getPool } from '../database.js';
import { createMetadataMonitoredArtistStore } from '../metadata/metadata-monitored-artist-store.js';
import { createArtworkFetchService } from './artwork-fetch-service.js';

const defaultArtworkRoles = ['artist_thumbnail', 'artist_background'];

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildEmptySummary({ artworkRoles, limit }) {
  return {
    artworkRoles,
    cachedCount: 0,
    eligibleArtistCount: 0,
    failedCount: 0,
    fetchedCount: 0,
    limit,
    missingCount: 0,
    processedArtistCount: 0,
    quotaExceededCount: 0,
    requestCount: 0,
    skippedArtistCount: 0,
    totalMonitoredCount: 0,
  };
}

export function createArtworkMonitoredArtistPrefetchService({
  artworkFetchService = createArtworkFetchService(),
  artworkRoles = defaultArtworkRoles,
  defaultLimit = 250,
  getPoolFn = getPool,
  listMonitoredArtistsQuery,
} = {}) {
  const monitoredArtistStore = createMetadataMonitoredArtistStore({ getPoolFn });
  const readMonitoredArtists = listMonitoredArtistsQuery
    ?? monitoredArtistStore.listMonitoredArtistsForArtwork;

  async function prefetchMonitoredArtistArtwork({ limit = defaultLimit } = {}) {
    const normalizedLimit = normalizePositiveInteger(limit, defaultLimit);
    const summary = buildEmptySummary({
      artworkRoles: [...artworkRoles],
      limit: normalizedLimit,
    });
    const monitoredArtists = await readMonitoredArtists({
      limit: normalizedLimit,
    });

    summary.totalMonitoredCount = monitoredArtists.length;

    for (const artist of monitoredArtists) {
      const musicBrainzArtistId = artist.musicbrainzArtistId ?? null;
      if (!musicBrainzArtistId) {
        summary.skippedArtistCount += 1;
        continue;
      }

      summary.eligibleArtistCount += 1;

      for (const artworkRole of artworkRoles) {
        summary.requestCount += 1;

        try {
          const result = await artworkFetchService.resolveArtwork({
            artworkRole,
            ownerId: musicBrainzArtistId,
            ownerType: 'musicbrainz_artist',
            refresh: false,
          });

          if (result?.cached) {
            summary.cachedCount += 1;
            continue;
          }

          if (result?.assetId) {
            summary.fetchedCount += 1;
            continue;
          }

          if (result?.quotaExceeded) {
            summary.quotaExceededCount += 1;
            continue;
          }

          summary.missingCount += 1;
        } catch {
          summary.failedCount += 1;
        }
      }

      summary.processedArtistCount += 1;
    }

    return summary;
  }

  return {
    prefetchMonitoredArtistArtwork,
  };
}

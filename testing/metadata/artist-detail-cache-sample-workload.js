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

import { artistDetailCacheSampleCatalog } from './artist-detail-cache-sample-catalog.js';
import {
  assertArtistDetailCacheSampleRead,
  normalizeArtistDetailCacheSampleCatalog,
  normalizeArtistDetailCacheSampleLimit,
} from './artist-detail-cache-sample-workload-contract.js';

const defaultReleaseGroupLimit = 25;
const defaultSimilarArtistLimit = 8;

/**
 * Executes the two provider-backed Artist Detail reads for every deterministic
 * sample. The runner is test-only and deliberately returns aggregate request
 * counts rather than cache keys, payloads, or artist identifiers.
 */
export async function runArtistDetailCacheSampleWorkload({
  browseArtistReleaseGroups,
  catalog = artistDetailCacheSampleCatalog,
  getSimilarArtists,
  releaseGroupLimit = defaultReleaseGroupLimit,
  similarArtistLimit = defaultSimilarArtistLimit,
} = {}) {
  assertArtistDetailCacheSampleRead(browseArtistReleaseGroups, 'browseArtistReleaseGroups');
  assertArtistDetailCacheSampleRead(getSimilarArtists, 'getSimilarArtists');
  const samples = normalizeArtistDetailCacheSampleCatalog(catalog);
  const normalizedReleaseGroupLimit = normalizeArtistDetailCacheSampleLimit(
    releaseGroupLimit,
    'releaseGroupLimit',
  );
  const normalizedSimilarArtistLimit = normalizeArtistDetailCacheSampleLimit(
    similarArtistLimit,
    'similarArtistLimit',
  );

  for (const { musicBrainzArtistId } of samples) {
    await Promise.all([
      browseArtistReleaseGroups({
        artistId: musicBrainzArtistId,
        limit: normalizedReleaseGroupLimit,
        offset: 0,
      }),
      getSimilarArtists({
        artistMbid: musicBrainzArtistId,
        limit: normalizedSimilarArtistLimit,
      }),
    ]);
  }

  return Object.freeze({
    artistCount: samples.length,
    discographyRequestCount: samples.length,
    relatedArtistRequestCount: samples.length,
  });
}

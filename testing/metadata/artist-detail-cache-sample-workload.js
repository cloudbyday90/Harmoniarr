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

const defaultReleaseGroupLimit = 25;
const defaultSimilarArtistLimit = 8;

function assertCallable(value, label) {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function`);
  }
}

function normalizePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('catalog must contain at least one Artist Detail sample');
  }

  const artistIds = new Set();
  for (const sample of catalog) {
    const artistId = typeof sample?.musicBrainzArtistId === 'string'
      ? sample.musicBrainzArtistId.trim()
      : '';
    if (!artistId) {
      throw new Error('each Artist Detail cache sample requires musicBrainzArtistId');
    }
    if (artistIds.has(artistId)) {
      throw new Error('Artist Detail cache sample IDs must be unique');
    }
    artistIds.add(artistId);
  }

  return catalog;
}

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
  assertCallable(browseArtistReleaseGroups, 'browseArtistReleaseGroups');
  assertCallable(getSimilarArtists, 'getSimilarArtists');
  const samples = normalizeCatalog(catalog);
  const normalizedReleaseGroupLimit = normalizePositiveInteger(releaseGroupLimit, 'releaseGroupLimit');
  const normalizedSimilarArtistLimit = normalizePositiveInteger(similarArtistLimit, 'similarArtistLimit');

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

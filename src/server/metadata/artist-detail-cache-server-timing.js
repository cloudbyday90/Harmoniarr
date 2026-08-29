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

const cacheLookupValues = new Set(['cold', 'fresh', 'stale']);
const cacheRefreshValues = new Set(['background', 'foreground', 'none']);
const cacheStateValues = new Set(['fresh', 'stale']);

function isNonNegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Serializes the fixed, low-cardinality Artist Detail cache outcome as a
 * standards-based Server-Timing metric. It intentionally excludes cache keys,
 * identifiers, provider URLs, payload values, and errors.
 */
export function buildArtistDetailCacheServerTiming(cache) {
  if (!cache || typeof cache !== 'object') {
    return null;
  }

  const { lookup, refresh, state } = cache;
  if (!cacheLookupValues.has(lookup)
    || !cacheRefreshValues.has(refresh)
    || !cacheStateValues.has(state)) {
    return null;
  }

  const description = `${lookup}/${refresh}/${state}`;
  const duration = refresh === 'foreground' && isNonNegativeFiniteNumber(cache.refreshDurationMs)
    ? `;dur=${Math.round(cache.refreshDurationMs)}`
    : '';

  return `harmoniarr-cache;desc="${description}"${duration}`;
}

/**
 * Appends cache timing without replacing metrics supplied by another middleware
 * or a reverse proxy. The caller provides an authenticated response object.
 */
export function appendArtistDetailCacheServerTiming(response, cache) {
  const timing = buildArtistDetailCacheServerTiming(cache);
  if (!timing || !response) {
    return false;
  }

  if (typeof response.append === 'function') {
    response.append('Server-Timing', timing);
    return true;
  }

  if (typeof response.set === 'function') {
    response.set('Server-Timing', timing);
    return true;
  }

  return false;
}

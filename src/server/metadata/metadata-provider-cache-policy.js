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

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

export const metadataProviderCacheNamespaces = Object.freeze({
  musicBrainzArtistReleaseGroups: 'musicbrainz.artist_release_groups',
  similarArtists: 'artist_detail.similar_artists',
});

export const metadataProviderCachePolicies = Object.freeze({
  musicBrainzArtistReleaseGroups: Object.freeze({
    freshTtlMs: 6 * hourMs,
    staleTtlMs: 7 * dayMs,
  }),
  similarArtists: Object.freeze({
    freshTtlMs: 24 * hourMs,
    staleTtlMs: 7 * dayMs,
  }),
});

function asDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDuration(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return Math.floor(value);
}

/**
 * Validates and normalizes the application-level freshness policy for a cache
 * entry. `staleTtlMs` is an additional SWR window after fresh expiry.
 */
export function normalizeMetadataProviderCachePolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    throw new Error('metadata provider cache policy is required');
  }

  return {
    freshTtlMs: normalizeDuration(policy.freshTtlMs, 'freshTtlMs'),
    staleTtlMs: normalizeDuration(policy.staleTtlMs, 'staleTtlMs'),
  };
}

/**
 * Classifies a stored cache entry at `now` without performing I/O.
 *
 * `stale` is eligible for immediate serving while a revalidation runs. An
 * `expired` entry must be refreshed before being returned.
 */
export function classifyMetadataProviderCacheEntry({ entry, now = new Date(), policy }) {
  const normalizedPolicy = normalizeMetadataProviderCachePolicy(policy);
  const evaluatedAt = asDate(now);
  const fetchedAt = asDate(entry?.fetchedAt);

  if (!evaluatedAt) {
    throw new Error('now must be a valid date');
  }

  if (!entry || !fetchedAt || !entry.payload || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) {
    return {
      expiresAt: null,
      fetchedAt: null,
      freshUntil: null,
      state: 'miss',
    };
  }

  const freshUntil = new Date(fetchedAt.getTime() + normalizedPolicy.freshTtlMs);
  const expiresAt = new Date(freshUntil.getTime() + normalizedPolicy.staleTtlMs);
  const nowMs = evaluatedAt.getTime();

  return {
    expiresAt: expiresAt.toISOString(),
    fetchedAt: fetchedAt.toISOString(),
    freshUntil: freshUntil.toISOString(),
    state: nowMs <= freshUntil.getTime()
      ? 'fresh'
      : nowMs <= expiresAt.getTime()
        ? 'stale'
        : 'expired',
  };
}

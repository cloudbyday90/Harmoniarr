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

import { classifyMetadataProviderCacheEntry } from './metadata-provider-cache-policy.js';
import { createMetadataProviderResponseCacheStore } from './metadata-provider-response-cache-store.js';

function buildInFlightKey({ cacheNamespace, cacheKey }) {
  return `${cacheNamespace}\u0000${cacheKey}`;
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildCacheMetadata(classification, refresh) {
  return {
    expiresAt: classification.expiresAt,
    fetchedAt: classification.fetchedAt,
    freshUntil: classification.freshUntil,
    refresh,
    state: classification.state,
  };
}

/**
 * Coordinates application-level stale-while-revalidate around a durable cache
 * entry. It coalesces concurrent work in the current process; the PostgreSQL
 * UPSERT remains authoritative for persistence across restarts.
 */
export function createMetadataProviderCacheService({
  cacheStore = createMetadataProviderResponseCacheStore(),
  nowFn = () => new Date(),
  onCacheError = () => {},
  onRefreshError = () => {},
} = {}) {
  const inFlightRefreshes = new Map();

  async function loadCachedEntry(identity) {
    try {
      return await cacheStore.getCacheEntry(identity);
    } catch (error) {
      onCacheError({ ...identity, operation: 'read' }, error);
      return null;
    }
  }

  function refreshEntry({ cacheNamespace, cacheKey, load }) {
    const identity = { cacheNamespace, cacheKey };
    const inFlightKey = buildInFlightKey(identity);
    const existing = inFlightRefreshes.get(inFlightKey);
    if (existing) {
      return existing;
    }

    const refresh = Promise.resolve()
      .then(async () => {
        const payload = await load();
        const fetchedAt = nowFn();
        try {
          const stored = await cacheStore.upsertCacheEntry({
            ...identity,
            fetchedAt,
            payload,
          });
          return {
            fetchedAt: stored.fetchedAt,
            payload: stored.payload,
            persisted: true,
          };
        } catch (error) {
          onCacheError({ ...identity, operation: 'write' }, error);
          return {
            fetchedAt: toIsoTimestamp(fetchedAt),
            payload,
            persisted: false,
          };
        }
      })
      .finally(() => {
        inFlightRefreshes.delete(inFlightKey);
      });

    inFlightRefreshes.set(inFlightKey, refresh);
    return refresh;
  }

  async function getOrLoad({ cacheNamespace, cacheKey, load, policy }) {
    if (typeof load !== 'function') {
      throw new Error('metadata provider cache load function is required');
    }

    const identity = { cacheNamespace, cacheKey };
    const entry = await loadCachedEntry(identity);
    const classification = classifyMetadataProviderCacheEntry({
      entry,
      now: nowFn(),
      policy,
    });

    if (classification.state === 'fresh') {
      return {
        cache: buildCacheMetadata(classification, 'none'),
        payload: entry.payload,
      };
    }

    if (classification.state === 'stale') {
      void refreshEntry({ ...identity, load }).catch((error) => {
        onRefreshError(identity, error);
      });

      return {
        cache: buildCacheMetadata(classification, 'background'),
        payload: entry.payload,
      };
    }

    const loaded = await refreshEntry({ ...identity, load });
    const refreshedClassification = classifyMetadataProviderCacheEntry({
      entry: {
        fetchedAt: loaded.fetchedAt,
        payload: loaded.payload,
      },
      now: nowFn(),
      policy,
    });

    return {
      cache: buildCacheMetadata(refreshedClassification, 'foreground'),
      payload: loaded.payload,
    };
  }

  return {
    getOrLoad,
  };
}

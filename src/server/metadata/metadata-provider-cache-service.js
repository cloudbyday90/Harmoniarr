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

function buildCacheMetadata(classification, refresh, {
  lookup,
  refreshDurationMs = null,
} = {}) {
  return {
    expiresAt: classification.expiresAt,
    fetchedAt: classification.fetchedAt,
    freshUntil: classification.freshUntil,
    lookup,
    refresh,
    refreshDurationMs,
    state: classification.state,
  };
}

function normalizeLookupState(state) {
  return state === 'fresh' || state === 'stale' ? state : 'cold';
}

function normalizeRefreshDurationMs(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function notify(observer, details, error) {
  try {
    observer(details, error);
  } catch {
    // Cache observability must never affect a metadata response.
  }
}

/**
 * Coordinates application-level stale-while-revalidate around a durable cache
 * entry. It coalesces concurrent work in the current process; the PostgreSQL
 * UPSERT remains authoritative for persistence across restarts.
 */
export function createMetadataProviderCacheService({
  cacheStore = createMetadataProviderResponseCacheStore(),
  nowFn = () => new Date(),
  nowMsFn = () => performance.now(),
  onCacheError = () => {},
  onCacheLookup = () => {},
  onRefreshFailure = () => {},
  onRefreshError = () => {},
  onRefreshStart = () => {},
  onRefreshSuccess = () => {},
} = {}) {
  const inFlightRefreshes = new Map();

  async function loadCachedEntry(identity) {
    try {
      return await cacheStore.getCacheEntry(identity);
    } catch (error) {
      notify(onCacheError, { ...identity, operation: 'read' }, error);
      return null;
    }
  }

  function refreshEntry({ cacheNamespace, cacheKey, load, refresh, shouldPersist }) {
    const identity = { cacheNamespace, cacheKey };
    const inFlightKey = buildInFlightKey(identity);
    const existing = inFlightRefreshes.get(inFlightKey);
    if (existing) {
      return existing;
    }

    const refreshStartedAt = nowMsFn();
    notify(onRefreshStart, { cacheNamespace, refresh });
    const refreshPromise = Promise.resolve()
      .then(async () => {
        const payload = await load();
        if (!shouldPersist(payload)) {
          return {
            cacheable: false,
            fetchedAt: null,
            payload,
            persisted: false,
          };
        }

        const fetchedAt = nowFn();
        try {
          const stored = await cacheStore.upsertCacheEntry({
            ...identity,
            fetchedAt,
            payload,
          });
          return {
            cacheable: true,
            fetchedAt: stored.fetchedAt,
            payload: stored.payload,
            persisted: true,
          };
        } catch (error) {
          notify(onCacheError, { ...identity, operation: 'write' }, error);
          return {
            cacheable: true,
            fetchedAt: toIsoTimestamp(fetchedAt),
            payload,
            persisted: false,
          };
        }
      })
      .then(
        (result) => {
          const durationMs = normalizeRefreshDurationMs(nowMsFn() - refreshStartedAt);
          if (result.cacheable) {
            notify(onRefreshSuccess, { cacheNamespace, durationMs, refresh });
          } else {
            notify(onRefreshFailure, { cacheNamespace, durationMs, refresh });
          }
          return { ...result, durationMs };
        },
        (error) => {
          const durationMs = normalizeRefreshDurationMs(nowMsFn() - refreshStartedAt);
          notify(onRefreshFailure, { cacheNamespace, durationMs, refresh }, error);
          throw error;
        },
      )
      .finally(() => {
        inFlightRefreshes.delete(inFlightKey);
      });

    inFlightRefreshes.set(inFlightKey, refreshPromise);
    return refreshPromise;
  }

  async function getOrLoad({
    cacheNamespace,
    cacheKey,
    load,
    policy,
    shouldPersist = () => true,
  }) {
    if (typeof load !== 'function') {
      throw new Error('metadata provider cache load function is required');
    }
    if (typeof shouldPersist !== 'function') {
      throw new Error('metadata provider cache shouldPersist function must be a function');
    }

    const identity = { cacheNamespace, cacheKey };
    const entry = await loadCachedEntry(identity);
    const classification = classifyMetadataProviderCacheEntry({
      entry,
      now: nowFn(),
      policy,
    });
    const lookup = normalizeLookupState(classification.state);

    if (classification.state === 'fresh') {
      notify(onCacheLookup, { cacheNamespace, lookup });
      return {
        cache: buildCacheMetadata(classification, 'none', { lookup }),
        payload: entry.payload,
      };
    }

    if (classification.state === 'stale') {
      notify(onCacheLookup, { cacheNamespace, lookup });
      void refreshEntry({
        ...identity,
        load,
        refresh: 'background',
        shouldPersist,
      }).catch((error) => {
        notify(onRefreshError, identity, error);
      });

      return {
        cache: buildCacheMetadata(classification, 'background', { lookup }),
        payload: entry.payload,
      };
    }

    notify(onCacheLookup, { cacheNamespace, lookup });
    const loaded = await refreshEntry({
      ...identity,
      load,
      refresh: 'foreground',
      shouldPersist,
    });
    const refreshedClassification = classifyMetadataProviderCacheEntry({
      entry: {
        fetchedAt: loaded.fetchedAt,
        payload: loaded.payload,
      },
      now: nowFn(),
      policy,
    });

    return {
      cache: buildCacheMetadata(refreshedClassification, 'foreground', {
        lookup,
        refreshDurationMs: loaded.durationMs,
      }),
      payload: loaded.payload,
    };
  }

  return {
    getOrLoad,
  };
}

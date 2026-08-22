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

const lookupStates = Object.freeze(['cold', 'fresh', 'stale']);
const refreshModes = Object.freeze(['background', 'foreground']);
const cacheStoreOperations = Object.freeze(['read', 'write']);

function createLookupCounts() {
  return { cold: 0, fresh: 0, stale: 0 };
}

function createRefreshMetrics() {
  return {
    background: {
      failed: 0,
      inFlight: 0,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastFailedAt: null,
      succeeded: 0,
    },
    foreground: {
      failed: 0,
      inFlight: 0,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastFailedAt: null,
      succeeded: 0,
    },
  };
}

function createNamespaceMetrics(cacheNamespace) {
  return {
    cacheNamespace,
    cacheStoreErrors: { read: 0, write: 0 },
    lookups: createLookupCounts(),
    refreshes: createRefreshMetrics(),
  };
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDurationMs(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

/**
 * Records a bounded, process-local view of provider-cache behaviour.
 *
 * This intentionally accepts only the cache namespace and fixed outcome
 * values. Cache keys, artist IDs, payloads, provider URLs, and error messages
 * are omitted so a diagnostics response cannot become a source of sensitive or
 * high-cardinality telemetry.
 */
export function createMetadataProviderCacheObservabilityService({
  nowFn = () => new Date(),
} = {}) {
  const metricsByNamespace = new Map();
  let updatedAt = null;

  function getMetrics(cacheNamespace) {
    if (typeof cacheNamespace !== 'string' || !cacheNamespace) {
      return null;
    }

    let metrics = metricsByNamespace.get(cacheNamespace);
    if (!metrics) {
      metrics = createNamespaceMetrics(cacheNamespace);
      metricsByNamespace.set(cacheNamespace, metrics);
    }

    return metrics;
  }

  function markUpdated() {
    updatedAt = toIsoTimestamp(nowFn());
  }

  function recordCacheLookup({ cacheNamespace, lookup }) {
    if (!lookupStates.includes(lookup)) {
      return;
    }

    const metrics = getMetrics(cacheNamespace);
    if (!metrics) {
      return;
    }

    metrics.lookups[lookup] += 1;
    markUpdated();
  }

  function recordRefreshStart({ cacheNamespace, refresh }) {
    if (!refreshModes.includes(refresh)) {
      return;
    }

    const metrics = getMetrics(cacheNamespace);
    if (!metrics) {
      return;
    }

    metrics.refreshes[refresh].inFlight += 1;
    markUpdated();
  }

  function recordRefreshSuccess({ cacheNamespace, durationMs, refresh }) {
    if (!refreshModes.includes(refresh)) {
      return;
    }

    const metrics = getMetrics(cacheNamespace);
    if (!metrics) {
      return;
    }

    const refreshMetrics = metrics.refreshes[refresh];
    refreshMetrics.inFlight = Math.max(0, refreshMetrics.inFlight - 1);
    refreshMetrics.lastCompletedAt = toIsoTimestamp(nowFn());
    refreshMetrics.lastDurationMs = normalizeDurationMs(durationMs);
    refreshMetrics.succeeded += 1;
    markUpdated();
  }

  function recordRefreshFailure({ cacheNamespace, refresh }) {
    if (!refreshModes.includes(refresh)) {
      return;
    }

    const metrics = getMetrics(cacheNamespace);
    if (!metrics) {
      return;
    }

    const refreshMetrics = metrics.refreshes[refresh];
    refreshMetrics.failed += 1;
    refreshMetrics.inFlight = Math.max(0, refreshMetrics.inFlight - 1);
    refreshMetrics.lastFailedAt = toIsoTimestamp(nowFn());
    markUpdated();
  }

  function recordCacheStoreError({ cacheNamespace, operation }) {
    if (!cacheStoreOperations.includes(operation)) {
      return;
    }

    const metrics = getMetrics(cacheNamespace);
    if (!metrics) {
      return;
    }

    metrics.cacheStoreErrors[operation] += 1;
    markUpdated();
  }

  function getSummary() {
    return {
      namespaces: [...metricsByNamespace.values()]
        .sort((left, right) => left.cacheNamespace.localeCompare(right.cacheNamespace))
        .map((metrics) => structuredClone(metrics)),
      updatedAt,
    };
  }

  return {
    getSummary,
    recordCacheLookup,
    recordCacheStoreError,
    recordRefreshFailure,
    recordRefreshStart,
    recordRefreshSuccess,
  };
}

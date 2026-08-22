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

const namespacePattern = /^[a-z0-9._-]{1,120}$/;
const monotonicMetricKeys = Object.freeze([
  'cacheStoreErrorCount',
  'coldLookups',
  'completedRefreshCount',
  'freshLookups',
  'refreshFailureCount',
  'staleLookups',
]);

function toCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function toTimestamp(value) {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(value).toISOString();
}

function toPercentage(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function buildNamespaceSnapshot(namespace) {
  if (!namespacePattern.test(namespace?.cacheNamespace ?? '')) {
    return null;
  }

  const coldLookups = toCount(namespace.coldLookups);
  const freshLookups = toCount(namespace.freshLookups);
  const staleLookups = toCount(namespace.staleLookups);

  return {
    activeRefreshCount: toCount(namespace.activeRefreshCount),
    cacheNamespace: namespace.cacheNamespace,
    cacheStoreErrorCount: toCount(namespace.cacheStoreErrorCount),
    coldLookups,
    completedRefreshCount: toCount(namespace.completedRefreshCount),
    freshLookups,
    refreshFailureCount: toCount(namespace.refreshFailureCount),
    staleLookups,
  };
}

function buildTotals(namespaces) {
  return namespaces.reduce((totals, namespace) => ({
    activeRefreshCount: totals.activeRefreshCount + namespace.activeRefreshCount,
    cacheStoreErrorCount: totals.cacheStoreErrorCount + namespace.cacheStoreErrorCount,
    coldLookups: totals.coldLookups + namespace.coldLookups,
    completedRefreshCount: totals.completedRefreshCount + namespace.completedRefreshCount,
    freshLookups: totals.freshLookups + namespace.freshLookups,
    refreshFailureCount: totals.refreshFailureCount + namespace.refreshFailureCount,
    staleLookups: totals.staleLookups + namespace.staleLookups,
  }), {
    activeRefreshCount: 0,
    cacheStoreErrorCount: 0,
    coldLookups: 0,
    completedRefreshCount: 0,
    freshLookups: 0,
    refreshFailureCount: 0,
    staleLookups: 0,
  });
}

function buildIntervalMetrics(reference, current) {
  const metrics = Object.fromEntries(
    monotonicMetricKeys.map((metricKey) => [metricKey, current[metricKey] - reference[metricKey]]),
  );
  const cacheServedLookups = metrics.freshLookups + metrics.staleLookups;
  const totalLookups = cacheServedLookups + metrics.coldLookups;

  return {
    ...metrics,
    activeRefreshCount: current.activeRefreshCount,
    cacheServedLookups,
    cacheServedRatePercent: toPercentage(cacheServedLookups, totalLookups),
    coldLookupRatePercent: toPercentage(metrics.coldLookups, totalLookups),
    refreshFailureRatePercent: toPercentage(metrics.refreshFailureCount, metrics.completedRefreshCount),
    totalLookups,
  };
}

function createEmptyNamespace(cacheNamespace) {
  return {
    activeRefreshCount: 0,
    cacheNamespace,
    cacheStoreErrorCount: 0,
    coldLookups: 0,
    completedRefreshCount: 0,
    freshLookups: 0,
    refreshFailureCount: 0,
    staleLookups: 0,
  };
}

function hasCounterRegression(reference, current) {
  return monotonicMetricKeys.some((metricKey) => current[metricKey] < reference[metricKey]);
}

function createUnavailableComparison(code) {
  return {
    canCompare: false,
    code,
    namespaces: [],
    totals: null,
  };
}

/**
 * Captures only safe aggregate counters from an already normalized cache
 * baseline. The returned value is suitable for temporary in-memory comparison
 * and deliberately contains no provider payloads, cache keys, or raw errors.
 */
export function createMetadataProviderCacheBaselineComparisonSnapshot(baseline) {
  const observedSinceAt = toTimestamp(baseline?.observedSinceAt);
  if (!observedSinceAt) {
    return null;
  }

  const namespaces = Array.isArray(baseline?.namespaces)
    ? baseline.namespaces
      .map(buildNamespaceSnapshot)
      .filter(Boolean)
      .sort((left, right) => left.cacheNamespace.localeCompare(right.cacheNamespace))
    : [];

  return {
    namespaces,
    observedSinceAt,
    totals: buildTotals(namespaces),
    updatedAt: toTimestamp(baseline?.updatedAt),
  };
}

/**
 * Builds process-window interval deltas for two normalized baseline snapshots.
 * Cumulative counters are compared only when their observation start remains
 * unchanged and none of the counters has reset or decreased.
 */
export function buildMetadataProviderCacheBaselineComparison(referenceBaseline, currentBaseline) {
  const reference = createMetadataProviderCacheBaselineComparisonSnapshot(referenceBaseline);
  const current = createMetadataProviderCacheBaselineComparisonSnapshot(currentBaseline);

  if (!reference || !current) {
    return createUnavailableComparison('comparison_process_window_missing');
  }

  if (reference.observedSinceAt !== current.observedSinceAt) {
    return createUnavailableComparison('comparison_process_window_changed');
  }

  if (
    reference.updatedAt
    && current.updatedAt
    && Date.parse(current.updatedAt) < Date.parse(reference.updatedAt)
  ) {
    return createUnavailableComparison('comparison_sample_order_invalid');
  }

  const referenceNamespaces = new Map(reference.namespaces.map((namespace) => [namespace.cacheNamespace, namespace]));
  const currentNamespaces = new Map(current.namespaces.map((namespace) => [namespace.cacheNamespace, namespace]));
  const namespaceNames = [...new Set([...referenceNamespaces.keys(), ...currentNamespaces.keys()])].sort((left, right) => left.localeCompare(right));

  const namespacePairs = namespaceNames.map((cacheNamespace) => ({
    cacheNamespace,
    current: currentNamespaces.get(cacheNamespace) ?? createEmptyNamespace(cacheNamespace),
    reference: referenceNamespaces.get(cacheNamespace) ?? createEmptyNamespace(cacheNamespace),
  }));

  if (
    hasCounterRegression(reference.totals, current.totals)
    || namespacePairs.some(({ reference: namespaceReference, current: namespaceCurrent }) => (
      hasCounterRegression(namespaceReference, namespaceCurrent)
    ))
  ) {
    return createUnavailableComparison('comparison_counter_regressed');
  }

  return {
    canCompare: true,
    code: null,
    namespaces: namespacePairs.map(({ cacheNamespace, reference: namespaceReference, current: namespaceCurrent }) => ({
      cacheNamespace,
      ...buildIntervalMetrics(namespaceReference, namespaceCurrent),
    })),
    observedSinceAt: current.observedSinceAt,
    referenceUpdatedAt: reference.updatedAt,
    totals: buildIntervalMetrics(reference.totals, current.totals),
    updatedAt: current.updatedAt,
  };
}

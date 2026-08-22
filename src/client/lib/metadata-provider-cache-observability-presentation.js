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

const refreshModes = Object.freeze(['background', 'foreground']);

function toCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function toTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function toNamespace(value) {
  if (typeof value !== 'string' || !/^[a-z0-9._-]{1,120}$/.test(value)) {
    return null;
  }

  return value;
}

function toPercentage(numerator, denominator) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 100);
}

function getLatestTimestamp(...timestamps) {
  return timestamps
    .map(toTimestamp)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function buildRefreshBaseline(source) {
  const failed = toCount(source?.failed);
  const inFlight = toCount(source?.inFlight);
  const succeeded = toCount(source?.succeeded);

  return {
    completed: failed + succeeded,
    failed,
    inFlight,
    lastCompletedAt: toTimestamp(source?.lastCompletedAt),
    lastDurationMs: Number.isSafeInteger(source?.lastDurationMs) && source.lastDurationMs >= 0
      ? source.lastDurationMs
      : null,
    lastFailedAt: toTimestamp(source?.lastFailedAt),
    succeeded,
  };
}

function buildNamespaceBaseline(source) {
  const cacheNamespace = toNamespace(source?.cacheNamespace);
  if (!cacheNamespace) {
    return null;
  }

  const coldLookups = toCount(source?.lookups?.cold);
  const freshLookups = toCount(source?.lookups?.fresh);
  const staleLookups = toCount(source?.lookups?.stale);
  const cacheServedLookups = freshLookups + staleLookups;
  const totalLookups = coldLookups + cacheServedLookups;
  const refreshes = Object.fromEntries(
    refreshModes.map((refreshMode) => [refreshMode, buildRefreshBaseline(source?.refreshes?.[refreshMode])]),
  );
  const refreshFailureCount = refreshModes.reduce((total, refreshMode) => total + refreshes[refreshMode].failed, 0);
  const completedRefreshCount = refreshModes.reduce((total, refreshMode) => total + refreshes[refreshMode].completed, 0);
  const activeRefreshCount = refreshModes.reduce((total, refreshMode) => total + refreshes[refreshMode].inFlight, 0);

  return {
    activeRefreshCount,
    cacheNamespace,
    cacheServedLookups,
    cacheServedRatePercent: toPercentage(cacheServedLookups, totalLookups),
    cacheStoreErrorCount: toCount(source?.cacheStoreErrors?.read) + toCount(source?.cacheStoreErrors?.write),
    coldLookupRatePercent: toPercentage(coldLookups, totalLookups),
    coldLookups,
    completedRefreshCount,
    freshLookups,
    lastRefreshAt: getLatestTimestamp(
      ...refreshModes.flatMap((refreshMode) => [
        refreshes[refreshMode].lastCompletedAt,
        refreshes[refreshMode].lastFailedAt,
      ]),
    ),
    refreshFailureCount,
    refreshFailureRatePercent: toPercentage(refreshFailureCount, completedRefreshCount),
    refreshes,
    staleLookups,
    totalLookups,
  };
}

function buildTotals(namespaces) {
  const totals = namespaces.reduce((aggregate, namespace) => ({
    activeRefreshCount: aggregate.activeRefreshCount + namespace.activeRefreshCount,
    cacheServedLookups: aggregate.cacheServedLookups + namespace.cacheServedLookups,
    cacheStoreErrorCount: aggregate.cacheStoreErrorCount + namespace.cacheStoreErrorCount,
    coldLookups: aggregate.coldLookups + namespace.coldLookups,
    completedRefreshCount: aggregate.completedRefreshCount + namespace.completedRefreshCount,
    refreshFailureCount: aggregate.refreshFailureCount + namespace.refreshFailureCount,
    totalLookups: aggregate.totalLookups + namespace.totalLookups,
  }), {
    activeRefreshCount: 0,
    cacheServedLookups: 0,
    cacheStoreErrorCount: 0,
    coldLookups: 0,
    completedRefreshCount: 0,
    refreshFailureCount: 0,
    totalLookups: 0,
  });

  return {
    ...totals,
    cacheServedRatePercent: toPercentage(totals.cacheServedLookups, totals.totalLookups),
    coldLookupRatePercent: toPercentage(totals.coldLookups, totals.totalLookups),
    refreshFailureRatePercent: toPercentage(totals.refreshFailureCount, totals.completedRefreshCount),
  };
}

/**
 * Produces a display-safe, process-local cache baseline from the protected
 * server aggregate. The source contract deliberately has no cache keys,
 * provider payloads, users, URLs, or free-form error values.
 */
export function buildMetadataProviderCacheBaseline(source) {
  const namespaces = Array.isArray(source?.namespaces)
    ? source.namespaces
      .map(buildNamespaceBaseline)
      .filter(Boolean)
      .sort((left, right) => left.cacheNamespace.localeCompare(right.cacheNamespace))
    : [];

  return {
    namespaces,
    observedSinceAt: toTimestamp(source?.observedSinceAt),
    totals: buildTotals(namespaces),
    updatedAt: toTimestamp(source?.updatedAt),
  };
}

export function formatMetadataProviderCacheTimestamp(timestamp) {
  const normalizedTimestamp = toTimestamp(timestamp);
  if (!normalizedTimestamp) {
    return 'Not recorded';
  }

  return new Date(normalizedTimestamp)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

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

import { formatMetadataProviderCacheTimestamp } from './metadata-provider-cache-observability-presentation.js';

const namespacePattern = /^[a-z0-9._-]{1,120}$/;

function toCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function formatPercentage(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100 ? `${value}%` : 'No samples';
}

function normalizeNamespace(namespace) {
  if (!namespacePattern.test(namespace?.cacheNamespace ?? '')) {
    return null;
  }

  return {
    activeRefreshCount: toCount(namespace.activeRefreshCount),
    cacheNamespace: namespace.cacheNamespace,
    cacheServedRatePercent: formatPercentage(namespace.cacheServedRatePercent),
    cacheStoreErrorCount: toCount(namespace.cacheStoreErrorCount),
    coldLookups: toCount(namespace.coldLookups),
    completedRefreshCount: toCount(namespace.completedRefreshCount),
    freshLookups: toCount(namespace.freshLookups),
    lastRefreshAt: formatMetadataProviderCacheTimestamp(namespace.lastRefreshAt),
    refreshFailureCount: toCount(namespace.refreshFailureCount),
    staleLookups: toCount(namespace.staleLookups),
  };
}

function formatNamespaceSummary(namespace) {
  return `- ${namespace.cacheNamespace}: lookups ${namespace.freshLookups} fresh / ${namespace.staleLookups} stale / ${namespace.coldLookups} cold; cache served ${namespace.cacheServedRatePercent}; refreshes ${namespace.completedRefreshCount} completed / ${namespace.refreshFailureCount} failed / ${namespace.activeRefreshCount} active; store errors ${namespace.cacheStoreErrorCount}; latest refresh ${namespace.lastRefreshAt}.`;
}

function normalizeBaselineNamespaces(value) {
  return Array.isArray(value)
    ? value
      .map(normalizeNamespace)
      .filter(Boolean)
      .sort((left, right) => left.cacheNamespace.localeCompare(right.cacheNamespace))
    : [];
}

/**
 * Produces a plain-text, display-safe operator record from the already
 * normalized process-local baseline. It intentionally includes no identifiers
 * beyond the fixed cache namespaces and does not read or retain clipboard data.
 */
export function formatMetadataProviderCacheBaselineCapture(baseline) {
  const namespaces = normalizeBaselineNamespaces(baseline?.namespaces);
  const totals = baseline?.totals ?? {};
  const lines = [
    'Harmoniarr Artist Detail cache baseline',
    'Scope: process-local aggregate; not fleet telemetry.',
    `Observed since (UTC): ${formatMetadataProviderCacheTimestamp(baseline?.observedSinceAt)}`,
    `Last aggregate update (UTC): ${formatMetadataProviderCacheTimestamp(baseline?.updatedAt)}`,
    `Totals: ${toCount(totals.cacheServedLookups)} cache-served of ${toCount(totals.totalLookups)} lookups (${formatPercentage(totals.cacheServedRatePercent)}); ${toCount(totals.coldLookups)} cold (${formatPercentage(totals.coldLookupRatePercent)}); ${toCount(totals.completedRefreshCount)} completed refreshes / ${toCount(totals.refreshFailureCount)} failed / ${toCount(totals.activeRefreshCount)} active; ${toCount(totals.cacheStoreErrorCount)} cache-store errors.`,
    'Namespaces:',
  ];

  if (!namespaces.length) {
    lines.push('- No provider cache activity recorded.');
  } else {
    lines.push(...namespaces.map(formatNamespaceSummary));
  }

  lines.push('This summary excludes cache keys, MBIDs, artist data, provider payloads, URLs, users, credentials, and raw errors.');
  return lines.join('\n');
}

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

const requiredMetricKeys = Object.freeze([
  'activeRefreshCount',
  'cacheStoreErrorCount',
  'coldLookups',
  'completedRefreshCount',
  'freshLookups',
  'refreshFailureCount',
  'staleLookups',
]);

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeTotals(comparison) {
  if (!comparison?.canCompare || !comparison.totals || typeof comparison.totals !== 'object') {
    return null;
  }

  const totals = {};
  for (const key of requiredMetricKeys) {
    if (!isCount(comparison.totals[key])) {
      return null;
    }
    totals[key] = comparison.totals[key];
  }

  return totals;
}

function createAssessment({ code, nextAction, summary, title, tone }) {
  return Object.freeze({
    code,
    nextAction,
    summary,
    title,
    tone,
  });
}

function createUnavailableAssessment() {
  return createAssessment({
    code: 'comparison_unavailable',
    nextAction: 'Clear the comparison start and begin a new same-process pair.',
    summary: 'The cache aggregates cannot be compared safely for this reading.',
    title: 'Pair cannot be compared',
    tone: 'warning',
  });
}

/**
 * Interprets only a validated, same-process aggregate comparison. The result
 * is a bounded operator aid, not proof that a specific artist or request was
 * cached. It deliberately excludes provider inputs, cache keys, and errors.
 */
export function assessMetadataProviderCachePairedSample(comparison) {
  const totals = normalizeTotals(comparison);
  if (!totals) {
    return createUnavailableAssessment();
  }

  const cacheServedLookups = totals.freshLookups + totals.staleLookups;
  const totalLookups = cacheServedLookups + totals.coldLookups;

  if (totals.cacheStoreErrorCount > 0) {
    return createAssessment({
      code: 'cache_store_errors_observed',
      nextAction: 'Inspect the affected cache namespace and database configuration before changing cache policy.',
      summary: 'The paired interval recorded cache-store errors, so cache reuse cannot be evaluated as healthy.',
      title: 'Cache-store errors observed',
      tone: 'danger',
    });
  }

  if (totals.refreshFailureCount > 0) {
    return createAssessment({
      code: 'refresh_failures_observed',
      nextAction: 'Inspect the affected provider and retry conditions before changing cache policy.',
      summary: 'The paired interval recorded failed refresh work, so the cache lifecycle needs investigation.',
      title: 'Refresh failures observed',
      tone: 'warning',
    });
  }

  if (totals.activeRefreshCount > 0) {
    return createAssessment({
      code: 'refresh_in_progress',
      nextAction: 'Refresh diagnostics after the active background refreshes settle.',
      summary: 'The paired interval still has refresh work in progress, so the final revalidation outcome is not ready.',
      title: 'Refresh in progress',
      tone: 'info',
    });
  }

  if (totalLookups === 0) {
    return createAssessment({
      code: 'no_cache_activity',
      nextAction: 'Open an Artist Detail Discography or related-artists flow, then refresh diagnostics.',
      summary: 'No provider-cache lookups were added after the marked comparison start.',
      title: 'No cache activity observed',
      tone: 'info',
    });
  }

  if (totals.coldLookups === 0 && totals.freshLookups > 0 && totals.staleLookups === 0) {
    return createAssessment({
      code: 'fresh_reuse_observed',
      nextAction: 'Keep the current policy and capture the sanitized aggregate only if an operator record is needed.',
      summary: 'All added lookups were fresh reads, which is consistent with same-process cache reuse.',
      title: 'Fresh cache reuse observed',
      tone: 'success',
    });
  }

  if (totals.coldLookups === 0 && totals.staleLookups > 0) {
    return createAssessment({
      code: 'stale_reuse_observed',
      nextAction: 'Refresh diagnostics after background work settles and confirm no refresh failures were added.',
      summary: 'Stale cache reads were served without a foreground load, which is consistent with SWR reuse.',
      title: 'Stale cache reuse observed',
      tone: 'info',
    });
  }

  if (totals.coldLookups > 0 && cacheServedLookups > 0) {
    return createAssessment({
      code: 'cold_then_cache_reuse_observed',
      nextAction: 'Repeat a focused pair if a particular Artist Detail flow still appears slow.',
      summary: 'The aggregate contains both foreground loads and cache-served reads, which is consistent with a cold fill followed by reuse.',
      title: 'Cold fill and cache reuse observed',
      tone: 'success',
    });
  }

  return createAssessment({
    code: 'foreground_loads_observed',
    nextAction: 'Reopen the same Artist Detail flow, then refresh diagnostics to verify a fresh read.',
    summary: 'Only foreground cache loads were added. Cache reuse is not evidenced by this pair yet.',
    title: 'Foreground loads observed',
    tone: 'info',
  });
}

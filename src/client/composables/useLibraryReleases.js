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

import { computed, getCurrentInstance, ref, watch } from 'vue';
import { isAbortError } from '../lib/abort-error.js';
import { fetchLibraryReleases as defaultFetchLibraryReleases } from '../lib/library-api.js';

/**
 * Composable that loads library releases with full stale-while-revalidate
 * semantics and AbortController race-condition protection.
 *
 * When `filterState` is provided (a reactive ref or computed ref whose value
 * is a GridFilterState), the composable watches it and re-fetches with a
 * 300ms trailing debounce. Concurrent in-flight requests are aborted via
 * AbortController so only the latest response updates the display.
 *
 * When `filterState` is null, legacy callers can still use `loadReleases()`
 * imperatively as before.
 *
 * @param {object} options
 * @param {import('vue').Ref | null} [options.filterState]   Reactive GridFilterState
 * @param {function} [options.fetchLibraryReleases]          Override for testing
 * @param {function | null} [options.setTimeoutFn]           Override for testing
 * @param {function | null} [options.clearTimeoutFn]         Override for testing
 */
export function useLibraryReleases({
  filterState = null,
  fetchLibraryReleases = defaultFetchLibraryReleases,
  setTimeoutFn = null,
  clearTimeoutFn = null,
} = {}) {
  const _setTimeout = setTimeoutFn ?? (typeof globalThis.setTimeout !== 'undefined' ? globalThis.setTimeout : null);
  const _clearTimeout = clearTimeoutFn ?? (typeof globalThis.clearTimeout !== 'undefined' ? globalThis.clearTimeout : null);

  // ── State ──────────────────────────────────────────────────────────────────

  /** Confirmed-good results from the last successful response. */
  const data = ref([]);
  /** Last successful results — kept non-null after first load for stale display. */
  const staleData = ref([]);
  const isLoading = ref(false);
  /** True until the first successful response has been received. */
  const isFirstLoad = ref(true);
  const error = ref(null);

  const isEmpty = computed(() => data.value.length === 0);

  // ── Abort / debounce bookkeeping ───────────────────────────────────────────

  let currentController = null;
  let debounceTimer = null;

  // ── Core fetch ─────────────────────────────────────────────────────────────

  /**
   * Fire a fetch for the given params. Aborts any in-flight request first.
   * @param {object} params  Query params forwarded to fetchLibraryReleases
   */
  async function _fetch(params) {
    if (currentController) {
      currentController.abort();
    }
    currentController = new AbortController();
    const signal = currentController.signal;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetchLibraryReleases({ ...params, signal });
      const releases = Array.isArray(response?.releases) ? response.releases : [];
      data.value = releases;
      staleData.value = releases;
      isFirstLoad.value = false;
    } catch (err) {
      if (isAbortError(err)) return; // Intentional cancel — discard silently
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      // Only clear loading if this controller wasn't already superseded
      if (!signal.aborted) {
        isLoading.value = false;
      }
    }
  }

  // ── filterState watcher (server-side mode) ─────────────────────────────────

  function _filterStateToParams(state) {
    if (!state) return {};
    return {
      reconciliationStatus: state.filters?.status ?? null,
      sort: state.sort?.field ?? null,
      order: state.sort?.order ?? null,
      format: state.filters?.format ?? null,
    };
  }

  if (filterState !== null && getCurrentInstance()) {
    watch(
      filterState,
      (newState) => {
        if (_clearTimeout && debounceTimer !== null) {
          _clearTimeout(debounceTimer);
        }
        if (_setTimeout) {
          debounceTimer = _setTimeout(() => {
            void _fetch(_filterStateToParams(newState));
          }, 300);
        } else {
          void _fetch(_filterStateToParams(newState));
        }
      },
      { immediate: true },
    );
  }

  // ── Imperative load (legacy / non-reactive callers) ────────────────────────

  /**
   * Manually trigger a fetch. Used by LibraryView when not in filter-state mode,
   * and by all existing callers that relied on the previous API.
   *
   * @param {object} [options]
   * @param {string|null} [options.reconciliationStatus]
   */
  async function loadReleases({ reconciliationStatus = null } = {}) {
    await _fetch({ reconciliationStatus });
  }

  /**
   * Re-fire the last query. Exposed for error-state retry buttons.
   */
  function retry() {
    if (filterState !== null) {
      void _fetch(_filterStateToParams(filterState.value));
    } else {
      void _fetch({});
    }
  }

  // ── Legacy computed aliases (backwards compat with existing views) ─────────

  const releases = data;
  const totalCount = computed(() => data.value.length);
  const completeReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'complete'));
  const partialReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'partial'));
  const duplicateReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'duplicate'));

  // Keep errorMessage for backwards compat
  const errorMessage = computed(() => error.value?.message ?? '');

  // isLoading starts false — LibraryView used to check `isLoading.value` as a
  // proxy for "first load in progress". Set it true immediately so legacy
  // views see the expected skeleton state on first render.
  isLoading.value = true;

  return {
    // New SWR API
    data,
    error,
    isEmpty,
    isFirstLoad,
    isLoading,
    retry,
    staleData,
    // Legacy API (backwards compat)
    completeReleases,
    duplicateReleases,
    errorMessage,
    loadReleases,
    partialReleases,
    releases,
    totalCount,
  };
}

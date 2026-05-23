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

export function useLibraryReleases({
  filterState = null,
  fetchLibraryReleases = defaultFetchLibraryReleases,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const data = ref([]);
  const staleData = ref([]);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const isFirstLoad = ref(true);
  const error = ref(null);

  const isEmpty = computed(() => data.value.length === 0);

  let currentController = null;
  let debounceTimer = null;
  let pollTimer = null;
  let lastParams = {};
  let destroyed = false;
  let hasLoaded = false;
  let visibilityHandler = null;

  function abortCurrent() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  }

  function clearDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function destroy() {
    destroyed = true;
    abortCurrent();
    clearDebounce();
    clearPollTimer();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function attachVisibilityListener() {
    if (visibilityHandler) {
      return;
    }
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !destroyed) {
        void revalidate();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function schedulePoll() {
    clearPollTimer();
    if (pollIntervalMs <= 0 || destroyed) {
      return;
    }
    pollTimer = setTimeout(() => {
      if (!destroyed) {
        void revalidate();
      }
    }, pollIntervalMs);
  }

  async function _fetch(params) {
    abortCurrent();
    currentController = new AbortController();
    const signal = currentController.signal;

    const isFirst = !hasLoaded;
    if (isFirst) {
      isLoading.value = true;
    } else {
      isRevalidating.value = true;
    }
    error.value = null;
    lastParams = params;

    try {
      const response = await fetchLibraryReleases({ ...params, signal });
      if (destroyed) return;

      const releases = Array.isArray(response?.releases) ? response.releases : [];
      data.value = releases;
      staleData.value = releases;
      isFirstLoad.value = false;
      hasLoaded = true;
    } catch (err) {
      if (isAbortError(err)) return;
      if (destroyed) return;
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      if (!signal.aborted && !destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    await _fetch({ ...lastParams });
  }

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
        if (destroyed) return;
        clearDebounce();
        debounceTimer = setTimeout(() => {
          if (!destroyed) {
            void _fetch(_filterStateToParams(newState));
          }
        }, 300);
      },
      { immediate: true },
    );
  }

  async function loadReleases({ reconciliationStatus = null } = {}) {
    if (destroyed) return;
    await _fetch({ reconciliationStatus });
  }

  function retry() {
    if (destroyed) return;
    void _fetch(filterState !== null ? _filterStateToParams(filterState.value) : {});
  }

  const releases = data;
  const totalCount = computed(() => data.value.length);
  const completeReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'complete'));
  const partialReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'partial'));
  const duplicateReleases = computed(() => data.value.filter((r) => r.reconciliationStatus === 'duplicate'));

  const errorMessage = computed(() => error.value?.message ?? '');

  isLoading.value = true;

  return {
    attachVisibilityListener,
    data,
    destroy,
    error,
    isEmpty,
    isFirstLoad,
    isLoading,
    isRevalidating,
    pollIntervalMs,
    revalidate,
    revalidateOnFocus,
    retry,
    staleData,
    completeReleases,
    duplicateReleases,
    errorMessage,
    loadReleases,
    partialReleases,
    releases,
    totalCount,
  };
}

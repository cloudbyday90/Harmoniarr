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

import { computed, ref } from 'vue';
import {
  sortNetworkResponses,
  totalSizeForResponse,
} from '../lib/search-presentation.js';
import {
  fetchSlskdSearchResponses as defaultFetchResponses,
  fetchSlskdSearchState as defaultFetchSearchState,
  fetchSlskdStatus as defaultFetchStatus,
  startSlskdSearch as defaultStartSearch,
} from '../lib/slskd-search-api.js';

function isSearchComplete(state) {
  return state?.isComplete
    || state?.state === 'completed'
    || state?.state === 'cancelled';
}

export function useNetworkSearchWorkflow({
  fetchResponses = defaultFetchResponses,
  fetchSearchState = defaultFetchSearchState,
  fetchStatus = defaultFetchStatus,
  pollIntervalMs = 2000,
  revalidateOnFocus = false,
  startSearch = defaultStartSearch,
} = {}) {
  const networkQuery = ref('');
  const responseLimit = ref(50);
  const minimumFileCount = ref(1);
  const isNetworkSearching = ref(false);
  const networkErrorMessage = ref('');
  const responses = ref([]);
  const searchMeta = ref(null);
  const slskdStatus = ref(null);
  const isProbingStatus = ref(false);
  const isRevalidating = ref(false);
  const hasNetworkSearched = ref(false);

  let pollTimer = null;
  let activePollToken = 0;
  let destroyed = false;
  let currentSearchId = null;
  let visibilityHandler = null;

  const sortedResponses = computed(() =>
    sortNetworkResponses(responses.value, {
      minimumFileCount: minimumFileCount.value,
    }),
  );

  const totalFiles = computed(() => {
    let total = 0;
    for (const response of responses.value) {
      if (typeof response?.fileCount === 'number') {
        total += response.fileCount;
      } else if (Array.isArray(response?.files)) {
        total += response.files.length;
      }
    }
    return total;
  });

  const totalResultBytes = computed(() => {
    let total = 0;
    for (const response of responses.value) {
      total += totalSizeForResponse(response);
    }
    return total;
  });

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function destroy() {
    destroyed = true;
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

  async function refreshStatus() {
    isProbingStatus.value = true;
    try {
      slskdStatus.value = await fetchStatus();
    } catch (error) {
      slskdStatus.value = {
        message: error?.message ?? 'Unknown error',
        state: 'error',
      };
    } finally {
      isProbingStatus.value = false;
    }
  }

  async function revalidate() {
    if (destroyed || !currentSearchId) {
      return;
    }
    isRevalidating.value = true;
    try {
      const [nextResponses, nextState] = await Promise.all([
        fetchResponses({ searchId: currentSearchId }),
        fetchSearchState({ searchId: currentSearchId }),
      ]);
      if (destroyed) {
        return;
      }
      responses.value = nextResponses;
      searchMeta.value = nextState;
      if (isSearchComplete(nextState)) {
        isNetworkSearching.value = false;
      }
    } catch {
      if (destroyed) {
        return;
      }
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
      }
    }
  }

  async function pollResponses(searchId, pollToken) {
    if (destroyed) {
      return;
    }
    try {
      const [nextResponses, nextState] = await Promise.all([
        fetchResponses({ searchId }),
        fetchSearchState({ searchId }),
      ]);

      if (pollToken !== activePollToken || destroyed) {
        return;
      }

      responses.value = nextResponses;
      searchMeta.value = nextState;

      if (isSearchComplete(nextState)) {
        isNetworkSearching.value = false;
        return;
      }

      pollTimer = setTimeout(() => {
        void pollResponses(searchId, pollToken);
      }, pollIntervalMs);
    } catch (error) {
      if (pollToken !== activePollToken || destroyed) {
        return;
      }

      networkErrorMessage.value = error?.message ?? 'Failed to poll search results';
      isNetworkSearching.value = false;
    }
  }

  async function runNetworkSearch() {
    if (destroyed) {
      return;
    }
    const trimmed = networkQuery.value.trim();
    if (!trimmed || isNetworkSearching.value) {
      return;
    }

    activePollToken += 1;
    clearPollTimer();
    networkErrorMessage.value = '';
    responses.value = [];
    searchMeta.value = null;
    isNetworkSearching.value = true;
    hasNetworkSearched.value = true;
    currentSearchId = null;

    try {
      const search = await startSearch({
        filterResponses: true,
        query: trimmed,
        responseLimit: Number(responseLimit.value) || 50,
      });
      if (destroyed) {
        return;
      }
      const searchId = search?.searchId ?? search?.id;
      if (!searchId) {
        throw new Error('slskd did not return a search identifier');
      }

      searchMeta.value = search;
      currentSearchId = searchId;
      await pollResponses(searchId, activePollToken);
    } catch (error) {
      if (destroyed) {
        return;
      }
      networkErrorMessage.value = error?.message ?? 'Failed to start search';
      isNetworkSearching.value = false;
    }
  }

  return {
    attachVisibilityListener,
    destroy,
    hasNetworkSearched,
    isNetworkSearching,
    isProbingStatus,
    isRevalidating,
    minimumFileCount,
    networkErrorMessage,
    networkQuery,
    pollIntervalMs,
    refreshStatus,
    revalidate,
    revalidateOnFocus,
    responseLimit,
    responses,
    runNetworkSearch,
    searchMeta,
    slskdStatus,
    sortedResponses,
    totalFiles,
    totalResultBytes,
  };
}

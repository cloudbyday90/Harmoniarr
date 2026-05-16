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

export function useNetworkSearchWorkflow({
  fetchResponses = defaultFetchResponses,
  fetchSearchState = defaultFetchSearchState,
  fetchStatus = defaultFetchStatus,
  schedulePoll = setTimeout,
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
  const hasNetworkSearched = ref(false);

  let pollTimer = null;
  let activePollToken = 0;

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

  async function pollResponses(searchId, pollToken) {
    try {
      const [nextResponses, nextState] = await Promise.all([
        fetchResponses({ searchId }),
        fetchSearchState({ searchId }),
      ]);

      if (pollToken !== activePollToken) {
        return;
      }

      responses.value = nextResponses;
      searchMeta.value = nextState;

      const isComplete = nextState?.isComplete
        || nextState?.state === 'completed'
        || nextState?.state === 'cancelled';

      if (isComplete) {
        isNetworkSearching.value = false;
        return;
      }

      pollTimer = schedulePoll(() => {
        void pollResponses(searchId, pollToken);
      }, 2000);
    } catch (error) {
      if (pollToken !== activePollToken) {
        return;
      }

      networkErrorMessage.value = error?.message ?? 'Failed to poll search results';
      isNetworkSearching.value = false;
    }
  }

  async function runNetworkSearch() {
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

    try {
      const search = await startSearch({
        filterResponses: true,
        query: trimmed,
        responseLimit: Number(responseLimit.value) || 50,
      });
      const searchId = search?.searchId ?? search?.id;
      if (!searchId) {
        throw new Error('slskd did not return a search identifier');
      }

      searchMeta.value = search;
      await pollResponses(searchId, activePollToken);
    } catch (error) {
      networkErrorMessage.value = error?.message ?? 'Failed to start search';
      isNetworkSearching.value = false;
    }
  }

  return {
    clearPollTimer,
    hasNetworkSearched,
    isNetworkSearching,
    isProbingStatus,
    minimumFileCount,
    networkErrorMessage,
    networkQuery,
    refreshStatus,
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

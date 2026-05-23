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
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchSystemActivityFeed as defaultFetchActivityFeed } from '../lib/system-api.js';

const emptyPageInfo = {
  hasMore: false,
  nextCursor: null,
};

export function useActivityFeedPagination({
  fetchActivityFeed = defaultFetchActivityFeed,
} = {}) {
  const entries = ref([]);
  const checkedAt = ref(null);
  const pageInfo = ref(emptyPageInfo);
  const errorMessage = ref('');
  const isLoadingMore = ref(false);

  const hasMore = computed(() => pageInfo.value.hasMore === true);

  function reset(newEntries, newCheckedAt, newPageInfo) {
    entries.value = newEntries ?? [];
    checkedAt.value = newCheckedAt ?? null;
    pageInfo.value = newPageInfo ?? emptyPageInfo;
    errorMessage.value = '';
  }

  async function loadMore() {
    if (!hasMore.value || isLoadingMore.value) {
      return;
    }

    isLoadingMore.value = true;
    errorMessage.value = '';

    try {
      const result = await fetchActivityFeed({
        before: pageInfo.value.nextCursor,
      });

      checkedAt.value = result.checkedAt ?? checkedAt.value;
      entries.value = [
        ...entries.value,
        ...(result.entries ?? []),
      ];
      pageInfo.value = result.pageInfo ?? emptyPageInfo;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Loading more activity failed.');
    } finally {
      isLoadingMore.value = false;
    }
  }

  return {
    checkedAt,
    entries,
    errorMessage,
    hasMore,
    isLoadingMore,
    loadMore,
    pageInfo,
    reset,
  };
}

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

import { computed } from 'vue';
import { fetchSystemActivityFeed as defaultFetchSystemActivityFeed } from '../lib/system-api.js';
import { useAsyncResource } from './useAsyncResource.js';

export function useActivityHistory({
  fetchSystemActivityFeed = defaultFetchSystemActivityFeed,
  limit = 100,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const {
    data: entries,
    errorMessage,
    isLoading,
    isRevalidating,
    lastRefreshedAt,
    load,
  } = useAsyncResource({
    fetcher: () => fetchSystemActivityFeed({ limit }),
    project: (payload) => (Array.isArray(payload?.entries) ? payload.entries : []),
    initialData: [],
    immediate: false,
    fallbackErrorMessage: 'Failed to load activity feed',
    pollIntervalMs,
    revalidateOnFocus,
  });

  const entryCount = computed(() => entries.value?.length ?? 0);

  return {
    entries,
    entryCount,
    errorMessage,
    isLoading,
    isRevalidating,
    lastRefreshedAt,
    load,
  };
}

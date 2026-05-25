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

import { readonly, ref, shallowRef, watch } from 'vue';
import { fetchAdminMonitoredArtists as defaultFetchFn } from '../lib/metadata-api.js';
import { useAsyncResource } from './useAsyncResource.js';

export function useAdminMonitoredArtists({
  fetchFn = defaultFetchFn,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const search = ref('');
  const sort = ref('name');

  function buildParams() {
    return {
      limit: 50,
      offset: 0,
      search: search.value || undefined,
      sort: sort.value || undefined,
    };
  }

  const {
    data: listPayload,
    destroy: destroyResource,
    errorMessage,
    isLoading,
    isRevalidating,
    load: loadResource,
    reset: resetResource,
  } = useAsyncResource({
    fetcher: () => fetchFn(buildParams()),
    project: (payload) => ({
      results: payload.results ?? [],
      total: payload.total ?? 0,
    }),
    initialData: { results: [], total: 0 },
    immediate: false,
    fallbackErrorMessage: 'Failed to load monitored artists',
    pollIntervalMs,
    revalidateOnFocus,
  });

  const artists = shallowRef([]);
  const total = ref(0);

  watch(listPayload, (payload) => {
    artists.value = payload.results;
    total.value = payload.total;
  });

  async function load() {
    await loadResource();
    artists.value = listPayload.value.results;
    total.value = listPayload.value.total;
  }

  function reset() {
    resetResource();
    artists.value = [];
    total.value = 0;
    search.value = '';
    sort.value = 'name';
  }

  function destroy() {
    destroyResource();
  }

  return {
    artists: readonly(artists),
    destroy,
    errorMessage: readonly(errorMessage),
    isLoading: readonly(isLoading),
    isRevalidating: readonly(isRevalidating),
    load,
    reset,
    search,
    sort,
    total: readonly(total),
  };
}

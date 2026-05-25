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

import { computed, readonly } from 'vue';
import { useAsyncResource } from './useAsyncResource.js';

const activeCandidateStatuses = new Set([
  'pending',
  'selected',
  'downloading',
  'import_pending',
]);

function hasActiveCandidates(candidates) {
  return Array.isArray(candidates) && candidates.some((c) => activeCandidateStatuses.has(c?.status));
}

export function useMediaRequestPipeline({
  fetchPipelineFn,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  let currentMediaRequestId = null;

  const {
    data: pipelinePayload,
    destroy: destroyResource,
    errorMessage,
    isLoading,
    isRevalidating,
    load: loadResource,
    reset: resetResource,
  } = useAsyncResource({
    fetcher: async () => {
      if (fetchPipelineFn) {
        return fetchPipelineFn({ mediaRequestId: currentMediaRequestId });
      }
      const { fetchMediaRequestPipeline } = await import('../lib/library-api.js');
      return fetchMediaRequestPipeline({ mediaRequestId: currentMediaRequestId });
    },
    project: (payload) => payload?.candidates ?? [],
    initialData: [],
    immediate: false,
    fallbackErrorMessage: 'Failed to load pipeline data',
    pollIntervalMs,
    revalidateOnFocus,
    pollWhile: (candidates) => hasActiveCandidates(candidates),
  });

  const candidates = computed(() => pipelinePayload.value);

  async function load({ mediaRequestId }) {
    if (!mediaRequestId) return;
    currentMediaRequestId = mediaRequestId;
    await loadResource();
  }

  function reset() {
    resetResource();
    currentMediaRequestId = null;
  }

  function destroy() {
    destroyResource();
  }

  return {
    candidates,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    load,
    reset,
  };
}

import { ref, shallowRef } from 'vue';

export function useMediaRequestPipeline({
  fetchPipelineFn,
} = {}) {
  const candidates = shallowRef([]);
  const isLoading = ref(false);
  const errorMessage = ref('');

  async function load({ mediaRequestId }) {
    if (!mediaRequestId) return;

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const fetcher = fetchPipelineFn ?? (async () => {
        const { fetchMediaRequestPipeline } = await import('../lib/library-api.js');
        return fetchMediaRequestPipeline({ mediaRequestId });
      });
      const payload = await fetcher({ mediaRequestId });
      candidates.value = payload?.candidates ?? [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load pipeline data';
    } finally {
      isLoading.value = false;
    }
  }

  function reset() {
    candidates.value = [];
    isLoading.value = false;
    errorMessage.value = '';
  }

  return {
    candidates,
    errorMessage,
    isLoading,
    load,
    reset,
  };
}

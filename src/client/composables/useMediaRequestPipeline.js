import { readonly, ref, shallowRef } from 'vue';

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
  const candidates = shallowRef([]);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;
  let currentMediaRequestId = null;

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!hasActiveCandidates(candidates.value)) return;

    pollTimer = setTimeout(async () => {
      if (destroyed || !currentMediaRequestId) return;
      await load({ mediaRequestId: currentMediaRequestId });
    }, pollIntervalMs);
  }

  async function load({ mediaRequestId }) {
    if (!mediaRequestId) return;
    if (destroyed) return;
    currentMediaRequestId = mediaRequestId;

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = '';

    try {
      const fetcher = fetchPipelineFn ?? (async () => {
        const { fetchMediaRequestPipeline } = await import('../lib/library-api.js');
        return fetchMediaRequestPipeline({ mediaRequestId });
      });
      const payload = await fetcher({ mediaRequestId });
      if (destroyed) return;
      candidates.value = payload?.candidates ?? [];
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load pipeline data';
      if (!isRevalidation) {
        candidates.value = [];
      }
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded || !currentMediaRequestId) return;
    void load({ mediaRequestId: currentMediaRequestId }).then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function reset() {
    candidates.value = [];
    isLoading.value = false;
    isRevalidating.value = false;
    errorMessage.value = '';
    hasLoaded = false;
    currentMediaRequestId = null;
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  return {
    attachVisibilityListener,
    candidates,
    destroy,
    errorMessage,
    isRevalidating: readonly(isRevalidating),
    isLoading,
    load,
    reset,
  };
}

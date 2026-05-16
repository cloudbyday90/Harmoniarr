import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchArtworkQuota as defaultFetchArtworkQuota } from '../lib/artwork-api.js';

export function useArtworkQuota({
  fetchArtworkQuota = defaultFetchArtworkQuota,
} = {}) {
  const errorMessage = ref('');
  const isLoading = ref(false);
  const quota = ref(null);

  const providers = computed(() => quota.value?.providers ?? []);
  const totalUsed = computed(() => quota.value?.totalUsed ?? 0);
  const limit = computed(() => quota.value?.limit ?? 0);
  const date = computed(() => quota.value?.date ?? null);
  const anyExceeded = computed(() => providers.value.some((p) => p.exceeded));

  async function loadQuota() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      quota.value = await fetchArtworkQuota();
    } catch (error) {
      quota.value = null;
      errorMessage.value = getErrorMessage(error, 'Failed to load artwork quota');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    anyExceeded,
    date,
    errorMessage,
    isLoading,
    limit,
    loadQuota,
    providers,
    quota,
    totalUsed,
  };
}

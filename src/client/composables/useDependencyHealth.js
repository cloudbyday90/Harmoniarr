import { ref } from 'vue';
import { fetchSystemOverview as defaultFetchSystemOverview } from '../lib/system-api.js';

export function useDependencyHealth({
  fetchSystemOverview = defaultFetchSystemOverview,
} = {}) {
  const dependencies = ref([]);
  const isLoading = ref(false);
  const loadError = ref('');

  async function loadDependencyHealth() {
    isLoading.value = true;
    loadError.value = '';

    try {
      const payload = await fetchSystemOverview();
      dependencies.value = Array.isArray(payload?.dependencies) ? payload.dependencies : [];
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not load dependency health';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    dependencies,
    isLoading,
    loadDependencyHealth,
    loadError,
  };
}

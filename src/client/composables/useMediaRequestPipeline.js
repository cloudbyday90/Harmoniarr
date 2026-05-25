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

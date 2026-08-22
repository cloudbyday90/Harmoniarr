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
import { fetchMetadataProviderCacheObservability as defaultFetchMetadataProviderCacheObservability } from '../lib/metadata-api.js';
import { buildMetadataProviderCacheBaseline } from '../lib/metadata-provider-cache-observability-presentation.js';
import { useAsyncResource } from './useAsyncResource.js';

/**
 * Loads the protected cache aggregate only after an administrator explicitly
 * requests it. There is deliberately no polling or client-side persistence.
 */
export function useMetadataProviderCacheBaseline({
  fetchMetadataProviderCacheObservability = defaultFetchMetadataProviderCacheObservability,
} = {}) {
  const resource = useAsyncResource({
    fallbackErrorMessage: 'Cache diagnostics failed to load',
    fetcher: fetchMetadataProviderCacheObservability,
    immediate: false,
    project: (payload) => buildMetadataProviderCacheBaseline(payload?.cache),
  });

  const isLoading = computed(() => resource.isLoading.value || resource.isRevalidating.value);

  return {
    cacheBaseline: resource.data,
    errorMessage: resource.errorMessage,
    isLoading,
    loadCacheBaseline: resource.load,
  };
}

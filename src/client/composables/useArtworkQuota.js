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

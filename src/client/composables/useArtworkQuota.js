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
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  const quota = ref(null);

  let destroyed = false;
  let hasLoaded = false;
  let pollTimer = null;
  let visibilityHandler = null;

  const providers = computed(() => quota.value?.providers ?? []);
  const totalUsed = computed(() => quota.value?.totalUsed ?? 0);
  const limit = computed(() => quota.value?.limit ?? 0);
  const date = computed(() => quota.value?.date ?? null);
  const anyExceeded = computed(() => providers.value.some((p) => p.exceeded));

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (pollIntervalMs <= 0 || destroyed) return;
    pollTimer = setTimeout(() => {
      if (!destroyed) void revalidate();
    }, pollIntervalMs);
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function attachVisibilityListener() {
    if (visibilityHandler) return;
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !destroyed) {
        void revalidate();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  async function loadQuota() {
    if (destroyed) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      quota.value = await fetchArtworkQuota();
      if (destroyed) return;
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      quota.value = null;
      errorMessage.value = getErrorMessage(error, 'Failed to load artwork quota');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    const isFirst = !hasLoaded;
    if (isFirst) {
      isLoading.value = true;
    } else {
      isRevalidating.value = true;
    }
    try {
      const result = await fetchArtworkQuota();
      if (destroyed) return;
      quota.value = result;
      hasLoaded = true;
    } catch {
      if (destroyed) return;
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    anyExceeded,
    attachVisibilityListener,
    date,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating,
    limit,
    loadQuota,
    pollIntervalMs,
    providers,
    quota,
    revalidate,
    revalidateOnFocus,
    totalUsed,
  };
}

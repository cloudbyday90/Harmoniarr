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

import { readonly, ref } from 'vue';
import {
  fetchMediaRequests as defaultFetchMediaRequests,
  fetchMediaRequestSummary as defaultFetchMediaRequestSummary,
} from '../lib/library-api.js';

export function useOperatorRequests({
  fetchMediaRequests = defaultFetchMediaRequests,
  fetchMediaRequestSummary = defaultFetchMediaRequestSummary,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const mediaRequests = ref([]);
  const requestSummary = ref(null);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

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
    if (!requestSummary.value && mediaRequests.value.length === 0) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadRequests();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadRequests().then(() => {
      if (!destroyed) schedulePoll();
    });
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

  async function loadRequests() {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      const [summaryPayload, requestsPayload] = await Promise.all([
        fetchMediaRequestSummary({ scope: 'mine' }),
        fetchMediaRequests({ scope: 'mine' }),
      ]);
      requestSummary.value = summaryPayload;
      mediaRequests.value = requestsPayload.mediaRequests ?? [];
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        requestSummary.value = null;
        mediaRequests.value = [];
      }
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load requests';
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    attachVisibilityListener,
    destroy,
    errorMessage: readonly(errorMessage),
    isLoading: readonly(isLoading),
    isRevalidating: readonly(isRevalidating),
    loadRequests,
    mediaRequests: readonly(mediaRequests),
    requestSummary: readonly(requestSummary),
  };
}

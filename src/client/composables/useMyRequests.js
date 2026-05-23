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
import { fetchMyMediaRequests as defaultFetchMyMediaRequests } from '../lib/media-request-api.js';

const activeFulfillmentCodes = new Set(['downloading', 'import_pending', 'queued']);

function hasActiveFulfillment(requests) {
  return Array.isArray(requests) && requests.some((r) => activeFulfillmentCodes.has(r?.fulfillmentStatus?.code));
}

/**
 * Composable that loads the current user's submitted media requests with
 * optional SWR (stale-while-revalidate) polling.
 *
 * The caller is responsible for triggering `loadRequests()` — typically from
 * the view's own `onMounted` hook — and for calling `destroy()` in
 * `onBeforeUnmount`.
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - Maximum number of requests to load.
 * @param {function} [options.fetchRequests] - Override for testing.
 * @param {number} [options.pollIntervalMs=0] - SWR poll interval. Polls only
 *   while visible requests have active fulfillment. Default 0 (disabled).
 */
export function useMyRequests({
  limit = 50,
  fetchRequests = defaultFetchMyMediaRequests,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const requests = ref([]);
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;

  const hasRequests = computed(() => requests.value.length > 0);

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (!hasActiveFulfillment(requests.value)) return;
    if (destroyed) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadRequests();
    }, pollIntervalMs);
  }

  async function loadRequests({ signal } = {}) {
    if (destroyed) return;

    const isRevalidation = requests.value.length > 0;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = '';

    try {
      const payload = await fetchRequests({ limit, signal });
      if (destroyed) return;
      requests.value = Array.isArray(payload?.mediaRequests) ? payload.mediaRequests : [];
    } catch (error) {
      if (destroyed) return;
      if (!isRevalidation) {
        requests.value = [];
      }
      errorMessage.value = getErrorMessage(error, 'Could not load your requests.');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed) return;
    if (!hasActiveFulfillment(requests.value)) return;
    void loadRequests().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchRequests({ limit });
      if (destroyed) return;
      requests.value = Array.isArray(payload?.mediaRequests) ? payload.mediaRequests : [];
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    attachVisibilityListener,
    destroy,
    errorMessage,
    hasRequests,
    isLoading,
    isRevalidating,
    loadRequests,
    requests,
    revalidate,
  };
}

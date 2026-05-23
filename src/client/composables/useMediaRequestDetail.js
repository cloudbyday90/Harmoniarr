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

import { readonly, ref, shallowRef } from 'vue';
import { fetchMediaRequestDetail as defaultFetchDetail, fetchMediaRequestEvents as defaultFetchEvents } from '../lib/library-api.js';

const activeFulfillmentCodes = new Set([
  'downloading',
  'import_pending',
  'queued',
  'needs_fetch',
  'searching',
  'selected',
]);

function hasActiveFulfillment(mediaRequest) {
  const code = mediaRequest?.fulfillmentStatus?.code;
  return activeFulfillmentCodes.has(code);
}

export function useMediaRequestDetail({
  fetchDetailFn = defaultFetchDetail,
  fetchEventsFn = defaultFetchEvents,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const mediaRequest = shallowRef(null);
  const events = shallowRef([]);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  const hasMoreEvents = ref(false);
  const isLoadingMoreEvents = ref(false);
  const nextCursor = ref(null);
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
    if (!hasActiveFulfillment(mediaRequest.value)) return;

    pollTimer = setTimeout(async () => {
      if (destroyed || !currentMediaRequestId) return;
      await load({ mediaRequestId: currentMediaRequestId });
    }, pollIntervalMs);
  }

  async function load({ mediaRequestId }) {
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
      const payload = await fetchDetailFn({ mediaRequestId });
      if (destroyed) return;
      mediaRequest.value = payload.mediaRequest ?? null;
      events.value = payload.events ?? [];
      hasMoreEvents.value = payload.hasMoreEvents ?? false;
      nextCursor.value = payload.nextCursor ?? null;
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load request';
      if (!isRevalidation) {
        mediaRequest.value = null;
        events.value = [];
        hasMoreEvents.value = false;
        nextCursor.value = null;
      }
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function loadMoreEvents({ mediaRequestId }) {
    if (!nextCursor.value || isLoadingMoreEvents.value) return;
    isLoadingMoreEvents.value = true;
    try {
      const payload = await fetchEventsFn({ mediaRequestId, cursor: nextCursor.value });
      events.value = [...events.value, ...(payload.events ?? [])];
      hasMoreEvents.value = payload.hasMore ?? false;
      nextCursor.value = payload.nextCursor ?? null;
    } catch {
      // silently ignore load-more failures
    } finally {
      isLoadingMoreEvents.value = false;
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded || !currentMediaRequestId) return;
    void load({ mediaRequestId: currentMediaRequestId }).then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function reset() {
    mediaRequest.value = null;
    events.value = [];
    errorMessage.value = '';
    hasMoreEvents.value = false;
    isLoadingMoreEvents.value = false;
    nextCursor.value = null;
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
    destroy,
    errorMessage: readonly(errorMessage),
    events: readonly(events),
    hasMoreEvents: readonly(hasMoreEvents),
    isLoading: readonly(isLoading),
    isLoadingMoreEvents: readonly(isLoadingMoreEvents),
    isRevalidating: readonly(isRevalidating),
    load,
    loadMoreEvents,
    mediaRequest: readonly(mediaRequest),
    reset,
  };
}

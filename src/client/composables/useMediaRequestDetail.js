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

import { computed, readonly, ref, shallowRef, watch } from 'vue';
import { fetchMediaRequestDetail as defaultFetchDetail, fetchMediaRequestEvents as defaultFetchEvents } from '../lib/library-api.js';
import { useAsyncResource } from './useAsyncResource.js';

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
  let currentMediaRequestId = null;

  const {
    data: detailPayload,
    destroy: destroyResource,
    errorMessage,
    isLoading,
    isRevalidating,
    load: loadDetail,
    reset: resetDetail,
  } = useAsyncResource({
    fetcher: () => fetchDetailFn({ mediaRequestId: currentMediaRequestId }),
    project: (payload) => ({
      mediaRequest: payload.mediaRequest ?? null,
      events: payload.events ?? [],
      hasMoreEvents: payload.hasMoreEvents ?? false,
      nextCursor: payload.nextCursor ?? null,
    }),
    initialData: { mediaRequest: null, events: [], hasMoreEvents: false, nextCursor: null },
    immediate: false,
    fallbackErrorMessage: 'Failed to load request',
    pollIntervalMs,
    revalidateOnFocus,
    pollWhile: (data) => hasActiveFulfillment(data.mediaRequest),
  });

  const mediaRequest = computed(() => detailPayload.value.mediaRequest);

  const events = shallowRef([]);
  const hasMoreEvents = ref(false);
  const isLoadingMoreEvents = ref(false);
  const nextCursor = ref(null);

  watch(detailPayload, (payload) => {
    events.value = payload.events;
    hasMoreEvents.value = payload.hasMoreEvents;
    nextCursor.value = payload.nextCursor;
  });

  function syncEventsFromPayload() {
    events.value = detailPayload.value.events;
    hasMoreEvents.value = detailPayload.value.hasMoreEvents;
    nextCursor.value = detailPayload.value.nextCursor;
  }

  async function load({ mediaRequestId }) {
    currentMediaRequestId = mediaRequestId;
    await loadDetail();
    syncEventsFromPayload();
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
    } finally {
      isLoadingMoreEvents.value = false;
    }
  }

  function reset() {
    resetDetail();
    currentMediaRequestId = null;
    events.value = [];
    hasMoreEvents.value = false;
    isLoadingMoreEvents.value = false;
    nextCursor.value = null;
  }

  function destroy() {
    destroyResource();
  }

  return {
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

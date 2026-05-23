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

export function useMediaRequestDetail({
  fetchDetailFn = defaultFetchDetail,
  fetchEventsFn = defaultFetchEvents,
} = {}) {
  const mediaRequest = shallowRef(null);
  const events = shallowRef([]);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const hasMoreEvents = ref(false);
  const isLoadingMoreEvents = ref(false);
  const nextCursor = ref(null);

  async function load({ mediaRequestId }) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchDetailFn({ mediaRequestId });
      mediaRequest.value = payload.mediaRequest ?? null;
      events.value = payload.events ?? [];
      hasMoreEvents.value = payload.hasMoreEvents ?? false;
      nextCursor.value = payload.nextCursor ?? null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load request';
    } finally {
      isLoading.value = false;
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

  function reset() {
    mediaRequest.value = null;
    events.value = [];
    errorMessage.value = '';
    hasMoreEvents.value = false;
    isLoadingMoreEvents.value = false;
    nextCursor.value = null;
  }

  return {
    errorMessage: readonly(errorMessage),
    events: readonly(events),
    hasMoreEvents: readonly(hasMoreEvents),
    isLoading: readonly(isLoading),
    isLoadingMoreEvents: readonly(isLoadingMoreEvents),
    load,
    loadMoreEvents,
    mediaRequest: readonly(mediaRequest),
    reset,
  };
}

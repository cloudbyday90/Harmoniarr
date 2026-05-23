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
import { fetchMediaRequestDetail as defaultFetchDetail } from '../lib/library-api.js';

export function useMediaRequestDetail({
  fetchDetailFn = defaultFetchDetail,
} = {}) {
  const mediaRequest = shallowRef(null);
  const events = shallowRef([]);
  const isLoading = ref(false);
  const errorMessage = ref('');

  async function load({ mediaRequestId }) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchDetailFn({ mediaRequestId });
      mediaRequest.value = payload.mediaRequest ?? null;
      events.value = payload.events ?? [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load request';
    } finally {
      isLoading.value = false;
    }
  }

  function reset() {
    mediaRequest.value = null;
    events.value = [];
    errorMessage.value = '';
  }

  return {
    errorMessage: readonly(errorMessage),
    events: readonly(events),
    isLoading: readonly(isLoading),
    load,
    mediaRequest: readonly(mediaRequest),
    reset,
  };
}

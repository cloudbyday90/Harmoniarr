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

/**
 * Composable that loads the current user's submitted media requests.
 *
 * The caller is responsible for triggering `loadRequests()` — typically from
 * the view's own `onMounted` hook — so this composable remains testable under
 * Node without a component instance.
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - Maximum number of requests to load.
 * @param {function} [options.fetchRequests] - Override for testing.
 */
export function useMyRequests({
  limit = 50,
  fetchRequests = defaultFetchMyMediaRequests,
} = {}) {
  const requests = ref([]);
  const isLoading = ref(true);
  const errorMessage = ref('');

  const hasRequests = computed(() => requests.value.length > 0);

  /**
   * Load the current user's requests. Clears any previous error before
   * fetching. On failure, stale requests are cleared so the view can show the
   * error state clearly.
   *
   * @param {object} [options]
   * @param {AbortSignal} [options.signal] - Optional abort signal.
   */
  async function loadRequests({ signal } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchRequests({ limit, signal });
      requests.value = Array.isArray(payload?.mediaRequests) ? payload.mediaRequests : [];
    } catch (error) {
      requests.value = [];
      errorMessage.value = getErrorMessage(error, 'Could not load your requests.');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    hasRequests,
    isLoading,
    loadRequests,
    requests,
  };
}

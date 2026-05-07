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

import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchMyRequestSummary as defaultFetchMyRequestSummary } from '../lib/media-request-api.js';

/**
 * Composable that loads the current user's request notification feed.
 *
 * Derives delegated-request receipts, fulfillment progress updates, and failure
 * notifications from the shared media-request-summary endpoint scoped to the
 * current user. The caller triggers `load()` — typically from the view's own
 * `onMounted` hook — so this composable remains testable under Node without a
 * component instance.
 *
 * @param {object} [options]
 * @param {function} [options.fetchSummaryFn] - Override for testing.
 */
export function useMyRequestNotifications({
  fetchSummaryFn = defaultFetchMyRequestSummary,
} = {}) {
  const notifications = ref([]);
  const counts = ref({ byCategory: { delegated_request: 0, failure: 0, fulfillment: 0, review: 0 }, total: 0 });
  const checkedAt = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');

  /**
   * Load the notification feed for the current user's requests. Clears any
   * previous error before fetching. On failure, reactive state is reset to
   * empty so the view can show the error state clearly.
   *
   * @param {object} [options]
   * @param {AbortSignal} [options.signal] - Optional abort signal.
   */
  async function load({ signal } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchSummaryFn({ signal });
      const feed = payload?.notificationFeed ?? null;
      notifications.value = Array.isArray(feed?.notifications) ? feed.notifications : [];
      counts.value = feed?.counts ?? { byCategory: { delegated_request: 0, failure: 0, fulfillment: 0, review: 0 }, total: 0 };
      checkedAt.value = feed?.checkedAt ?? null;
    } catch (error) {
      notifications.value = [];
      counts.value = { byCategory: { delegated_request: 0, failure: 0, fulfillment: 0, review: 0 }, total: 0 };
      checkedAt.value = null;
      errorMessage.value = getErrorMessage(error, 'Could not load request notifications.');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    checkedAt,
    counts,
    errorMessage,
    isLoading,
    load,
    notifications,
  };
}

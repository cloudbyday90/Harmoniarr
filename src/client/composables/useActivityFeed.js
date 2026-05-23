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
import { fetchActivityFeed as defaultFetchActivityFeed } from '../lib/activity-api.js';
import { normalizeActivityEvent } from '../lib/activity-event-normalization.js';

export function useActivityFeed({
  fetchFeedFn = defaultFetchActivityFeed,
  limit = 50,
} = {}) {
  const events = ref([]);
  const checkedAt = ref(null);
  const total = ref(0);
  const isLoading = ref(false);
  const errorMessage = ref('');

  const hasEvents = computed(() => events.value.length > 0);
  const isEmpty = computed(() => !isLoading.value && !hasEvents.value && !errorMessage.value);

  async function load({ signal, eventType = null } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchFeedFn({ limit, eventType, signal });
      events.value = Array.isArray(payload?.events)
        ? payload.events.map(normalizeActivityEvent)
        : [];
      checkedAt.value = payload?.checkedAt ?? null;
      total.value = typeof payload?.total === 'number' ? payload.total : events.value.length;
    } catch (error) {
      events.value = [];
      checkedAt.value = null;
      total.value = 0;
      errorMessage.value = getErrorMessage(error, 'Could not load activity feed.');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    checkedAt,
    errorMessage,
    events,
    hasEvents,
    isEmpty,
    isLoading,
    load,
    total,
  };
}

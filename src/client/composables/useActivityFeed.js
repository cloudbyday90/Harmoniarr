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
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const events = ref([]);
  const checkedAt = ref(null);
  const total = ref(0);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const hasEvents = computed(() => events.value.length > 0);
  const isEmpty = computed(() => !isLoading.value && !hasEvents.value && !errorMessage.value);

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

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await load();
    }, pollIntervalMs);
  }

  async function load({ signal, eventType = null } = {}) {
    if (destroyed) return;

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = '';

    try {
      const payload = await fetchFeedFn({ limit, eventType, signal });
      if (destroyed) return;
      events.value = Array.isArray(payload?.events)
        ? payload.events.map(normalizeActivityEvent)
        : [];
      checkedAt.value = payload?.checkedAt ?? null;
      total.value = typeof payload?.total === 'number' ? payload.total : events.value.length;
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      if (!isRevalidation) {
        events.value = [];
        checkedAt.value = null;
        total.value = 0;
      }
      errorMessage.value = getErrorMessage(error, 'Could not load activity feed.');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void load().then(() => {
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

  return {
    attachVisibilityListener,
    checkedAt,
    destroy,
    errorMessage,
    events,
    hasEvents,
    isEmpty,
    isLoading,
    isRevalidating,
    load,
    total,
  };
}

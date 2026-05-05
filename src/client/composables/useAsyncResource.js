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

import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Shared async-resource composable used by Activity list views and other
 * read-only panels.
 *
 * Owns the repeated `{ isLoading, errorMessage, data, load() }` pattern so
 * individual views describe only how to fetch and how to project the response.
 *
 * @param {object} options
 * @param {() => Promise<unknown>} options.fetcher Resolves the raw API payload.
 * @param {(payload: unknown) => unknown} [options.project] Maps the payload to
 *   the value stored on `data`. Defaults to identity.
 * @param {unknown} [options.initialData] Initial value for `data` before the
 *   first successful fetch (default `null`).
 * @param {boolean} [options.immediate] Load on mount (default `true`).
 * @param {number} [options.pollIntervalMs] When set, schedules a recurring
 *   `load()` while the component is mounted.
 * @param {string} [options.fallbackErrorMessage]
 */
export function useAsyncResource({
  fetcher,
  project = (payload) => payload,
  initialData = null,
  immediate = true,
  pollIntervalMs = null,
  fallbackErrorMessage = 'Request failed',
} = {}) {
  if (typeof fetcher !== 'function') {
    throw new TypeError('useAsyncResource requires a fetcher function');
  }

  const isLoading = ref(immediate);
  const errorMessage = ref('');
  const data = ref(initialData);
  const lastRefreshedAt = ref(null);
  let pollTimer = null;
  let unmounted = false;

  async function load() {
    if (unmounted) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetcher();
      if (unmounted) return;
      data.value = project(payload);
      lastRefreshedAt.value = new Date().toISOString();
    } catch (error) {
      if (unmounted) return;
      errorMessage.value = error?.message ?? fallbackErrorMessage;
      data.value = initialData;
    } finally {
      if (!unmounted) {
        isLoading.value = false;
      }
    }
  }

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    clearPollTimer();
    pollTimer = setTimeout(async () => {
      await load();
      if (!unmounted) schedulePoll();
    }, pollIntervalMs);
  }

  onMounted(async () => {
    if (immediate) {
      await load();
    } else {
      isLoading.value = false;
    }
    schedulePoll();
  });

  onBeforeUnmount(() => {
    unmounted = true;
    clearPollTimer();
  });

  return {
    data,
    errorMessage,
    isLoading,
    lastRefreshedAt,
    load,
  };
}

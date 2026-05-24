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
 * Shared async-resource composable implementing stale-while-revalidate
 * semantics for read-only panels and list views.
 *
 * Owns the repeated `{ isLoading, isRevalidating, errorMessage, data, load() }`
 * pattern so individual views describe only how to fetch and how to project
 * the response.
 *
 * SWR behaviour:
 * - First load shows `isLoading = true` (no stale data).
 * - Subsequent revalidations (poll, focus) set `isRevalidating = true`
 *   while keeping stale `data` visible — the UI can show a subtle indicator
 *   without a loading skeleton.
 * - `pollWhile(data) => boolean` allows conditional polling: the timer
 *   continues only while the guard returns true. When it returns false,
 *   polling pauses until the next `load()` call makes it true again.
 * - `revalidateOnFocus` triggers a background revalidation when the
 *   browser tab regains visibility.
 *
 * @param {object} options
 * @param {() => Promise<unknown>} options.fetcher Resolves the raw API payload.
 * @param {(payload: unknown) => unknown} [options.project] Maps the payload to
 *   the value stored on `data`. Defaults to identity.
 * @param {unknown} [options.initialData] Initial value for `data` before the
 *   first successful fetch (default `null`).
 * @param {boolean} [options.immediate] Load on mount (default `true`).
 * @param {number} [options.pollIntervalMs] When set, schedules a recurring
 *   `load()` while the component is mounted and `pollWhile` returns true.
 * @param {(data: unknown) => boolean} [options.pollWhile] Guard checked after
 *   each load. When it returns false, polling pauses until re-enabled.
 * @param {boolean} [options.revalidateOnFocus] Revalidate when the browser
 *   tab becomes visible again (default `false`).
 * @param {string} [options.fallbackErrorMessage]
 */
export function useAsyncResource({
  fetcher,
  project = (payload) => payload,
  initialData = null,
  immediate = true,
  pollIntervalMs = null,
  pollWhile = null,
  revalidateOnFocus = false,
  fallbackErrorMessage = 'Request failed',
} = {}) {
  if (typeof fetcher !== 'function') {
    throw new TypeError('useAsyncResource requires a fetcher function');
  }

  const isLoading = ref(immediate);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  const data = ref(initialData);
  const lastRefreshedAt = ref(null);
  let pollTimer = null;
  let unmounted = false;
  let hasLoaded = false;

  async function load() {
    if (unmounted) return;

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = '';

    try {
      const payload = await fetcher();
      if (unmounted) return;
      data.value = project(payload);
      lastRefreshedAt.value = new Date().toISOString();
      hasLoaded = true;
    } catch (error) {
      if (unmounted) return;
      errorMessage.value = error?.message ?? fallbackErrorMessage;
      if (!isRevalidation) {
        data.value = initialData;
      }
    } finally {
      if (!unmounted) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function shouldPoll() {
    if (!pollIntervalMs || pollIntervalMs <= 0) return false;
    if (typeof pollWhile === 'function') return pollWhile(data.value);
    return true;
  }

  function schedulePoll() {
    if (!shouldPoll()) return;
    clearPollTimer();
    pollTimer = setTimeout(async () => {
      await load();
      if (!unmounted) schedulePoll();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (document.hidden || unmounted || !hasLoaded) return;
    void load().then(() => {
      if (!unmounted) schedulePoll();
    });
  }

  onMounted(async () => {
    if (immediate) {
      await load();
    } else {
      isLoading.value = false;
    }
    schedulePoll();

    if (revalidateOnFocus) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  onBeforeUnmount(() => {
    unmounted = true;
    clearPollTimer();
    if (revalidateOnFocus) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  function destroy() {
    unmounted = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function reset() {
    clearPollTimer();
    data.value = initialData;
    errorMessage.value = '';
    hasLoaded = false;
    isLoading.value = false;
    isRevalidating.value = false;
    lastRefreshedAt.value = null;
  }

  return {
    data,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating,
    lastRefreshedAt,
    load,
    reset,
  };
}

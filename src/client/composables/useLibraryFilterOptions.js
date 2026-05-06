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

import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue';
import { fetchLibraryFilterOptions as defaultFetchLibraryFilterOptions } from '../lib/library-api.js';

const POLL_INTERVAL_MS = 60_000;

/**
 * Composable that fetches the dynamic filter options for the Library view
 * and keeps them fresh via a 60-second background poll.
 *
 * Returns `{ options }` where `options.value` is null until the first response
 * arrives, then takes the shape `{ formats: string[], genres: string[] }`.
 *
 * The background poll is non-blocking and fires no loading state — callers
 * should simply render with null options (no filter panel) until data arrives.
 *
 * Injectable `fetchOptions` and `setIntervalFn`/`clearIntervalFn` are provided
 * for full testability under Node without a component instance.
 *
 * @param {object} [options]
 * @param {function} [options.fetchOptions]       Override for testing
 * @param {function|null} [options.setIntervalFn] Override for testing
 * @param {function|null} [options.clearIntervalFn] Override for testing
 */
export function useLibraryFilterOptions({
  fetchOptions = defaultFetchLibraryFilterOptions,
  setIntervalFn = null,
  clearIntervalFn = null,
} = {}) {
  const _setInterval =
    setIntervalFn ?? (typeof globalThis.setInterval !== 'undefined' ? globalThis.setInterval : null);
  const _clearInterval =
    clearIntervalFn ??
    (typeof globalThis.clearInterval !== 'undefined' ? globalThis.clearInterval : null);

  /** @type {import('vue').Ref<{formats: string[], genres: string[]} | null>} */
  const options = ref(null);

  let intervalHandle = null;

  async function _poll() {
    try {
      const result = await fetchOptions();
      options.value = result ?? null;
    } catch {
      // Background poll failures are silent — stale options remain visible
    }
  }

  if (getCurrentInstance()) {
    onMounted(async () => {
      await _poll();
      if (_setInterval) {
        intervalHandle = _setInterval(_poll, POLL_INTERVAL_MS);
      }
    });

    onUnmounted(() => {
      if (intervalHandle !== null && _clearInterval) {
        _clearInterval(intervalHandle);
        intervalHandle = null;
      }
    });
  }

  return {
    options,
    // Exposed for testing
    _poll,
  };
}

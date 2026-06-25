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

import { onBeforeUnmount, watch } from 'vue';
import { resolveSearchDispatch } from '../lib/search-dispatch.js';

/**
 * Debounced typeahead layer for Discover search.
 *
 * Wraps `useDiscoverSearch`: watches the shared `query` ref and dispatches a
 * search after a quiet typing period, with a minimum interval between dispatches
 * (MusicBrainz asks for ~1 request/second) and AbortController cancellation so a
 * newer search always supersedes an in-flight one. The pure gating decision
 * lives in `search-dispatch.js`; this composable owns only timing and the
 * abort lifecycle. An explicit `submit()` bypasses the debounce/rate cap for the
 * press-enter fallback.
 *
 * @param {{ query: import('vue').Ref<string>, runSearch: (opts?: { signal?: AbortSignal }) => Promise<void> }} search
 *   The `useDiscoverSearch` return value (shared query + cancellable runSearch).
 * @param {object} [options]
 * @param {number} [options.quietMs=350] - Quiet typing period before dispatch.
 * @param {number} [options.minLength=2] - Minimum trimmed query length.
 * @param {number} [options.minIntervalMs=1000] - Minimum ms between dispatches.
 * @returns {{ submit: () => void }}
 */
export function useDebouncedSearch(search, options = {}) {
  const { query, runSearch } = search;
  const quietMs = options.quietMs ?? 350;
  const minLength = options.minLength ?? 2;
  const minIntervalMs = options.minIntervalMs ?? 1000;

  let debounceTimer = null;
  let controller = null;
  let lastDispatched = '';
  let lastDispatchAt = 0;

  function clearTimer() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  // Abort any in-flight search and start a fresh cancellable one for the query.
  function dispatch() {
    controller?.abort();
    controller = new AbortController();
    lastDispatched = query.value.trim();
    lastDispatchAt = Date.now();
    void runSearch({ signal: controller.signal });
  }

  // Runs when the quiet period elapses; applies the pure gating decision.
  function evaluate() {
    debounceTimer = null;
    const decision = resolveSearchDispatch({
      query: query.value,
      lastQuery: lastDispatched,
      minLength,
      minIntervalMs,
      elapsedMs: Date.now() - lastDispatchAt,
    });
    if (decision.dispatch) {
      dispatch();
      return;
    }
    // Rate-limited: defer until the window clears, then re-evaluate the same
    // query. 'short' / 'unchanged' are dropped silently.
    if (decision.reason === 'rate-limited' && decision.deferMs > 0) {
      debounceTimer = setTimeout(evaluate, decision.deferMs);
    }
  }

  function schedule() {
    clearTimer();
    debounceTimer = setTimeout(evaluate, quietMs);
  }

  // Typeahead: re-arm the debounce on every keystroke.
  watch(
    () => query.value,
    () => {
      schedule();
    },
  );

  // Press-enter fallback: search now, bypassing debounce and the rate cap (the
  // user asked explicitly), but still honoring the minimum length.
  function submit() {
    clearTimer();
    const trimmed = query.value.trim();
    if (trimmed.length < (minLength > 0 ? minLength : 1)) {
      return;
    }
    dispatch();
  }

  onBeforeUnmount(() => {
    clearTimer();
    controller?.abort();
  });

  return { submit };
}

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

/**
 * Reactive CSS media query watcher.
 *
 * Designed for testability: pass `matchMediaFn` to inject a mock instead of
 * relying on `window.matchMedia`.  Returns a `cleanup` function that must be
 * called in `onBeforeUnmount` to remove the change listener.  If no
 * `matchMediaFn` is resolvable (e.g. SSR / test environments that opt out),
 * `matches` stays `false` and `cleanup` is a safe no-op.
 *
 * @param {object} [options]
 * @param {string} [options.query='(max-width: 640px)']  CSS media query string.
 * @param {Function|null} [options.matchMediaFn]         Injectable matchMedia.
 * @returns {{ matches: import('vue').Ref<boolean>, cleanup: () => void }}
 */
export function useBreakpoint({
  query = '(max-width: 640px)',
  matchMediaFn = null,
} = {}) {
  const matches = ref(false);

  // Resolve the media-query function: explicit injection wins, then window.
  const mq = matchMediaFn
    ? matchMediaFn(query)
    : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null;

  if (!mq) {
    return { matches, cleanup: () => {} };
  }

  matches.value = mq.matches;

  function handler(event) {
    matches.value = event.matches;
  }

  mq.addEventListener('change', handler);

  function cleanup() {
    mq.removeEventListener('change', handler);
  }

  return { matches, cleanup };
}

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

import { ref, computed } from 'vue';

/**
 * Detects horizontal scroll overflow for a tab bar element so the template
 * can apply fade-mask classes without JavaScript-free hacks.
 *
 * Designed for testability: pass injectable helpers instead of relying on
 * globals.  The composable intentionally avoids Vue lifecycle hooks so it can
 * be unit-tested outside a component context.
 *
 * Usage in a component:
 *
 *   const tabbarRef = ref(null);
 *   const { hasOverflowStart, hasOverflowEnd, attach, cleanup } = useTabbarOverflow();
 *   onMounted(() => attach(tabbarRef.value));
 *   onUnmounted(cleanup);
 *
 * @param {object} [options]
 * @param {Function} [options.addScrollListenerFn]    Inject scroll listener attachment.
 * @param {Function} [options.removeScrollListenerFn] Inject scroll listener removal.
 * @param {Function|null} [options.ResizeObserverCtor] Inject ResizeObserver constructor (or null to skip).
 * @returns {{ hasOverflowStart: import('vue').ComputedRef<boolean>,
 *             hasOverflowEnd:   import('vue').ComputedRef<boolean>,
 *             attach:  (el: HTMLElement|null) => void,
 *             cleanup: () => void }}
 */
export function useTabbarOverflow({
  addScrollListenerFn = (el, fn) => el.addEventListener('scroll', fn, { passive: true }),
  removeScrollListenerFn = (el, fn) => el.removeEventListener('scroll', fn),
  ResizeObserverCtor = (typeof ResizeObserver !== 'undefined' ? ResizeObserver : null),
} = {}) {
  const scrollLeft = ref(0);
  const scrollWidth = ref(0);
  const clientWidth = ref(0);

  // 0.5px tolerance suppresses sub-pixel float rounding at the scroll end
  // without hiding genuine 1px+ overflows that warrant a fade affordance.
  const hasOverflowStart = computed(() => scrollLeft.value > 0);
  const hasOverflowEnd = computed(
    () => scrollLeft.value + clientWidth.value < scrollWidth.value - 0.5,
  );

  let _el = null;
  let _scrollHandler = null;
  let _observer = null;

  function _readElement(el) {
    scrollLeft.value = el.scrollLeft;
    scrollWidth.value = el.scrollWidth;
    clientWidth.value = el.clientWidth;
  }

  /**
   * Attach to a DOM element.  Call from `onMounted` with the element ref value.
   * Safe to call with null (no-op).
   *
   * @param {HTMLElement|null} el
   */
  function attach(el) {
    if (!el) return;
    _el = el;
    _readElement(el);

    _scrollHandler = () => _readElement(el);
    addScrollListenerFn(el, _scrollHandler);

    if (ResizeObserverCtor) {
      _observer = new ResizeObserverCtor(() => _readElement(el));
      _observer.observe(el);
    }
  }

  /**
   * Remove all event listeners and disconnect any ResizeObserver.
   * Call from `onUnmounted`.  Safe to call multiple times.
   */
  function cleanup() {
    if (_el && _scrollHandler) {
      removeScrollListenerFn(_el, _scrollHandler);
    }
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    _el = null;
    _scrollHandler = null;
  }

  return { hasOverflowStart, hasOverflowEnd, attach, cleanup };
}

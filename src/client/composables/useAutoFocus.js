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

import { nextTick, onMounted } from 'vue';

/**
 * Focuses an element ref after the component mounts and Vue has flushed its
 * DOM updates. Safe to call with a ref whose element may not yet exist (the
 * optional-chain guard prevents errors).
 *
 * Designed for testability: inject `onMountedFn` and `nextTickFn` to run the
 * focus logic synchronously in unit tests without a real DOM or Vue lifecycle.
 *
 * @param {import('vue').Ref<HTMLElement|null>} elementRef
 * @param {object} [options]
 * @param {Function} [options.onMountedFn]  Defaults to Vue's `onMounted`.
 * @param {Function} [options.nextTickFn]   Defaults to Vue's `nextTick`.
 */
export function useAutoFocus(elementRef, {
  onMountedFn = onMounted,
  nextTickFn = nextTick,
} = {}) {
  onMountedFn(() => {
    void nextTickFn().then(() => {
      elementRef.value?.focus();
    });
  });
}

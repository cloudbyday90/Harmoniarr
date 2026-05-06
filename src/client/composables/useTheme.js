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

import { computed, getCurrentInstance, onUnmounted, ref } from 'vue';

const STORAGE_KEY = 'hx-theme-preference';

const VALID_PREFERENCES = /** @type {const} */ (['system', 'light', 'dark']);

function isValidPreference(value) {
  return VALID_PREFERENCES.includes(value);
}

/**
 * Factory composable that manages the three-way theme preference.
 *
 * All dependencies are injectable for testability — no direct access to
 * `window`, `localStorage`, or `document` in the pure logic path.
 *
 * @param {object} [deps]
 * @param {{ getItem(key: string): string|null, setItem(key: string, value: string): void }|null} [deps.storage]
 * @param {() => boolean} [deps.getSystemDark]
 * @param {(callback: (isDark: boolean) => void) => () => void} [deps.subscribeToSystemDark]
 * @param {(resolvedTheme: 'light'|'dark') => void} [deps.applyToDocument]
 */
export function useTheme({
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  getSystemDark = () =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  subscribeToSystemDark = (callback) => {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => callback(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  },
  applyToDocument = (resolvedTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  },
} = {}) {
  const stored = storage?.getItem(STORAGE_KEY) ?? null;
  const initialPreference = isValidPreference(stored) ? stored : 'system';

  /** @type {import('vue').Ref<'system'|'light'|'dark'>} */
  const preference = ref(initialPreference);

  const systemIsDark = ref(getSystemDark());

  /** @type {import('vue').ComputedRef<'light'|'dark'>} */
  const resolvedTheme = computed(() => {
    if (preference.value === 'dark') return 'dark';
    if (preference.value === 'light') return 'light';
    return systemIsDark.value ? 'dark' : 'light';
  });

  /**
   * Set the theme preference and persist it to storage.
   * @param {'system'|'light'|'dark'} value
   */
  function setPreference(value) {
    if (!isValidPreference(value)) return;
    preference.value = value;
    storage?.setItem(STORAGE_KEY, value);
    applyToDocument(resolvedTheme.value);
  }

  // Apply the resolved theme immediately on construction.
  applyToDocument(resolvedTheme.value);

  // Subscribe to system preference changes.
  const unsubscribe = subscribeToSystemDark((isDark) => {
    systemIsDark.value = isDark;
    // Only re-apply to document when in system mode.
    if (preference.value === 'system') {
      applyToDocument(resolvedTheme.value);
    }
  });

  // Only register cleanup if inside a Vue component context.
  if (getCurrentInstance()) {
    onUnmounted(() => {
      unsubscribe();
    });
  }

  return {
    preference,
    resolvedTheme,
    setPreference,
  };
}

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

/**
 * The localStorage key under which the user's theme preference is persisted.
 */
export const THEME_STORAGE_KEY = 'hx-theme-preference';

/**
 * The exhaustive set of valid theme preference values.
 * - `'system'` — follow the OS/browser colour-scheme preference
 * - `'light'`  — always use the light theme
 * - `'dark'`   — always use the dark theme
 */
export const VALID_THEME_PREFERENCES = /** @type {const} */ (['system', 'light', 'dark']);

/**
 * Returns true when `value` is a valid theme preference string.
 * All other values — including null, undefined, empty string, and
 * unrecognised strings — return false.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidThemePreference(value) {
  return VALID_THEME_PREFERENCES.includes(value);
}

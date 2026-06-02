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

export const LIBRARY_DISPLAY_MODE_STORAGE_KEY = 'harmoniarr:library:display-mode:v1';
export const DEFAULT_LIBRARY_DISPLAY_MODE = 'grid';
export const LIBRARY_DISPLAY_MODE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'grid', label: 'Grid' }),
  Object.freeze({ value: 'list', label: 'List' }),
]);

const VALID_DISPLAY_MODES = new Set(LIBRARY_DISPLAY_MODE_OPTIONS.map((option) => option.value));

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeLibraryDisplayMode(value, fallback = DEFAULT_LIBRARY_DISPLAY_MODE) {
  const normalizedFallback = VALID_DISPLAY_MODES.has(fallback)
    ? fallback
    : DEFAULT_LIBRARY_DISPLAY_MODE;
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';

  return VALID_DISPLAY_MODES.has(normalizedValue) ? normalizedValue : normalizedFallback;
}

export function readLibraryDisplayModePreference({
  key = LIBRARY_DISPLAY_MODE_STORAGE_KEY,
  storage,
} = {}) {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) {
    return DEFAULT_LIBRARY_DISPLAY_MODE;
  }

  try {
    return normalizeLibraryDisplayMode(resolvedStorage.getItem(key));
  } catch {
    return DEFAULT_LIBRARY_DISPLAY_MODE;
  }
}

export function writeLibraryDisplayModePreference(
  mode,
  {
    key = LIBRARY_DISPLAY_MODE_STORAGE_KEY,
    storage,
  } = {},
) {
  const normalizedMode = normalizeLibraryDisplayMode(mode);
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) {
    return normalizedMode;
  }

  try {
    resolvedStorage.setItem(key, normalizedMode);
  } catch {
    // Preference persistence is best-effort. Rendering should continue.
  }

  return normalizedMode;
}

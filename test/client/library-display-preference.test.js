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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LIBRARY_DISPLAY_MODE,
  LIBRARY_DISPLAY_MODE_OPTIONS,
  LIBRARY_DISPLAY_MODE_STORAGE_KEY,
  normalizeLibraryDisplayMode,
  readLibraryDisplayModePreference,
  writeLibraryDisplayModePreference,
} from '../../src/client/lib/library-display-preference.js';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    valueFor(key) {
      return values.get(key);
    },
  };
}

test('LIBRARY_DISPLAY_MODE_OPTIONS exposes grid and list modes', () => {
  assert.deepEqual(
    LIBRARY_DISPLAY_MODE_OPTIONS.map((option) => option.value),
    ['grid', 'list'],
  );
  assert.ok(Object.isFrozen(LIBRARY_DISPLAY_MODE_OPTIONS));
  assert.ok(Object.isFrozen(LIBRARY_DISPLAY_MODE_OPTIONS[0]));
});

test('normalizeLibraryDisplayMode accepts known values', () => {
  assert.equal(normalizeLibraryDisplayMode('grid'), 'grid');
  assert.equal(normalizeLibraryDisplayMode('list'), 'list');
});

test('normalizeLibraryDisplayMode trims and normalizes case', () => {
  assert.equal(normalizeLibraryDisplayMode(' LIST '), 'list');
});

test('normalizeLibraryDisplayMode falls back to grid for unknown values', () => {
  assert.equal(normalizeLibraryDisplayMode('table'), DEFAULT_LIBRARY_DISPLAY_MODE);
  assert.equal(normalizeLibraryDisplayMode(null), DEFAULT_LIBRARY_DISPLAY_MODE);
});

test('normalizeLibraryDisplayMode honors a valid custom fallback', () => {
  assert.equal(normalizeLibraryDisplayMode('table', 'list'), 'list');
});

test('normalizeLibraryDisplayMode ignores an invalid custom fallback', () => {
  assert.equal(normalizeLibraryDisplayMode('table', 'cards'), DEFAULT_LIBRARY_DISPLAY_MODE);
});

test('readLibraryDisplayModePreference returns persisted mode', () => {
  const storage = createMemoryStorage({
    [LIBRARY_DISPLAY_MODE_STORAGE_KEY]: 'list',
  });

  assert.equal(readLibraryDisplayModePreference({ storage }), 'list');
});

test('readLibraryDisplayModePreference falls back when storage is absent', () => {
  assert.equal(readLibraryDisplayModePreference({ storage: null }), DEFAULT_LIBRARY_DISPLAY_MODE);
});

test('readLibraryDisplayModePreference falls back when storage throws', () => {
  const storage = {
    getItem() {
      throw new Error('storage unavailable');
    },
  };

  assert.equal(readLibraryDisplayModePreference({ storage }), DEFAULT_LIBRARY_DISPLAY_MODE);
});

test('writeLibraryDisplayModePreference writes the normalized mode', () => {
  const storage = createMemoryStorage();
  const written = writeLibraryDisplayModePreference(' LIST ', { storage });

  assert.equal(written, 'list');
  assert.equal(storage.valueFor(LIBRARY_DISPLAY_MODE_STORAGE_KEY), 'list');
});

test('writeLibraryDisplayModePreference falls back for invalid mode values', () => {
  const storage = createMemoryStorage();
  const written = writeLibraryDisplayModePreference('table', { storage });

  assert.equal(written, DEFAULT_LIBRARY_DISPLAY_MODE);
  assert.equal(storage.valueFor(LIBRARY_DISPLAY_MODE_STORAGE_KEY), DEFAULT_LIBRARY_DISPLAY_MODE);
});

test('writeLibraryDisplayModePreference does not throw when storage is unavailable', () => {
  const storage = {
    setItem() {
      throw new Error('storage unavailable');
    },
  };

  assert.equal(writeLibraryDisplayModePreference('list', { storage }), 'list');
});

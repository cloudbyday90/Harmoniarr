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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const GRID_CONTROLS_PATH = new URL('../../src/client/components/GridControls.vue', import.meta.url);
const GRID_CONTROL_CONSUMER_PATHS = [
  new URL('../../src/client/views/LibraryView.vue', import.meta.url),
  new URL('../../src/client/views/MyRequestsView.vue', import.meta.url),
  new URL('../../src/client/components/home/RequesterHomePanel.vue', import.meta.url),
  new URL('../../src/client/components/home/OperatorHomePanel.vue', import.meta.url),
];

test('GridControls clear-all action emits a semantic clearAll event', async () => {
  const source = await readFile(GRID_CONTROLS_PATH, 'utf8');

  assert.match(source, /defineEmits\(\['update:modelValue', 'clearAll'\]\)/);
  assert.match(source, /function clearAll\(\) \{\s*emit\('clearAll'\);\s*\}/);
});

test('GridControls consumers route clear-all through useGridState.clearAll', async () => {
  for (const path of GRID_CONTROL_CONSUMER_PATHS) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /clearAll,/, `${path.pathname} should read clearAll from useGridState`);
    assert.match(source, /@clear-all="clearAll"/, `${path.pathname} should handle GridControls clear-all`);
  }
});

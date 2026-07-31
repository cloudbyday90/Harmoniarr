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

const VIEWS = [
  'SettingsConnectionsView.vue',
  'SettingsMediaStorageView.vue',
  'SettingsLibraryView.vue',
];

test('primary Settings views separate load failure from retryable save state', async () => {
  for (const viewName of VIEWS) {
    const source = await readFile(new URL(`../../src/client/views/${viewName}`, import.meta.url), 'utf8');

    assert.match(source, /import SettingsSaveBar from '\.\.\/components\/settings\/SettingsSaveBar\.vue'/);
    assert.match(source, /import \{ buildSettingsSaveState \} from '\.\.\/lib\/settings-save-state-presentation\.js'/);
    assert.match(source, /v-else-if="loadErrorMessage"/);
    assert.match(source, /<SettingsSaveBar :save-state="settingsSaveState"/);
    assert.doesNotMatch(source, /cfg-save-bar/);
  }
});

test('connections moves the one saved-provider test action into the save state footer', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsConnectionsView.vue', import.meta.url), 'utf8');

  assert.match(source, /const requiresConnectionVerification = ref\(false\)/);
  assert.match(source, /requiresVerification: requiresConnectionVerification\.value/);
  assert.match(source, /:show-test-action="!requiresConnectionVerification"/);
  assert.match(source, /<SettingsSaveBar :save-state="settingsSaveState" @verify="testProviderConnection" \/>/);
});

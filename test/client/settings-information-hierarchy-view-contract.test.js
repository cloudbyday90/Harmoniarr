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

const VIEW_NAMES = [
  'SettingsConnectionsView.vue',
  'SettingsGeneralView.vue',
  'SettingsLibraryView.vue',
  'SettingsMediaStorageView.vue',
];

test('primary Settings views use shared semantic form groups and a single save action', async () => {
  for (const viewName of VIEW_NAMES) {
    const source = await readFile(new URL(`../../src/client/views/${viewName}`, import.meta.url), 'utf8');

    assert.match(source, /import SettingsFormGroup from '\.\.\/components\/settings\/SettingsFormGroup\.vue'/);
    assert.match(source, /<SettingsFormGroup/);
    assert.match(source, /<SettingsSaveBar :save-state="settingsSaveState"/);
    assert.doesNotMatch(source, /cfg-save-bar/);
  }
});

test('SettingsFormGroup semantically associates its title and controls', async () => {
  const source = await readFile(new URL('../../src/client/components/settings/SettingsFormGroup.vue', import.meta.url), 'utf8');

  assert.match(source, /<fieldset class="settings-form-group">/);
  assert.match(source, /<legend class="settings-form-group__legend">/);
  assert.match(source, /core: 'Main setup'/);
});

test('Settings disclosures keep compact visible actions and descriptive accessible names', async () => {
  const source = await readFile(new URL('../../src/client/components/settings/SettingsDisclosure.vue', import.meta.url), 'utf8');

  assert.match(source, /actionStyle/);
  assert.match(source, /category/);
  assert.match(source, /:aria-label="actionAriaLabel"/);
  assert.match(source, /return isOpen\.value \? 'Hide' : 'Show';/);
});

test('the hierarchy marks advanced and optional areas without repeating category words in titles', async () => {
  const connections = await readFile(new URL('../../src/client/views/SettingsConnectionsView.vue', import.meta.url), 'utf8');
  const general = await readFile(new URL('../../src/client/views/SettingsGeneralView.vue', import.meta.url), 'utf8');
  const library = await readFile(new URL('../../src/client/views/SettingsLibraryView.vue', import.meta.url), 'utf8');
  const media = await readFile(new URL('../../src/client/views/SettingsMediaStorageView.vue', import.meta.url), 'utf8');

  assert.match(general, /category="advanced"/);
  assert.match(connections, /category="advanced"/);
  assert.match(connections, /category="optional"/);
  assert.match(library, /category="advanced"/);
  assert.match(media, /category="advanced"/);
  assert.match(media, /category="optional"/);
  assert.doesNotMatch(library, /title="Advanced library controls"/);
  assert.doesNotMatch(connections, /title="Optional music-source connections"/);
});

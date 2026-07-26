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
import { buildSettingsSetupSteps } from '../../src/client/lib/settings-setup-presentation.js';

const DISCLOSURE_PATH = new URL('../../src/client/components/settings/SettingsDisclosure.vue', import.meta.url);
const WORKSPACE_PATH = new URL('../../src/client/views/SettingsWorkspaceView.vue', import.meta.url);
const ROUTER_PATH = new URL('../../src/client/router.js', import.meta.url);

test('SettingsDisclosure uses a semantic disclosure button and preserves hidden form input', async () => {
  const source = await readFile(DISCLOSURE_PATH, 'utf8');

  assert.match(source, /type="button"/);
  assert.match(source, /:aria-controls="panelId"/);
  assert.match(source, /:aria-expanded="isOpen"/);
  assert.match(source, /v-show="isOpen"/);
  assert.match(source, /role="region"/);
  assert.match(source, /<slot \/>/);
});

test('Settings setup prioritizes a healthy Soulseek connection without exposing connection secrets', () => {
  const [soulseek] = buildSettingsSetupSteps({
    dependencies: [{
      message: 'Soulseek is reachable.',
      provider: 'slskd',
      status: 'healthy',
    }],
  });

  assert.deepEqual(soulseek, {
    copy: 'Soulseek is reachable.',
    id: 'soulseek',
    label: 'Manage connection',
    routeName: 'settings-connections',
    status: 'Ready',
    title: 'Connect Soulseek',
    tone: 'success',
  });
  assert.doesNotMatch(JSON.stringify(soulseek), /api.?key|base.?url|secret/i);
});

test('Settings setup makes a disabled Soulseek provider actionable', () => {
  const [soulseek] = buildSettingsSetupSteps({
    dependencies: [{ provider: 'slskd', status: 'disabled' }],
  });

  assert.equal(soulseek.label, 'Choose provider mode');
  assert.equal(soulseek.routeName, 'settings-connections');
  assert.equal(soulseek.status, 'Optional');
  assert.equal(soulseek.tone, 'info');
});

test('Settings workspace keeps common setup in primary navigation and reveals specialist routes explicitly', async () => {
  const source = await readFile(WORKSPACE_PATH, 'utf8');

  assert.match(source, /const primaryTabs = \[/);
  assert.match(source, /\{ name: 'settings', label: 'Setup' \}/);
  assert.match(source, /\{ name: 'settings-connections', label: 'Connections' \}/);
  assert.match(source, /const secondaryTabs = \[/);
  assert.match(source, /\{ name: 'settings-general', label: 'System & security' \}/);
  assert.match(source, /aria-controls="settings-more-navigation"/);
  assert.match(source, /v-show="isMoreSettingsOpen"/);
});

test('Settings default route opens the setup overview and retains a direct system route', async () => {
  const source = await readFile(ROUTER_PATH, 'utf8');

  assert.match(source, /const SettingsSetupView = \(\) => import\('\.\/views\/SettingsSetupView\.vue'\)/);
  assert.match(source, /\{ path: '', name: 'settings', component: SettingsSetupView \}/);
  assert.match(source, /\{ path: 'system', name: 'settings-general', component: SettingsGeneralView \}/);
});

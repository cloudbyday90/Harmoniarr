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
import { buildSettingsSetupOverview, buildSettingsSetupSteps } from '../../src/client/lib/settings-setup-presentation.js';

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
  assert.match(source, /defineEmits\(\['update:open'\]\)/);
  assert.match(source, /const isControlled = computed\(\(\) => typeof props\.open === 'boolean'\)/);
  assert.match(source, /emit\('update:open', nextValue\)/);
});

test('Media and storage leads with required folders and keeps supporting controls disclosed', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsMediaStorageView.vue', import.meta.url), 'utf8');

  assert.ok(source.indexOf('>Media folders<') < source.indexOf('title="Cover art"'));
  assert.match(source, /<SettingsFolderReadiness :validation="pathValidation" \/>/);
  assert.match(source, /<SettingsRecoveryConfirmation :confirmation="recoveryConfirmation" \/>/);
  assert.match(source, /buildSettingsFolderRecoveryConfirmation/);
  assert.match(source, /@submit\.prevent="handleSaveSettings"/);
  assert.match(source, /v-model:open="isPathTranslationsOpen"/);
  assert.match(source, /title="Additional folders"/);
  assert.match(source, /title="Artwork provider usage"/);
  assert.match(source, /isPathTranslationsOpen\.value = true/);
});

test('Library groups specialist tuning behind a single advanced boundary with nested headings', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsLibraryView.vue', import.meta.url), 'utf8');

  assert.match(source, /title="Library controls"/);
  assert.match(source, /show-label="Show advanced library controls"/);
  assert.match(source, /panel-id="settings-library-match-ranking"[\s\S]*?:heading-level="3"/);
  assert.match(source, /panel-id="settings-library-audio-verification"[\s\S]*?:heading-level="3"/);
  assert.ok(source.indexOf('title="Library controls"') < source.indexOf('panel-id="settings-library-source-safety"'));
});

test('Settings disclosures allow nested sections to use a logical heading level', async () => {
  const source = await readFile(DISCLOSURE_PATH, 'utf8');

  assert.match(source, /headingLevel/);
  assert.match(source, /const headingTag = computed\(\(\) => `h\$\{props\.headingLevel\}`\)/);
  assert.match(source, /<component :is="headingTag"/);
});

test('System and security leads with saved posture and isolates routine system controls', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsGeneralView.vue', import.meta.url), 'utf8');

  assert.match(source, /buildSecurityConfigurationPosture/);
  assert.match(source, />Security configuration</);
  assert.match(source, /Saved deployment settings only/);
  assert.match(source, />Remote access protections</);
  assert.match(source, /title="System controls"/);
  assert.match(source, /show-label="Show advanced system controls"/);
  assert.ok(source.indexOf('>Security configuration<') < source.indexOf('title="System controls"'));
});

test('Users and access leads with account posture and scopes maintenance by task', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsUsersView.vue', import.meta.url), 'utf8');

  assert.match(source, /buildUsersAccessPosture/);
  assert.match(source, />Account access</);
  assert.match(source, /title="Add a user"/);
  assert.match(source, /title="Manage access"/);
  assert.match(source, /title="Sign-in recovery"/);
  assert.match(source, /title="Plex account maintenance"/);
  assert.match(source, /loadPlexUserImportPreview,/);
  assert.ok(source.indexOf('>Account access<') < source.indexOf('title="Plex account maintenance"'));
});

test('Account leads with current sign-in posture and scopes security and preferences by task', async () => {
  const source = await readFile(new URL('../../src/client/views/AccountSecurityView.vue', import.meta.url), 'utf8');

  assert.match(source, /buildAccountSecurityPosture/);
  assert.match(source, />Account safety</);
  assert.match(source, />Security tasks</);
  assert.match(source, /title="Change password"/);
  assert.match(source, /title="Signed-in devices"/);
  assert.match(source, /title="Recent security activity"/);
  assert.match(source, />Preferences</);
  assert.match(source, /title="Appearance"/);
  assert.match(source, /title="Notifications"/);
  assert.ok(source.indexOf('>Account safety<') < source.indexOf('title="Signed-in devices"'));
});

test('Backup and restore leads with recovery posture and scopes destructive work by task', async () => {
  const source = await readFile(new URL('../../src/client/views/RecoveryWorkspaceView.vue', import.meta.url), 'utf8');

  assert.match(source, /buildSettingsRecoveryPosture/);
  assert.match(source, />Recovery status</);
  assert.match(source, />Recovery tasks</);
  assert.match(source, /title="Review backup history"/);
  assert.match(source, /title="Restore a backup"/);
  assert.match(source, /title="Recovery maintenance"/);
  assert.match(source, /title="Recovery diagnostics"/);
  assert.match(source, /title="Backup file actions"/);
  assert.ok(source.indexOf('>Recovery status<') < source.indexOf('title="Restore a backup"'));
});

test('Folder readiness presents saved checks before optional validation detail', async () => {
  const source = await readFile(new URL('../../src/client/components/settings/SettingsFolderReadiness.vue', import.meta.url), 'utf8');

  assert.match(source, />Folder readiness</);
  assert.match(source, /role="status"/);
  assert.match(source, /title="Folder validation details"/);
  assert.match(source, /formatPathValidationNote\(validation\?\.notes\?\.remoteSlskdValidation\)/);
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
    copy: 'Soulseek is connected and ready for searches and downloads.',
    id: 'soulseek',
    label: 'Test saved connection',
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

  assert.equal(soulseek.label, 'Choose a download mode');
  assert.equal(soulseek.routeName, 'settings-connections');
  assert.equal(soulseek.status, 'Downloads off');
  assert.equal(soulseek.tone, 'info');
});

test('Settings setup prioritizes a missing Managed deployment over generic dependency health', () => {
  const [soulseek] = buildSettingsSetupSteps({
    dependencies: [{
      message: 'Soulseek is connected and ready for downloads.',
      provider: 'slskd',
      status: 'healthy',
    }],
    setupProgress: {
      soulseek: { managedDeploymentMissing: true },
    },
  });

  assert.deepEqual(soulseek, {
    copy: 'The managed Soulseek deployment is not available yet. Finish its Docker setup, then save and test the connection.',
    id: 'soulseek',
    label: 'Finish managed setup',
    routeName: 'settings-connections',
    status: 'Setup needed',
    title: 'Connect Soulseek',
    tone: 'warning',
  });
});

test('Settings setup treats healthy folder validation as a core readiness prerequisite', () => {
  const overview = buildSettingsSetupOverview({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: {
      folders: {
        downloadsConfigured: true,
        musicConfigured: true,
        validationStatus: 'healthy',
      },
    },
  });

  assert.equal(overview.coreSteps.find((step) => step.id === 'folders').status, 'Ready');
  assert.equal(overview.optionalSteps[0].title, 'Choose library behavior');
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

test('Settings setup loads safe readiness progress and keeps optional configuration disclosed', async () => {
  const source = await readFile(new URL('../../src/client/views/SettingsSetupView.vue', import.meta.url), 'utf8');

  assert.match(source, /useSettingsSetupProgress/);
  assert.match(source, /buildSettingsSetupOverview/);
  assert.match(source, /setupProgressError/);
  assert.match(source, /SettingsSetupNextAction/);
  assert.match(source, /SettingsSetupTaskList/);
  assert.match(source, /void refreshSetup\(\)/);
  assert.match(source, /await Promise\.all\(\[/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /label="Required setup tasks"/);
  assert.match(source, /category="optional"/);
  assert.match(source, /title="Library preferences"/);
  assert.match(source, /show-label="Review optional setup"/);
});

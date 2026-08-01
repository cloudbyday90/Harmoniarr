/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const VIEW_PATH = new URL('../../src/client/views/SettingsConnectionsView.vue', import.meta.url);

test('SettingsConnectionsView keeps saved provider status beside the Soulseek setup controls', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /isLoading: isTestingProviderConnection/);
  assert.match(source, /useSoulseekConnectionStatus/);
  assert.match(source, /loadConnectionStatus/);
  assert.match(source, /import \{ useToast \} from '\.\.\/composables\/useToast\.js'/);
  assert.match(source, /const toast = useToast\(\);/);
  assert.match(source, /import SettingsProviderConnectionStatus from '\.\.\/components\/settings\/SettingsProviderConnectionStatus\.vue'/);
  assert.match(source, /<SettingsProviderConnectionStatus/);
  assert.match(source, /@test="testProviderConnection"/);
  assert.match(source, /buildSettingsSoulseekProviderState/);
  assert.doesNotMatch(source, /useDependencyHealth/);
  assert.doesNotMatch(source, /Connection test failed: \$\{/);
});

test('SettingsConnectionsView exposes explicit managed, external, and disabled provider modes', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /Soulseek provider mode/);
  assert.match(source, /value="managed"/);
  assert.match(source, /value="external"/);
  assert.match(source, /value="disabled"/);
  assert.match(source, /v-if="isExternalSoulseek"/);
  assert.match(source, /SoulseekProviderModeGuidance/);
  assert.match(source, /for="settings-slskd-service-address"/);
});

test('SettingsConnectionsView keeps optional service setup and timing controls behind named disclosures', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /import SettingsDisclosure from '\.\.\/components\/settings\/SettingsDisclosure\.vue'/);
  assert.match(source, /title="Connection behavior"/);
  assert.match(source, /title="Music-source connections"/);
  assert.match(source, /panel-id="settings-optional-music-sources"/);
});

test('SettingsConnectionsView confirms an allowlisted recovery context after connection changes or a connection test', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /@submit\.prevent="handleSaveSettings"/);
  assert.match(source, /await refreshProviderRepairConfirmation\(\);/);
  assert.match(source, /buildSettingsProviderRecoveryConfirmation/);
  assert.match(source, /resolveSettingsRecoveryContext\(route\.query\)/);
  assert.match(source, /SettingsRecoveryConfirmation/);
  assert.match(source, /if \(isProviderRecoveryReturn\.value\)/);
});

test('SettingsConnectionsView passes the bounded provider state to the local status component', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /:provider-state="soulseekProviderState"/);
  assert.match(source, /:is-testing="isTestingProviderConnection"/);
});

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

test('SettingsConnectionsView exposes a saved-provider connection test action', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /isLoading: isTestingProviderHealth/);
  assert.match(source, /loadError: providerHealthError/);
  assert.match(source, /import \{ useToast \} from '\.\.\/composables\/useToast\.js'/);
  assert.match(source, /const toast = useToast\(\);/);
  assert.match(source, /@click="testProviderConnection"/);
  assert.match(source, /isTestingProviderHealth \? 'Testing…' : 'Test connection'/);
  assert.match(source, /toast\.success\(slskdStatus\.message \?\? 'Soulseek connection is healthy\.'\)/);
  assert.match(source, /toast\.error\(`Connection test failed: \$\{providerHealthError\.value\}`\)/);
});

test('SettingsConnectionsView refreshes provider health after saved connection changes', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /useConnections\(\{\s*onSaveSuccess:/);
  assert.match(source, /void loadDependencyHealth\(\);/);
});

test('SettingsConnectionsView renders provider health load failures in the health card', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-if="providerHealth\.length \|\| providerHealthError"/);
  assert.match(source, /v-if="providerHealthError">\{\{ providerHealthError \}\}/);
});

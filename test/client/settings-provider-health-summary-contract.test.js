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

const COMPONENT_PATH = new URL('../../src/client/components/settings/SettingsProviderHealthSummary.vue', import.meta.url);

test('SettingsProviderHealthSummary keeps the saved test action and specialist service details progressively disclosed', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /Saved connection status/);
  assert.match(source, /Checks the connection currently saved in Harmoniarr\./);
  assert.match(source, /Testing saved connection…/);
  assert.match(source, /Test saved connection/);
  assert.match(source, /Save changes before testing a new address or API key\./);
  assert.match(source, /title="Other service status"/);
  assert.match(source, /show-label="Show other service status"/);
  assert.match(source, /variant="inline"/);
  assert.match(source, /role="alert"/);
});

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

const baselinePanelUrl = new URL('../../src/client/components/MetadataProviderCacheBaselinePanel.vue', import.meta.url);

test('MetadataProviderCacheBaselinePanel keeps baseline capture and paired comparison explicit, bounded, and status-announced', async () => {
  const source = await readFile(baselinePanelUrl, 'utf8');

  assert.match(source, /formatMetadataProviderCacheBaselineCapture/);
  assert.match(source, /writePlainTextToClipboard/);
  assert.match(source, /async function copyBaselineSummary/);
  assert.match(source, /Copy baseline summary/);
  assert.match(source, /Mark comparison start/);
  assert.match(source, /Clear comparison start/);
  assert.match(source, /Paired sample comparison/);
  assert.match(source, /comparison_process_window_changed/);
  assert.match(source, /role="status"/);
  assert.doesNotMatch(source, /indexedDB|localStorage|readText|sessionStorage|clipboard\.read/);
});

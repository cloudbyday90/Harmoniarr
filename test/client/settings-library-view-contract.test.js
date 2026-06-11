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

const VIEW_PATH = new URL('../../src/client/views/SettingsLibraryView.vue', import.meta.url);

test('SettingsLibraryView imports and invokes useSettingsForm with loadSettings in onMounted', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /import \{ useSettingsForm \} from '\.\.\/composables\/useSettingsForm\.js'/);
  assert.match(source, /useSettingsForm\(\)/);
  assert.match(source, /onMounted\(\(\) => \{ void loadSettings\(\); \}\)/);
});

test('SettingsLibraryView renders the Discovery scheduling form in the default branch', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<form @submit\.prevent="saveSettings" v-else>/);
  assert.match(source, /<h3 class="hx-card-title">Discovery scheduling<\/h3>/);
  assert.match(source, /Control how often Harmoniarr searches/);
});

test('SettingsLibraryView hides the form when in error state', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-else-if="errorMessage && !successMessage"/);
  assert.match(source, /<h3 class="hx-card-title">Settings unavailable<\/h3>/);
});

test('SettingsLibraryView wires all four fields to form.library.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model\.number="form\.library\.discoveryCooldownHours"/);
  assert.match(source, /v-model\.number="form\.library\.discoveryFallbackCooldownHours"/);
  assert.match(source, /v-model\.number="form\.library\.discoveryBatchSize"/);
  assert.match(source, /v-model\.number="form\.library\.maxSearchAttempts"/);
});

test('SettingsLibraryView constrains inputs to validator ranges', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /discoveryCooldownHours.*min="1" max="168" step="1"/, 'cooldown hours must allow 1-168');
  assert.match(source, /discoveryFallbackCooldownHours.*min="1" max="168" step="1"/, 'fallback hours must allow 1-168');
  assert.match(source, /discoveryBatchSize.*min="1" max="50" step="1"/, 'batch size must allow 1-50');
  assert.match(source, /maxSearchAttempts.*min="1" max="10" step="1"/, 'max attempts must allow 1-10');
});

test('SettingsLibraryView labels all fields with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Automatic cooldown \(hours\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Fallback cooldown \(hours\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Batch size<\/label>/);
  assert.match(source, /<label class="hx-field-label">Max search attempts<\/label>/);
});

test('SettingsLibraryView submits through saveSettings with save-state feedback', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /@submit\.prevent="saveSettings"/);
  assert.match(source, /:disabled="isSaving"/);
  assert.match(source, /cfg-save-msg is-error/);
  assert.match(source, /cfg-save-msg is-success/);
  assert.match(source, /isSaving \? 'Saving\.\.\.' : 'Save settings'/);
});

test('SettingsLibraryView renders loading state before settings are fetched', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-if="isLoading"/);
  assert.match(source, /Loading settings\.\.\./);
});

test('SettingsLibraryView renders the Download scoring weights card', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /Download scoring weights/);
  assert.match(source, /Control how much each quality factor contributes/);
});

test('SettingsLibraryView wires all eight scoring fields to form.scoring.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model\.number="form\.scoring\.weightFormatTier"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightCandidateTrackMatch"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightAudioDepth"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightDuration"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightFormatConsistency"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightTrackCount"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightPeerDelivery"/);
  assert.match(source, /v-model\.number="form\.scoring\.weightUploaderReputation"/);
});

test('SettingsLibraryView constrains scoring inputs to validator ranges', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /weightFormatTier[^]*min="0\.01" max="1" step="0\.01"/);
});

test('SettingsLibraryView includes a scoring sum indicator', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /scoringSum/);
  assert.match(source, /scoringSum\.toFixed\(2\)/);
});

test('SettingsLibraryView includes a reset to defaults button for scoring', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /resetScoringDefaults/);
  assert.match(source, /Reset to defaults/);
});

test('SettingsLibraryView labels all eight scoring fields with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Format tier<\/label>/);
  assert.match(source, /<label class="hx-field-label">Track match<\/label>/);
  assert.match(source, /<label class="hx-field-label">Audio depth<\/label>/);
  assert.match(source, /<label class="hx-field-label">Duration<\/label>/);
  assert.match(source, /<label class="hx-field-label">Format consistency<\/label>/);
  assert.match(source, /<label class="hx-field-label">Track count<\/label>/);
  assert.match(source, /<label class="hx-field-label">Peer delivery<\/label>/);
  assert.match(source, /<label class="hx-field-label">Uploader reputation<\/label>/);
});

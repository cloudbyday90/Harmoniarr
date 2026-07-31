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
  assert.match(source, /Recommended timing and automatic download behavior/);
});

test('SettingsLibraryView hides the form only when its initial load fails', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-else-if="loadErrorMessage"/);
  assert.match(source, /<h3 class="hx-card-title">Settings unavailable<\/h3>/);
});

test('SettingsLibraryView wires discovery fields and automation toggle to form.library.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model="form\.library\.autoStartDownloadsAfterSelection"/);
  assert.match(source, /v-model\.number="form\.library\.discoveryCooldownHours"/);
  assert.match(source, /v-model\.number="form\.library\.discoveryFallbackCooldownHours"/);
  assert.match(source, /v-model\.number="form\.library\.discoveryBatchSize"/);
  assert.match(source, /v-model\.number="form\.library\.maxSearchAttempts"/);
  assert.match(source, /Automatically start download runs for high-confidence selections/);
  assert.match(source, /Other matches remain in Music Queue for review/);
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

  assert.match(source, /<label class="hx-field-label" for="settings-library-discovery-cooldown">First retry \(hours\)<\/label>/);
  assert.match(source, /<label class="hx-field-label" for="settings-library-discovery-fallback-cooldown">Later retries \(hours\)<\/label>/);
  assert.match(source, /<label class="hx-field-label" for="settings-library-discovery-batch-size">Batch size<\/label>/);
  assert.match(source, /<label class="hx-field-label" for="settings-library-max-search-attempts">Max search attempts<\/label>/);
});

test('SettingsLibraryView submits through saveSettings with save-state feedback', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /@submit\.prevent="saveSettings"/);
  assert.match(source, /import SettingsSaveBar from '\.\.\/components\/settings\/SettingsSaveBar\.vue'/);
  assert.match(source, /buildSettingsSaveState/);
  assert.match(source, /<SettingsSaveBar :save-state="settingsSaveState" \/>/);
});

test('SettingsLibraryView renders loading state before settings are fetched', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-if="isLoading"/);
  assert.match(source, /Loading settings\.\.\./);
});

test('SettingsLibraryView presents source safety as an optional advanced section', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /import SettingsDisclosure from '\.\.\/components\/settings\/SettingsDisclosure\.vue'/);
  assert.match(source, /title="Source safety"/);
  assert.match(source, /show-label="Show source safety"/);
});

test('SettingsLibraryView wires the auto-ignore toggle to form.acquisition.autoIgnoreEnabled', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model="form\.acquisition\.autoIgnoreEnabled"/);
});

test('SettingsLibraryView wires the cooldown field to form.acquisition.autoIgnoreCooldownHours', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model\.number="form\.acquisition\.autoIgnoreCooldownHours"/);
  assert.match(source, /autoIgnoreCooldownHours.*min="0" max="8760" step="1"/);
});

test('SettingsLibraryView disables the cooldown input when auto-ignore is off', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /:disabled="!form\.acquisition\.autoIgnoreEnabled"/);
});

test('SettingsLibraryView labels the acquisition cooldown field with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Cooldown \(hours\)<\/label>/);
});

test('SettingsLibraryView presents retention behind an explicit destructive-history disclosure', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /title="History retention"/);
  assert.match(source, /permanently remove older history/);
});

test('SettingsLibraryView wires all three retention fields to form.retention.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model\.number="form\.retention\.operationRunMaxAgeDays"/);
  assert.match(source, /v-model\.number="form\.retention\.operationRunRetainCountPerType"/);
  assert.match(source, /v-model\.number="form\.retention\.outcomeEventMaxAgeDays"/);
});

test('SettingsLibraryView constrains retention inputs to validator ranges', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /operationRunMaxAgeDays.*min="7" max="3650" step="1"/);
  assert.match(source, /operationRunRetainCountPerType.*min="10" max="1000" step="1"/);
  assert.match(source, /outcomeEventMaxAgeDays.*min="30" max="3650" step="1"/);
});

test('SettingsLibraryView includes a data deletion warning in the Retention card', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /permanently remove older history on the next cleanup cycle/);
});

test('SettingsLibraryView labels retention fields with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Max age \(days\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Retain count per type<\/label>/);
});

test('SettingsLibraryView presents scoring weights behind the match-ranking disclosure', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /title="How matches are ranked"/);
  assert.match(source, /show-label="Show match ranking"/);
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

test('SettingsLibraryView labels scoring fields and associates the browser-verified format control', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label" for="settings-library-weight-format-tier">Format tier<\/label>/);
  assert.match(source, /<input id="settings-library-weight-format-tier" class="hx-input" v-model\.number="form\.scoring\.weightFormatTier"/);
  assert.match(source, /<label class="hx-field-label">Track match<\/label>/);
  assert.match(source, /<label class="hx-field-label">Audio depth<\/label>/);
  assert.match(source, /<label class="hx-field-label">Duration<\/label>/);
  assert.match(source, /<label class="hx-field-label">Format consistency<\/label>/);
  assert.match(source, /<label class="hx-field-label">Track count<\/label>/);
  assert.match(source, /<label class="hx-field-label">Peer delivery<\/label>/);
  assert.match(source, /<label class="hx-field-label">Uploader reputation<\/label>/);
});

test('SettingsLibraryView presents fidelity thresholds behind the audio-verification disclosure', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /title="Audio verification thresholds"/);
  assert.match(source, /show-label="Show audio verification thresholds"/);
});

test('SettingsLibraryView wires all nine fidelity fields to form.fidelity.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model\.number="form\.fidelity\.spectralAuthenticMinCutoffHz"/);
  assert.match(source, /v-model\.number="form\.fidelity\.spectralSuspiciousMinCutoffHz"/);
  assert.match(source, /v-model\.number="form\.fidelity\.spectralTranscodeMidCutoffHz"/);
  assert.match(source, /v-model\.number="form\.fidelity\.spectralMinSampleRateHz"/);
  assert.match(source, /v-model\.number="form\.fidelity\.trustWatchFailureCount"/);
  assert.match(source, /v-model\.number="form\.fidelity\.trustWatchMaxSuccessRate"/);
  assert.match(source, /v-model\.number="form\.fidelity\.trustWatchEvidenceCount"/);
  assert.match(source, /v-model\.number="form\.fidelity\.trustHealthyEvidenceCount"/);
  assert.match(source, /v-model\.number="form\.fidelity\.trustHealthyMinSuccessRate"/);
});

test('SettingsLibraryView constrains fidelity inputs to validator ranges', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /spectralAuthenticMinCutoffHz[^]*min="10000" max="24000" step="100"/);
  assert.match(source, /spectralSuspiciousMinCutoffHz[^]*min="8000" max="24000" step="100"/);
  assert.match(source, /spectralTranscodeMidCutoffHz[^]*min="4000" max="24000" step="100"/);
  assert.match(source, /spectralMinSampleRateHz[^]*min="8000" max="192000" step="100"/);
  assert.match(source, /trustWatchFailureCount[^]*min="1" max="100" step="1"/);
  assert.match(source, /trustWatchMaxSuccessRate[^]*min="0" max="1" step="0\.01"/);
  assert.match(source, /trustWatchEvidenceCount[^]*min="1" max="1000" step="1"/);
  assert.match(source, /trustHealthyEvidenceCount[^]*min="1" max="1000" step="1"/);
  assert.match(source, /trustHealthyMinSuccessRate[^]*min="0" max="1" step="0\.01"/);
});

test('SettingsLibraryView labels all nine fidelity fields with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Authentic cutoff \(Hz\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Suspicious cutoff \(Hz\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Transcode cutoff \(Hz\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Min sample rate \(Hz\)<\/label>/);
  assert.match(source, /<label class="hx-field-label">Watch failure count<\/label>/);
  assert.match(source, /<label class="hx-field-label">Watch max success rate<\/label>/);
  assert.match(source, /<label class="hx-field-label">Watch evidence count<\/label>/);
  assert.match(source, /<label class="hx-field-label">Healthy evidence count<\/label>/);
  assert.match(source, /<label class="hx-field-label">Healthy min success rate<\/label>/);
});

test('SettingsLibraryView includes a reset to defaults button for fidelity', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /resetFidelityDefaults/);
  assert.match(source, /FIDELITY_DEFAULTS/);
});

test('SettingsLibraryView presents naming templates behind the file-naming disclosure', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /title="File naming"/);
  assert.match(source, /show-label="Show file naming"/);
});

test('SettingsLibraryView wires all four naming template fields to form.naming.*', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /v-model="form\.naming\.artistFolderFormat"/);
  assert.match(source, /v-model="form\.naming\.albumFolderFormat"/);
  assert.match(source, /v-model="form\.naming\.trackFilenameFormat"/);
  assert.match(source, /v-model="form\.naming\.multiDiscTrackFilenameFormat"/);
});

test('SettingsLibraryView uses monospace font for naming template inputs', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /font-family: var\(--hx-font-mono\)/);
});

test('SettingsLibraryView labels all four naming fields with hx-field-label', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /<label class="hx-field-label">Artist folder format<\/label>/);
  assert.match(source, /<label class="hx-field-label">Album folder format<\/label>/);
  assert.match(source, /<label class="hx-field-label">Track filename format<\/label>/);
  assert.match(source, /<label class="hx-field-label">Multi-disc track format<\/label>/);
});

test('SettingsLibraryView includes a token reference section', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /Available tokens/);
  assert.match(source, /\{ArtistName\}/);
  assert.match(source, /\{AlbumTitle\}/);
  assert.match(source, /\{ReleaseYear\}/);
  assert.match(source, /\{SongTitle\}/);
  assert.match(source, /\{TrackNumber\}/);
  assert.match(source, /\{DiscNumber\}/);
  assert.match(source, /\{DiscCount\}/);
});

test('SettingsLibraryView includes a reset to defaults button for naming', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /resetNamingDefaults/);
  assert.match(source, /NAMING_DEFAULTS/);
});

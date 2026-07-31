<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script setup>
import { computed, onMounted } from 'vue';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import SettingsFormGroup from '../components/settings/SettingsFormGroup.vue';
import SettingsSaveBar from '../components/settings/SettingsSaveBar.vue';
import { useSettingsForm } from '../composables/useSettingsForm.js';
import { buildSettingsSaveState } from '../lib/settings-save-state-presentation.js';

const SCORING_WEIGHT_DEFAULTS = {
  weightFormatTier: 0.25,
  weightCandidateTrackMatch: 0.20,
  weightAudioDepth: 0.12,
  weightDuration: 0.12,
  weightFormatConsistency: 0.10,
  weightTrackCount: 0.08,
  weightPeerDelivery: 0.08,
  weightUploaderReputation: 0.05,
};

const FIDELITY_DEFAULTS = {
  spectralAuthenticMinCutoffHz: 20000,
  spectralSuspiciousMinCutoffHz: 19000,
  spectralTranscodeMidCutoffHz: 16000,
  spectralMinSampleRateHz: 44100,
  trustWatchFailureCount: 3,
  trustWatchMaxSuccessRate: 0.5,
  trustWatchEvidenceCount: 3,
  trustHealthyEvidenceCount: 5,
  trustHealthyMinSuccessRate: 0.8,
};

const NAMING_DEFAULTS = {
  artistFolderFormat: '{ArtistName}',
  albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
  trackFilenameFormat: '{TrackNumber} - {SongTitle}',
  multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
};

const {
  form,
  hasSaved,
  isDirty,
  isLoading,
  isSaving,
  loadErrorMessage,
  loadSettings,
  saveErrorMessage,
  saveSettings,
  successMessage,
} = useSettingsForm();

const settingsSaveState = computed(() => buildSettingsSaveState({
  hasSaved: hasSaved.value,
  isDirty: isDirty.value,
  isSaving: isSaving.value,
  saveErrorMessage: saveErrorMessage.value,
  successMessage: successMessage.value,
}));

const scoringSum = computed(() =>
  Object.values(form.scoring).reduce((sum, w) => sum + (typeof w === 'number' ? w : 0), 0),
);

function resetScoringDefaults() {
  Object.assign(form.scoring, { ...SCORING_WEIGHT_DEFAULTS });
}

function resetFidelityDefaults() {
  Object.assign(form.fidelity, { ...FIDELITY_DEFAULTS });
}

function resetNamingDefaults() {
  Object.assign(form.naming, { ...NAMING_DEFAULTS });
}

onMounted(() => { void loadSettings(); });
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card" v-if="isLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading settings...</p>
      </div>
    </article>

    <article class="hx-card" v-else-if="loadErrorMessage">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Settings unavailable</h3>
          <p class="hx-card-subtitle">{{ loadErrorMessage }}</p>
        </div>
      </div>
    </article>

    <form @submit.prevent="saveSettings" v-else>
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Discovery scheduling</h3>
            <p class="hx-card-subtitle">Recommended timing and automatic download behavior for wanted releases.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <SettingsFormGroup
            kind="core"
            title="Search timing"
            description="Recommended: wait 6 hours after the first empty search, then 2 hours between later retries."
          >
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="settings-library-discovery-cooldown">First retry (hours)</label>
                <input id="settings-library-discovery-cooldown" class="hx-input" v-model.number="form.library.discoveryCooldownHours" type="number" min="1" max="168" step="1" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label" for="settings-library-discovery-fallback-cooldown">Later retries (hours)</label>
                <input id="settings-library-discovery-fallback-cooldown" class="hx-input" v-model.number="form.library.discoveryFallbackCooldownHours" type="number" min="1" max="168" step="1" />
              </div>
            </div>
          </SettingsFormGroup>
          <SettingsFormGroup
            title="Search limits"
            description="Recommended: search 5 releases per cycle and stop after 3 empty attempts."
          >
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="settings-library-discovery-batch-size">Batch size</label>
                <input id="settings-library-discovery-batch-size" class="hx-input" v-model.number="form.library.discoveryBatchSize" type="number" min="1" max="50" step="1" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label" for="settings-library-max-search-attempts">Max search attempts</label>
                <input id="settings-library-max-search-attempts" class="hx-input" v-model.number="form.library.maxSearchAttempts" type="number" min="1" max="10" step="1" />
              </div>
            </div>
          </SettingsFormGroup>
          <SettingsFormGroup
            title="Automatic downloads"
            description="Starts downloads only for an unambiguous high-confidence match. Other matches remain in Music Queue for review."
          >
            <label class="cfg-check">
              <input type="checkbox" v-model="form.library.autoStartDownloadsAfterSelection" />
              <span>Automatically start download runs for high-confidence selections</span>
            </label>
          </SettingsFormGroup>
        </div>
      </article>

      <div class="settings-library__advanced-stack">
        <SettingsDisclosure
          panel-id="settings-library-advanced"
          action-style="compact"
          category="advanced"
          title="Library controls"
          subtitle="Source safety, history, matching, audio checks, and file names."
          show-label="Show advanced library controls"
          hide-label="Hide advanced library controls"
        >
          <SettingsDisclosure
            panel-id="settings-library-source-safety"
            title="Source safety"
            action-style="compact"
            subtitle="Control how Harmoniarr responds to repeatedly unreliable music sources."
            show-label="Show source safety"
            hide-label="Hide source safety"
            variant="inline"
            :heading-level="3"
          >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <label class="cfg-check">
              <input type="checkbox" v-model="form.acquisition.autoIgnoreEnabled" />
              <span>Automatically ignore low-reputation source users</span>
            </label>
            <p class="cfg-field-hint">When enabled, Harmoniarr evaluates each source user's reputation after recording delivery outcomes. Peers that exceed the failure threshold are added to the ignore list after the cooldown period elapses.</p>
            <div class="hx-field">
              <label class="hx-field-label">Cooldown (hours)</label>
              <input class="hx-input" v-model.number="form.acquisition.autoIgnoreCooldownHours" type="number" min="0" max="8760" step="1" :disabled="!form.acquisition.autoIgnoreEnabled" />
              <p class="cfg-field-hint">Minimum hours between auto-ignore evaluations for the same peer. A longer cooldown reduces noise but delays ignoring problematic peers. Default is 24 hours. Range: 0–8760 (1 year).</p>
            </div>
          </div>
        </SettingsDisclosure>

        <SettingsDisclosure
          panel-id="settings-library-retention"
            title="History retention"
            action-style="compact"
          subtitle="Changing these limits can permanently remove older history on the next cleanup cycle."
          show-label="Show history retention"
          hide-label="Hide history retention"
          variant="inline"
          :heading-level="3"
        >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Operation runs</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Max age (days)</label>
                <input class="hx-input" v-model.number="form.retention.operationRunMaxAgeDays" type="number" min="7" max="3650" step="1" />
                <p class="cfg-field-hint">Operation runs older than this are eligible for cleanup. Default is 90 days. Range: 7–3650.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Retain count per type</label>
                <input class="hx-input" v-model.number="form.retention.operationRunRetainCountPerType" type="number" min="10" max="1000" step="1" />
                <p class="cfg-field-hint">Maximum operation runs to keep per type, regardless of age. Default is 50. Range: 10–1000.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Outcome events</p>
            <div class="hx-field">
              <label class="hx-field-label">Max age (days)</label>
              <input class="hx-input" v-model.number="form.retention.outcomeEventMaxAgeDays" type="number" min="30" max="3650" step="1" />
              <p class="cfg-field-hint">Delivery outcome events older than this are eligible for cleanup. Default is 180 days. Range: 30–3650.</p>
            </div>
          </div>
        </SettingsDisclosure>

        <SettingsDisclosure
          panel-id="settings-library-match-ranking"
            title="How matches are ranked"
            action-style="compact"
          subtitle="Tune weighting only when you need to change how Harmoniarr chooses between otherwise acceptable matches."
          show-label="Show match ranking"
          hide-label="Hide match ranking"
          variant="inline"
          :heading-level="3"
        >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Format and match quality</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="settings-library-weight-format-tier">Format tier</label>
                <input id="settings-library-weight-format-tier" class="hx-input" v-model.number="form.scoring.weightFormatTier" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much the file format (FLAC vs MP3) matters. Default is 0.25.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Track match</label>
                <input class="hx-input" v-model.number="form.scoring.weightCandidateTrackMatch" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much matching expected track titles matters. Default is 0.20.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Audio fidelity</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Audio depth</label>
                <input class="hx-input" v-model.number="form.scoring.weightAudioDepth" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much audio bit depth and sample rate matters. Default is 0.12.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Duration</label>
                <input class="hx-input" v-model.number="form.scoring.weightDuration" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much matching expected album duration matters. Default is 0.12.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Consistency and completeness</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Format consistency</label>
                <input class="hx-input" v-model.number="form.scoring.weightFormatConsistency" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much uniform file formats across the candidate matters. Default is 0.10.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Track count</label>
                <input class="hx-input" v-model.number="form.scoring.weightTrackCount" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much matching expected track count matters. Default is 0.08.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Source reliability</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Peer delivery</label>
                <input class="hx-input" v-model.number="form.scoring.weightPeerDelivery" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much the uploader's connection quality matters. Default is 0.08.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Uploader reputation</label>
                <input class="hx-input" v-model.number="form.scoring.weightUploaderReputation" type="number" min="0.01" max="1" step="0.01" />
                <p class="cfg-field-hint">How much the uploader's historical reliability matters. Default is 0.05.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <div class="hx-form-row" style="align-items: center">
              <div class="hx-field">
                <p class="cfg-group-title">Weight total</p>
                <p class="cfg-field-hint">
                  Weights must sum to 1.00. Current sum:
                  <strong :style="{ color: Math.abs(scoringSum - 1) < 0.0001 ? 'var(--hx-success)' : 'var(--hx-danger)' }">{{ scoringSum.toFixed(2) }}</strong>
                </p>
              </div>
              <div class="hx-field" style="text-align: right">
                <button type="button" class="hx-btn" data-variant="ghost" @click="resetScoringDefaults">Reset to defaults</button>
              </div>
            </div>
          </div>
        </SettingsDisclosure>

        <SettingsDisclosure
          panel-id="settings-library-audio-verification"
            title="Audio verification thresholds"
            action-style="compact"
          subtitle="Tune spectral and source-trust thresholds only when you need stricter or looser quality checks."
          show-label="Show audio verification thresholds"
          hide-label="Hide audio verification thresholds"
          variant="inline"
          :heading-level="3"
        >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Spectral analysis</p>
            <p class="hx-text-muted">Frequency cutoffs determine how spectral fingerprints classify audio quality. Higher cutoffs are stricter — fewer files pass as authentic. The minimum sample rate filters out low-resolution sources entirely.</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Authentic cutoff (Hz)</label>
                <input class="hx-input" v-model.number="form.fidelity.spectralAuthenticMinCutoffHz" type="number" min="10000" max="24000" step="100" />
                <p class="cfg-field-hint">Files with spectral content above this cutoff are classified as authentic. Default is 20000 Hz. Range: 10000–24000.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Suspicious cutoff (Hz)</label>
                <input class="hx-input" v-model.number="form.fidelity.spectralSuspiciousMinCutoffHz" type="number" min="8000" max="24000" step="100" />
                <p class="cfg-field-hint">Files below this cutoff are flagged as suspicious. Default is 19000 Hz. Range: 8000–24000.</p>
              </div>
            </div>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Transcode cutoff (Hz)</label>
                <input class="hx-input" v-model.number="form.fidelity.spectralTranscodeMidCutoffHz" type="number" min="4000" max="24000" step="100" />
                <p class="cfg-field-hint">Mid-range cutoff for detecting transcoded files. Default is 16000 Hz. Range: 4000–24000.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Min sample rate (Hz)</label>
                <input class="hx-input" v-model.number="form.fidelity.spectralMinSampleRateHz" type="number" min="8000" max="192000" step="100" />
                <p class="cfg-field-hint">Files below this sample rate are rejected outright. Default is 44100 Hz (CD quality). Range: 8000–192000.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Source trust</p>
            <p class="hx-text-muted">Trust thresholds control when a source user is promoted to healthy status or demoted to watch status based on delivery history.</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Watch failure count</label>
                <input class="hx-input" v-model.number="form.fidelity.trustWatchFailureCount" type="number" min="1" max="100" step="1" />
                <p class="cfg-field-hint">Number of failed deliveries before a source is placed on watch. Default is 3. Range: 1–100.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Watch max success rate</label>
                <input class="hx-input" v-model.number="form.fidelity.trustWatchMaxSuccessRate" type="number" min="0" max="1" step="0.01" />
                <p class="cfg-field-hint">Sources with a success rate at or below this value are watched. Default is 0.50. Range: 0–1.</p>
              </div>
            </div>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Watch evidence count</label>
                <input class="hx-input" v-model.number="form.fidelity.trustWatchEvidenceCount" type="number" min="1" max="1000" step="1" />
                <p class="cfg-field-hint">Minimum delivery outcomes needed before evaluating watch status. Default is 3. Range: 1–1000.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Healthy evidence count</label>
                <input class="hx-input" v-model.number="form.fidelity.trustHealthyEvidenceCount" type="number" min="1" max="1000" step="1" />
                <p class="cfg-field-hint">Minimum delivery outcomes needed before promoting a source to healthy. Default is 5. Range: 1–1000.</p>
              </div>
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Healthy min success rate</label>
              <input class="hx-input" v-model.number="form.fidelity.trustHealthyMinSuccessRate" type="number" min="0" max="1" step="0.01" />
              <p class="cfg-field-hint">Sources must meet or exceed this success rate to be classified as healthy. Default is 0.80. Range: 0–1.</p>
            </div>
          </div>
          <div class="cfg-group">
            <div class="hx-form-row" style="align-items: center">
              <div class="hx-field">
                <p class="cfg-group-title">Defaults</p>
                <p class="cfg-field-hint">Restore all fidelity thresholds to their recommended values.</p>
              </div>
              <div class="hx-field" style="text-align: right">
                <button type="button" class="hx-btn" data-variant="ghost" @click="resetFidelityDefaults">Reset to defaults</button>
              </div>
            </div>
          </div>
        </SettingsDisclosure>

        <SettingsDisclosure
          panel-id="settings-library-naming"
            title="File naming"
            action-style="compact"
          subtitle="Change these only when you want future organize runs to use a different folder or track-file format."
          show-label="Show file naming"
          hide-label="Hide file naming"
          variant="inline"
          :heading-level="3"
        >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Folder naming</p>
            <p class="hx-text-muted">Templates for artist and album folder names. These produce a single path segment each — path separators are not allowed.</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Artist folder format</label>
                <input class="hx-input" style="font-family: var(--hx-font-mono)" v-model="form.naming.artistFolderFormat" />
                <p class="cfg-field-hint">Default is {ArtistName}.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Album folder format</label>
                <input class="hx-input" style="font-family: var(--hx-font-mono)" v-model="form.naming.albumFolderFormat" />
                <p class="cfg-field-hint">Default is {AlbumTitle} ({ReleaseYear}).</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Track naming</p>
            <p class="hx-text-muted">Templates for track filenames. The file extension is appended automatically — do not include it in the template. The multi-disc template is used when a release has more than one disc.</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Track filename format</label>
                <input class="hx-input" style="font-family: var(--hx-font-mono)" v-model="form.naming.trackFilenameFormat" />
                <p class="cfg-field-hint">Default is {TrackNumber} - {SongTitle}.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Multi-disc track format</label>
                <input class="hx-input" style="font-family: var(--hx-font-mono)" v-model="form.naming.multiDiscTrackFilenameFormat" />
                <p class="cfg-field-hint">Default is {DiscNumber}-{TrackNumber} - {SongTitle}.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Available tokens</p>
            <p class="cfg-field-hint">{ArtistName} {AlbumTitle} {ReleaseYear} {SongTitle} {TrackNumber} {DiscNumber} {DiscCount}</p>
            <p class="cfg-field-hint">Use {TokenName:50} to truncate a value to 50 characters. Tokens wrapped in curly braces are replaced with the corresponding metadata value.</p>
          </div>
          <div class="cfg-group">
            <div class="hx-form-row" style="align-items: center">
              <div class="hx-field">
                <p class="cfg-group-title">Defaults</p>
                <p class="cfg-field-hint">Restore all naming templates to their default values.</p>
              </div>
              <div class="hx-field" style="text-align: right">
                <button type="button" class="hx-btn" data-variant="ghost" @click="resetNamingDefaults">Reset to defaults</button>
              </div>
            </div>
          </div>
        </SettingsDisclosure>
        </SettingsDisclosure>
      </div>

      <SettingsSaveBar :save-state="settingsSaveState" />
    </form>
  </div>
</template>

<style scoped>
.settings-library__advanced-stack {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
}
</style>

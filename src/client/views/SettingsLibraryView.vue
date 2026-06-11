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
import { useSettingsForm } from '../composables/useSettingsForm.js';

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

const {
  errorMessage,
  form,
  isLoading,
  isSaving,
  loadSettings,
  saveSettings,
  successMessage,
} = useSettingsForm();

const scoringSum = computed(() =>
  Object.values(form.scoring).reduce((sum, w) => sum + (typeof w === 'number' ? w : 0), 0),
);

function resetScoringDefaults() {
  Object.assign(form.scoring, { ...SCORING_WEIGHT_DEFAULTS });
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

    <article class="hx-card" v-else-if="errorMessage && !successMessage">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Settings unavailable</h3>
          <p class="hx-card-subtitle">{{ errorMessage }}</p>
        </div>
      </div>
    </article>

    <form @submit.prevent="saveSettings" v-else>
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Discovery scheduling</h3>
            <p class="hx-card-subtitle">Control how often Harmoniarr searches for wanted releases and how many searches it runs per cycle.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Cooldown timers</p>
            <p class="hx-text-muted">After a search comes up empty, Harmoniarr waits before trying again. The first wait uses the automatic cooldown. If the release still has no candidates after a second search, it switches to the shorter fallback cooldown.</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Automatic cooldown (hours)</label>
                <input class="hx-input" v-model.number="form.library.discoveryCooldownHours" type="number" min="1" max="168" step="1" />
                <p class="cfg-field-hint">Wait this long before re-searching for a release that has never had a candidate. Default is 6 hours.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Fallback cooldown (hours)</label>
                <input class="hx-input" v-model.number="form.library.discoveryFallbackCooldownHours" type="number" min="1" max="168" step="1" />
                <p class="cfg-field-hint">Shorter wait between retries for releases that have already been searched at least once. Default is 2 hours.</p>
              </div>
            </div>
          </div>
          <div class="cfg-group">
            <p class="cfg-group-title">Search limits</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Batch size</label>
                <input class="hx-input" v-model.number="form.library.discoveryBatchSize" type="number" min="1" max="50" step="1" />
                <p class="cfg-field-hint">How many releases to search for in a single dispatch cycle. Default is 5.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Max search attempts</label>
                <input class="hx-input" v-model.number="form.library.maxSearchAttempts" type="number" min="1" max="10" step="1" />
                <p class="cfg-field-hint">After this many empty searches, the release is marked as exhausted and Harmoniarr stops retrying. Default is 3.</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Download scoring weights <span class="hx-pill" data-tone="info" style="font-size: var(--hx-text-xs); vertical-align: middle; margin-left: 6px">advanced</span></h3>
            <p class="hx-card-subtitle">Control how much each quality factor contributes to a candidate's overall score. Weights determine which downloads Harmoniarr prioritizes.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <p class="cfg-group-title">Format and match quality</p>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Format tier</label>
                <input class="hx-input" v-model.number="form.scoring.weightFormatTier" type="number" min="0.01" max="1" step="0.01" />
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
        </div>
      </article>

      <div class="cfg-save-bar">
        <span class="cfg-save-msg is-error" v-if="errorMessage">{{ errorMessage }}</span>
        <span class="cfg-save-msg is-success" v-else-if="successMessage">{{ successMessage }}</span>
        <button type="submit" class="hx-btn" data-variant="primary" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save settings' }}
        </button>
      </div>
    </form>
  </div>
</template>

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
import { onMounted } from 'vue';
import { useSettingsForm } from '../composables/useSettingsForm.js';

const {
  errorMessage,
  form,
  isLoading,
  isSaving,
  loadSettings,
  saveSettings,
  successMessage,
} = useSettingsForm();

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

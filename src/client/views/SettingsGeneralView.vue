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
import { buildSecurityConfigurationPosture } from '../lib/settings-security-presentation.js';
import { buildSettingsSaveState } from '../lib/settings-save-state-presentation.js';
import { useSettingsForm } from '../composables/useSettingsForm.js';

const {
  form,
  hasSaved,
  isLoading,
  isSaving,
  isDirty,
  loadErrorMessage,
  loadSettings,
  saveSettings,
  saveErrorMessage,
} = useSettingsForm();

onMounted(() => { void loadSettings(); });
const securityPosture = computed(() => buildSecurityConfigurationPosture(form));
const settingsSaveState = computed(() => buildSettingsSaveState({
  hasSaved: hasSaved.value,
  isDirty: isDirty.value,
  isSaving: isSaving.value,
  saveErrorMessage: saveErrorMessage.value,
}));
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card" v-if="isLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading settings…</p>
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
      <article class="hx-card settings-general__posture">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Security configuration</h3>
            <p class="hx-card-subtitle">Saved deployment settings only. This does not test your reverse proxy, certificate, or network exposure.</p>
          </div>
          <span class="hx-pill" :data-tone="securityPosture.tone">{{ securityPosture.statusLabel }}</span>
        </header>
        <div class="hx-card-body">
          <p class="settings-general__posture-message" role="status" aria-atomic="true">{{ securityPosture.message }}</p>
          <div class="settings-general__posture-checks">
            <div v-for="check in securityPosture.checks" :key="check.label" class="settings-general__posture-check">
              <span>{{ check.label }}</span>
              <span class="hx-pill" :data-tone="check.tone">{{ check.statusLabel }}</span>
            </div>
          </div>
        </div>
      </article>

      <article class="hx-card settings-general__security-controls">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Remote access protections</h3>
            <p class="hx-card-subtitle">Only change these when Harmoniarr is safely available over HTTPS.</p>
          </div>
        </header>
        <div class="hx-card-body">
            <SettingsFormGroup
              kind="core"
              title="Cookie security"
              description="Use this only when your reverse proxy already serves Harmoniarr over HTTPS."
            >
              <label class="cfg-check">
                <input type="checkbox" v-model="form.security.secureCookies" />
                <span>Secure cookies</span>
              </label>
            </SettingsFormGroup>
            <SettingsFormGroup
              title="HTTPS enforcement"
              description="Enable this after your reverse proxy and certificate are working."
            >
              <label class="cfg-check">
                <input type="checkbox" v-model="form.security.enforceHttps" />
                <span>Require HTTPS</span>
              </label>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.security.strictTransportSecurity" />
                <span>Tell browsers to always use HTTPS</span>
              </label>
            </SettingsFormGroup>
            <SettingsFormGroup
              title="Cross-site requests"
              description="Require protection only when other websites can reach this Harmoniarr instance."
            >
              <div class="hx-field">
                <label class="hx-field-label" for="settings-csrf-protection">Cross-site request protection</label>
                <select id="settings-csrf-protection" class="hx-select" v-model="form.security.csrfProtectionMode">
                  <option value="disabled">Disabled</option>
                  <option value="required">Required</option>
                </select>
              </div>
            </SettingsFormGroup>
        </div>
      </article>

      <div class="settings-general__advanced-stack">
        <SettingsDisclosure
          panel-id="settings-system-controls"
          action-style="compact"
          category="advanced"
          title="System controls"
          subtitle="Base address and troubleshooting logging."
          show-label="Show advanced system controls"
          hide-label="Hide advanced system controls"
        >
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <div class="hx-field">
                <label class="hx-field-label" for="settings-base-url">Base URL</label>
                <input id="settings-base-url" class="hx-input" v-model="form.system.baseUrl" placeholder="https://harmoniarr.example" />
              </div>
              <p class="cfg-field-hint">The web address where Harmoniarr is accessible, e.g. <code>https://harmoniarr.home</code>. Used for redirect links and OAuth callbacks. Leave blank if you're only accessing it locally.</p>
            </div>
            <div class="cfg-group">
              <div class="hx-field">
                <label class="hx-field-label" for="settings-log-level">Log level</label>
                <select id="settings-log-level" class="hx-select" v-model="form.system.logLevel">
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>
              <p class="cfg-field-hint"><code>info</code> is recommended for normal use. Switch to <code>debug</code> temporarily if you need to trace a problem.</p>
            </div>
        </SettingsDisclosure>
      </div>

      <SettingsSaveBar :save-state="settingsSaveState" />
    </form>
  </div>
</template>

<style scoped>
.settings-general__posture,
.settings-general__security-controls {
  margin-bottom: var(--hx-space-4);
}

.settings-general__posture-message {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
  margin: 0 0 var(--hx-space-3);
}

.settings-general__posture-checks {
  display: grid;
  gap: var(--hx-space-2);
}

.settings-general__posture-check {
  align-items: center;
  border-top: 1px solid var(--hx-border-subtle);
  color: var(--hx-text-muted);
  display: flex;
  font-size: var(--hx-text-sm);
  justify-content: space-between;
  padding-top: var(--hx-space-2);
}

.settings-general__advanced-stack {
  display: grid;
  gap: var(--hx-space-4);
}
</style>

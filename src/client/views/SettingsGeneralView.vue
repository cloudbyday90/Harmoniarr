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
import { buildSecurityConfigurationPosture } from '../lib/settings-security-presentation.js';
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
const securityPosture = computed(() => buildSecurityConfigurationPosture(form));
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card" v-if="isLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading settings…</p>
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
            <p class="hx-card-subtitle">Leave these at local-install defaults unless Harmoniarr is safely available over HTTPS.</p>
          </div>
        </header>
        <div class="hx-card-body">
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <p class="cfg-group-title">Cookie security</p>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.security.secureCookies" />
                <span>Secure cookies</span>
              </label>
              <p class="cfg-field-hint">Only sends your login cookie over HTTPS. Turn on if Harmoniarr is behind a reverse proxy with SSL — leave off for plain HTTP installs.</p>
            </div>
            <div class="cfg-group">
              <p class="cfg-group-title">HTTPS enforcement</p>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.security.enforceHttps" />
                <span>Require HTTPS</span>
              </label>
              <p class="cfg-field-hint">Redirects plain HTTP visits to HTTPS and blocks settings changes over unencrypted connections. Leave off for local-only installs.</p>
              <label class="cfg-check" style="margin-top: var(--hx-space-2)">
                <input type="checkbox" v-model="form.security.strictTransportSecurity" />
                <span>Tell browsers to always use HTTPS</span>
              </label>
              <p class="cfg-field-hint">Sends a header that tells browsers to never load Harmoniarr over plain HTTP. Only enable after Require HTTPS is already working.</p>
            </div>
            <div class="cfg-group">
              <p class="cfg-group-title">Cross-site protection</p>
              <div class="hx-field">
                <label class="hx-field-label" for="settings-csrf-protection">Cross-site request protection</label>
                <select id="settings-csrf-protection" class="hx-select" v-model="form.security.csrfProtectionMode">
                  <option value="disabled">Disabled</option>
                  <option value="required">Required</option>
                </select>
              </div>
              <p class="cfg-field-hint">Prevents other websites from quietly sending requests to Harmoniarr on your behalf. Leave disabled for local use.</p>
            </div>
        </div>
      </article>

      <div class="settings-general__advanced-stack">
        <SettingsDisclosure
          panel-id="settings-system-controls"
          title="Advanced system controls"
          subtitle="Most local installs can keep these defaults."
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

      <div class="cfg-save-bar">
        <span class="cfg-save-msg is-error" v-if="errorMessage">{{ errorMessage }}</span>
        <span class="cfg-save-msg is-success" v-else-if="successMessage">{{ successMessage }}</span>
        <button type="submit" class="hx-btn" data-variant="primary" :disabled="isSaving">
          {{ isSaving ? 'Saving…' : 'Save settings' }}
        </button>
      </div>
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

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
      <div class="cfg-2col">
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Security</h3>
              <p class="hx-card-subtitle">Leave everything here off unless Harmoniarr is accessible over HTTPS from outside your network.</p>
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
                <label class="hx-field-label">Cross-site request protection</label>
                <select class="hx-select" v-model="form.security.csrfProtectionMode">
                  <option value="disabled">Disabled</option>
                  <option value="required">Required</option>
                </select>
              </div>
              <p class="cfg-field-hint">Prevents other websites from quietly sending requests to Harmoniarr on your behalf. Leave disabled for local use.</p>
            </div>
          </div>
        </article>

        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">System</h3>
              <p class="hx-card-subtitle">Base address and log verbosity. Leave at defaults for most installs.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <div class="hx-field">
                <label class="hx-field-label">Base URL</label>
                <input class="hx-input" v-model="form.system.baseUrl" placeholder="https://harmoniarr.example" />
              </div>
              <p class="cfg-field-hint">The web address where Harmoniarr is accessible, e.g. <code>https://harmoniarr.home</code>. Used for redirect links and OAuth callbacks. Leave blank if you're only accessing it locally.</p>
            </div>
            <div class="cfg-group">
              <div class="hx-field">
                <label class="hx-field-label">Log level</label>
                <select class="hx-select" v-model="form.system.logLevel">
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>
              <p class="cfg-field-hint"><code>info</code> is recommended for normal use. Switch to <code>debug</code> temporarily if you need to trace a problem.</p>
            </div>
          </div>
        </article>
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

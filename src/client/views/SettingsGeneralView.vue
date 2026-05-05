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
import { onMounted, reactive, ref } from 'vue';
import { fetchSettings, updateSettings } from '../lib/settings-api.js';
import {
  buildSettingsUpdatePayload,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../lib/settings-form.js';

const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Full form maintained so buildSettingsUpdatePayload stays safe.
// Only the security and system sections are rendered here.
const form = reactive({
  artwork: {
    captureEmbedded: true,
    captureFolderArtwork: true,
    derivativeCacheSizeMb: 1024,
    derivativeFormat: 'webp',
    derivativeRetentionDays: 30,
    derivativeSizesText: '256, 512',
    fetchEnabled: true,
    maxOriginalDimensionPixels: 4000,
    maxOriginalFileSizeBytes: 20971520,
    providerOrderText: 'coverArtArchive',
    refetchMissingAutomatically: false,
    refreshAfterImport: true,
    refreshAfterLibraryScan: false,
    refreshAfterMetadataRefresh: true,
    unassignedRetentionDays: 90,
  },
  security: {
    csrfProtectionMode: 'disabled',
    enforceHttps: false,
    secureCookies: false,
    strictTransportSecurity: false,
  },
  system: {
    baseUrl: '',
    logLevel: 'info',
  },
  paths: {
    downloadMappings: [],
    downloads: '',
    music: '',
    staging: '',
    transcodeTemp: '',
    userMusicRoots: [],
  },
  slskd: {
    apiKey: '',
    baseUrl: 'http://slskd:5030',
    clearApiKey: false,
    requestTimeoutMs: 10000,
  },
  providers: {
    appleMusicEnabled: false,
    appleMusicKeyId: '',
    appleMusicPrivateKey: '',
    appleMusicStorefront: 'us',
    appleMusicTeamId: '',
    clearAppleMusicPrivateKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    playlistExpansionPolicy: 'bounded',
    requestTimeoutMs: 15000,
    spotifyClientId: '',
    spotifyClientSecret: '',
    spotifyEnabled: false,
    youtubeApiKey: '',
    youtubeClientId: '',
    youtubeClientSecret: '',
    youtubeEnabled: false,
  },
});

function formatCommaSeparatedList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function applySettings(payload) {
  Object.assign(form.artwork, {
    ...payload.settings.artwork,
    derivativeSizesText: formatCommaSeparatedList(payload.settings.artwork?.derivativeSizes),
    providerOrderText: formatCommaSeparatedList(payload.settings.artwork?.providerOrder),
  });
  Object.assign(form.security, payload.settings.security);
  Object.assign(form.system, payload.settings.system);
  Object.assign(form.paths, {
    ...payload.settings.paths,
    downloadMappings: form.paths.downloadMappings,
    userMusicRoots: form.paths.userMusicRoots,
  });
  Object.assign(form.slskd, {
    ...form.slskd,
    ...payload.settings.slskd,
    apiKey: '',
    clearApiKey: false,
  });
  Object.assign(form.providers, {
    ...form.providers,
    ...payload.settings.providers,
    appleMusicPrivateKey: '',
    clearAppleMusicPrivateKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    spotifyClientSecret: '',
    youtubeApiKey: '',
    youtubeClientSecret: '',
  });
  form.paths.downloadMappings.splice(
    0,
    form.paths.downloadMappings.length,
    ...normalizeDownloadMappings(payload.settings.paths?.downloadMappings),
  );
  form.paths.userMusicRoots.splice(
    0,
    form.paths.userMusicRoots.length,
    ...normalizeUserMusicRoots(payload.settings.paths?.userMusicRoots),
  );
}

async function loadSettings() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    applySettings(await fetchSettings());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings load failed';
  } finally {
    isLoading.value = false;
  }
}

async function saveSettings() {
  isSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await updateSettings(buildSettingsUpdatePayload(form));
    applySettings(payload);
    successMessage.value = 'Settings saved.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings save failed';
  } finally {
    isSaving.value = false;
  }
}

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
              <p class="hx-card-subtitle">Cookie posture and HTTPS enforcement. Leave these disabled for local-only HTTP installs.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <div class="hx-field">
              <label class="hx-field-label">CSRF protection</label>
              <select class="hx-select" v-model="form.security.csrfProtectionMode">
                <option value="disabled">disabled</option>
                <option value="required">required</option>
              </select>
            </div>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.security.secureCookies" />
              <span>Mark auth cookies as Secure</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.security.enforceHttps" />
              <span>Redirect HTTP traffic to HTTPS and require HTTPS for writes</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.security.strictTransportSecurity" />
              <span>Send Strict-Transport-Security headers</span>
            </label>
          </div>
        </article>

        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">System</h3>
              <p class="hx-card-subtitle">Base URL, logging level, and runtime defaults.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <div class="hx-field">
              <label class="hx-field-label">Base URL</label>
              <input class="hx-input" v-model="form.system.baseUrl" placeholder="https://harmoniarr.example" />
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Log level</label>
              <select class="hx-select" v-model="form.system.logLevel">
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
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

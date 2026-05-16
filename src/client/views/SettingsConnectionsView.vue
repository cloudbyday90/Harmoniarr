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
import {
  clearSpotifyOAuth,
  clearYouTubeOAuth,
  fetchSettings,
  startSpotifyOAuth,
  startYouTubeOAuth,
  updateSettings,
} from '../lib/settings-api.js';
import {
  buildSettingsUpdatePayload,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../lib/settings-form.js';
import {
  buildSlskdConnectionSubtitle,
  formatOAuthStatusLabel,
  formatProviderSecretStatusLabel,
  formatSlskdApiKeyStatusLabel,
} from '../lib/settings-connections-presentation.js';
import { formatCommaSeparatedList } from '../lib/settings-media-storage-presentation.js';

const isLoading = ref(true);
const isSaving = ref(false);
const isStartingSpotifyOAuth = ref(false);
const isClearingSpotifyOAuth = ref(false);
const isStartingYouTubeOAuth = ref(false);
const isClearingYouTubeOAuth = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const secretStatus = ref(null);

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
    clearFanartTvApiKey: false,
    clearFanartTvClientKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    fanartTvApiKey: '',
    fanartTvClientKey: '',
    fanartTvEnabled: false,
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
    clearFanartTvApiKey: false,
    clearFanartTvClientKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    fanartTvApiKey: '',
    fanartTvClientKey: '',
    spotifyClientSecret: '',
    youtubeApiKey: '',
    youtubeClientSecret: '',
  });
  secretStatus.value = payload.secretStatus ?? null;
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

async function connectSpotifyOAuth() {
  isStartingSpotifyOAuth.value = true;
  errorMessage.value = '';
  try {
    const payload = await startSpotifyOAuth();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization start failed';
    isStartingSpotifyOAuth.value = false;
  }
}

async function disconnectSpotifyOAuth() {
  isClearingSpotifyOAuth.value = true;
  errorMessage.value = '';
  try {
    const payload = await clearSpotifyOAuth();
    if (secretStatus.value?.providers) secretStatus.value.providers.spotifyOAuth = payload.status;
    successMessage.value = 'Spotify authorization cleared.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization clear failed';
  } finally {
    isClearingSpotifyOAuth.value = false;
  }
}

async function connectYouTubeOAuth() {
  isStartingYouTubeOAuth.value = true;
  errorMessage.value = '';
  try {
    const payload = await startYouTubeOAuth();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization start failed';
    isStartingYouTubeOAuth.value = false;
  }
}

async function disconnectYouTubeOAuth() {
  isClearingYouTubeOAuth.value = true;
  errorMessage.value = '';
  try {
    const payload = await clearYouTubeOAuth();
    if (secretStatus.value?.providers) secretStatus.value.providers.youtubeOAuth = payload.status;
    successMessage.value = 'YouTube authorization cleared.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization clear failed';
  } finally {
    isClearingYouTubeOAuth.value = false;
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

        <!-- Soulseek connection -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Soulseek connection</h3>
              <p class="hx-card-subtitle">{{ buildSlskdConnectionSubtitle() }}</p>
            </div>
            <span class="review-status-pill" :class="secretStatus?.slskd?.apiKeyConfigured ? 'review-status-selected' : 'review-status-held'">
              {{ formatSlskdApiKeyStatusLabel(secretStatus?.slskd) }}
            </span>
          </header>
          <div class="hx-card-body">
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <div class="hx-field">
                <label class="hx-field-label">Service address</label>
                <input class="hx-input" v-model="form.slskd.baseUrl" placeholder="http://slskd:5030" />
              </div>
              <p class="cfg-field-hint">The address the download service is running on. The default (<code>http://slskd:5030</code>) works with the standard Docker Compose setup.</p>
              <div class="hx-field" style="margin-top: var(--hx-space-3)">
                <label class="hx-field-label">Request timeout (seconds)</label>
                <input class="hx-input" v-model.number="form.slskd.requestTimeoutMs" type="number" min="1000" max="120000" step="1000" />
              </div>
              <p class="cfg-field-hint">Leave at the default (10,000 ms) unless you're getting frequent timeout errors.</p>
            </div>
            <div class="cfg-group">
              <p class="cfg-group-title">API key</p>
              <div class="hx-field">
                <label class="hx-field-label">API key</label>
                <input class="hx-input" v-model="form.slskd.apiKey" type="password" autocomplete="new-password" :disabled="form.slskd.clearApiKey" placeholder="Leave blank to keep the current key" />
              </div>
              <p class="cfg-field-hint">The API key from your slskd config. Stored securely — this field never shows the saved value. Leave blank to keep the current key.</p>
              <label class="cfg-check" style="margin-top: var(--hx-space-2)">
                <input type="checkbox" v-model="form.slskd.clearApiKey" />
                <span>Remove the stored API key on save</span>
              </label>
            </div>
          </div>
        </article>

        <!-- How playlist requests work -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">How playlist requests work</h3>
              <p class="hx-card-subtitle">Controls how Harmoniarr turns a playlist link into music search work.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <div class="hx-field">
                <label class="hx-field-label">Playlist discovery mode</label>
                <select class="hx-select" v-model="form.providers.playlistExpansionPolicy">
                  <option value="bounded">Bounded — only albums in the playlist</option>
                  <option value="artist_discovery">Artist discovery — include other albums by those artists</option>
                </select>
              </div>
              <p class="cfg-field-hint"><strong>Bounded</strong> searches only for the albums listed in the playlist. <strong>Artist discovery</strong> also searches for other albums by those same artists — useful for building out a collection, but creates more download work.</p>
            </div>
            <div class="cfg-group">
              <div class="hx-field">
                <label class="hx-field-label">Provider request timeout (ms)</label>
                <input class="hx-input" v-model.number="form.providers.requestTimeoutMs" type="number" min="1000" max="60000" step="1000" />
              </div>
              <p class="cfg-field-hint">How long to wait for playlist data from Spotify, YouTube, or Apple Music. Leave at the default (15,000 ms).</p>
            </div>
          </div>
        </article>
      </div>

      <!-- Provider credentials -->
      <article class="hx-card" style="margin-top: var(--hx-space-4)">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Streaming service connections</h3>
            <p class="hx-card-subtitle">Connect Spotify, YouTube, or Apple Music so users can submit playlist links. Secrets are write-only — leave blank to keep the current value.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="cfg-provider-list">

            <!-- Spotify -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Spotify</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.spotify?.clientSecretConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.spotify, 'clientSecretConfigured', 'clientSecretSource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.spotifyEnabled" />
                <span>Accept Spotify playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Client ID</label>
                  <input class="hx-input" v-model="form.providers.spotifyClientId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Client secret</label>
                  <input class="hx-input" v-model="form.providers.spotifyClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearSpotifyClientSecret" placeholder="Leave blank to keep" />
                </div>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.clearSpotifyClientSecret" />
                <span>Remove the stored Spotify client secret on save</span>
              </label>
              <div class="cfg-provider-header" style="margin-top: var(--hx-space-2)">
                <span class="hx-text-muted">User authorization — {{ formatOAuthStatusLabel(secretStatus?.providers?.spotifyOAuth) }}</span>
                <span class="review-status-pill" :class="secretStatus?.providers?.spotifyOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                  {{ secretStatus?.providers?.spotifyOAuth?.linked ? 'Linked' : 'Not linked' }}
                </span>
              </div>
              <div class="hx-card-actions">
                <button type="button" class="hx-btn" @click="connectSpotifyOAuth" :disabled="isStartingSpotifyOAuth">
                  {{ isStartingSpotifyOAuth ? 'Starting…' : 'Connect Spotify' }}
                </button>
                <button type="button" class="hx-btn" @click="disconnectSpotifyOAuth" :disabled="isClearingSpotifyOAuth || !secretStatus?.providers?.spotifyOAuth?.linked">
                  {{ isClearingSpotifyOAuth ? 'Clearing…' : 'Clear authorization' }}
                </button>
              </div>
            </div>

            <!-- YouTube -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">YouTube</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.youtube?.apiKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.youtube, 'apiKeyConfigured', 'apiKeySource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.youtubeEnabled" />
                <span>Accept YouTube playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">API key</label>
                  <input class="hx-input" v-model="form.providers.youtubeApiKey" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeApiKey" placeholder="Leave blank to keep" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">OAuth client ID</label>
                  <input class="hx-input" v-model="form.providers.youtubeClientId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">OAuth client secret</label>
                  <input class="hx-input" v-model="form.providers.youtubeClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeClientSecret" placeholder="Leave blank to keep" />
                </div>
              </div>
              <div class="hx-card-actions">
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearYoutubeApiKey" />
                  <span>Remove API key</span>
                </label>
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearYoutubeClientSecret" />
                  <span>Remove OAuth secret</span>
                </label>
              </div>
              <div class="cfg-provider-header" style="margin-top: var(--hx-space-2)">
                <span class="hx-text-muted">User authorization — {{ formatOAuthStatusLabel(secretStatus?.providers?.youtubeOAuth) }}</span>
                <span class="review-status-pill" :class="secretStatus?.providers?.youtubeOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                  {{ secretStatus?.providers?.youtubeOAuth?.linked ? 'Linked' : 'Not linked' }}
                </span>
              </div>
              <div class="hx-card-actions">
                <button type="button" class="hx-btn" @click="connectYouTubeOAuth" :disabled="isStartingYouTubeOAuth">
                  {{ isStartingYouTubeOAuth ? 'Starting…' : 'Connect YouTube' }}
                </button>
                <button type="button" class="hx-btn" @click="disconnectYouTubeOAuth" :disabled="isClearingYouTubeOAuth || !secretStatus?.providers?.youtubeOAuth?.linked">
                  {{ isClearingYouTubeOAuth ? 'Clearing…' : 'Clear authorization' }}
                </button>
              </div>
            </div>

            <!-- Apple Music -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Apple Music</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.appleMusic?.privateKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.appleMusic, 'privateKeyConfigured', 'privateKeySource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.appleMusicEnabled" />
                <span>Accept Apple Music playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Team ID</label>
                  <input class="hx-input" v-model="form.providers.appleMusicTeamId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Key ID</label>
                  <input class="hx-input" v-model="form.providers.appleMusicKeyId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Storefront</label>
                  <input class="hx-input" v-model="form.providers.appleMusicStorefront" maxlength="5" placeholder="us" />
                </div>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Private key</label>
                <textarea class="hx-textarea" v-model="form.providers.appleMusicPrivateKey" autocomplete="new-password" :disabled="form.providers.clearAppleMusicPrivateKey" placeholder="Leave blank to keep the current key" rows="4"></textarea>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.clearAppleMusicPrivateKey" />
                <span>Remove the stored Apple Music private key on save</span>
              </label>
            </div>

            <!-- Fanart.tv -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Fanart.tv</h4>
                <span class="review-status-pill" :class="(secretStatus?.providers?.fanartTv?.apiKeyConfigured || secretStatus?.providers?.fanartTv?.clientKeyConfigured) ? 'review-status-selected' : 'review-status-held'">
                  {{ (secretStatus?.providers?.fanartTv?.apiKeyConfigured || secretStatus?.providers?.fanartTv?.clientKeyConfigured) ? 'Configured' : 'Not configured' }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.fanartTvEnabled" />
                <span>Enable artist artwork from Fanart.tv</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Project API key</label>
                  <input class="hx-input" v-model="form.providers.fanartTvApiKey" type="password" autocomplete="new-password" :disabled="form.providers.clearFanartTvApiKey" placeholder="Leave blank to keep" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Personal API key</label>
                  <input class="hx-input" v-model="form.providers.fanartTvClientKey" type="password" autocomplete="new-password" :disabled="form.providers.clearFanartTvClientKey" placeholder="Leave blank to keep" />
                </div>
              </div>
              <p class="cfg-field-hint">Project key provides application-level access (7-day delay). Personal key takes priority (2-day delay). At least one key is required. Get keys at <a href="https://fanart.tv/get-an-api-key/" target="_blank" rel="noopener">fanart.tv</a>.</p>
              <div class="hx-card-actions">
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearFanartTvApiKey" />
                  <span>Remove project key</span>
                </label>
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearFanartTvClientKey" />
                  <span>Remove personal key</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      </article>

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

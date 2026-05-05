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
  createEmptyDownloadMapping,
  createEmptyUserMusicRoot,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../lib/settings-form.js';

const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const pathValidation = ref(null);

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
  pathValidation.value = payload.pathValidation ?? null;
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

function statusTone(status) {
  switch (status) {
    case 'healthy': return 'success';
    case 'unavailable': return 'danger';
    default: return 'warning';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'unavailable': return 'Unavailable';
    default: return 'Needs attention';
  }
}

function addDownloadMapping() { form.paths.downloadMappings.push(createEmptyDownloadMapping()); }
function removeDownloadMapping(index) { form.paths.downloadMappings.splice(index, 1); }
function addUserMusicRoot() { form.paths.userMusicRoots.push(createEmptyUserMusicRoot()); }
function removeUserMusicRoot(index) { form.paths.userMusicRoots.splice(index, 1); }

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

        <!-- Artwork behaviour -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Artwork</h3>
              <p class="hx-card-subtitle">Fetch, extraction, derivative generation, and automatic refresh triggers.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.fetchEnabled" />
              <span>Enable external artwork fetching</span>
            </label>
            <div class="hx-field">
              <label class="hx-field-label">Preferred provider order</label>
              <input class="hx-input" v-model="form.artwork.providerOrderText" placeholder="coverArtArchive, discogs, theAudioDb" />
            </div>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.captureEmbedded" />
              <span>Let embedded artwork become durable app-owned artwork</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.captureFolderArtwork" />
              <span>Let candidate-folder artwork become durable app-owned artwork</span>
            </label>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Derivative format</label>
                <select class="hx-select" v-model="form.artwork.derivativeFormat">
                  <option value="webp">webp</option>
                  <option value="jpeg">jpeg</option>
                  <option value="png">png</option>
                </select>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Derivative sizes</label>
                <input class="hx-input" v-model="form.artwork.derivativeSizesText" placeholder="256, 512" />
              </div>
            </div>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Max original size (bytes)</label>
                <input class="hx-input" v-model.number="form.artwork.maxOriginalFileSizeBytes" type="number" min="1048576" max="104857600" step="1048576" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Max original dimension (px)</label>
                <input class="hx-input" v-model.number="form.artwork.maxOriginalDimensionPixels" type="number" min="256" max="8192" step="64" />
              </div>
            </div>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Derivative cache cap (MB)</label>
                <input class="hx-input" v-model.number="form.artwork.derivativeCacheSizeMb" type="number" min="64" max="16384" step="64" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Derivative retention (days)</label>
                <input class="hx-input" v-model.number="form.artwork.derivativeRetentionDays" type="number" min="1" max="3650" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Unassigned originals retention (days)</label>
                <input class="hx-input" v-model.number="form.artwork.unassignedRetentionDays" type="number" min="1" max="3650" />
              </div>
            </div>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.refreshAfterMetadataRefresh" />
              <span>Refresh artwork after metadata refresh</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.refreshAfterImport" />
              <span>Refresh artwork after import acceptance</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.refreshAfterLibraryScan" />
              <span>Refresh artwork after library scans</span>
            </label>
            <label class="cfg-check">
              <input type="checkbox" v-model="form.artwork.refetchMissingAutomatically" />
              <span>Refetch missing artwork automatically</span>
            </label>
          </div>
        </article>

        <!-- Paths -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Paths</h3>
              <p class="hx-card-subtitle">Core filesystem roots, download translation mappings, and per-user placement.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Downloads</label>
                <input class="hx-input" v-model="form.paths.downloads" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Music</label>
                <input class="hx-input" v-model="form.paths.music" />
              </div>
            </div>
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label">Staging</label>
                <input class="hx-input" v-model="form.paths.staging" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Transcode temp</label>
                <input class="hx-input" v-model="form.paths.transcodeTemp" />
              </div>
            </div>

            <!-- Download mappings -->
            <div class="cfg-subsection">
              <div class="cfg-subsection-header">
                <div>
                  <p class="cfg-subsection-label">Download path mappings</p>
                  <p class="hx-text-muted">Map slskd completed-download paths into Harmoniarr's local namespace.</p>
                </div>
                <button type="button" class="hx-btn" @click="addDownloadMapping">Add mapping</button>
              </div>
              <div class="hx-empty" v-if="!form.paths.downloadMappings.length">
                <p class="hx-empty-copy">Without explicit mappings, preview resolution falls back to the downloads root with a warning.</p>
              </div>
              <div class="cfg-mapping-list" v-else>
                <div class="cfg-mapping-card" v-for="(mapping, index) in form.paths.downloadMappings" :key="index">
                  <div class="hx-form-row">
                    <div class="hx-field">
                      <label class="hx-field-label">slskd prefix</label>
                      <input class="hx-input" v-model="mapping.slskdPrefix" placeholder="/downloads/completed" />
                    </div>
                    <div class="hx-field">
                      <label class="hx-field-label">Harmoniarr prefix</label>
                      <input class="hx-input" v-model="mapping.harmoniarrPrefix" placeholder="/data/downloads/completed" />
                    </div>
                  </div>
                  <button type="button" class="hx-btn" data-variant="ghost" @click="removeDownloadMapping(index)">Remove</button>
                </div>
              </div>
            </div>

            <!-- Per-user music roots -->
            <div class="cfg-subsection">
              <div class="cfg-subsection-header">
                <div>
                  <p class="cfg-subsection-label">Per-user music roots</p>
                  <p class="hx-text-muted">Map user IDs onto subdirectories under the shared music root.</p>
                </div>
                <button type="button" class="hx-btn" @click="addUserMusicRoot">Add user root</button>
              </div>
              <div class="hx-empty" v-if="!form.paths.userMusicRoots.length">
                <p class="hx-empty-copy">Preview falls back to the shared library root until a user-specific destination is configured.</p>
              </div>
              <div class="cfg-mapping-list" v-else>
                <div class="cfg-mapping-card" v-for="(userMusicRoot, index) in form.paths.userMusicRoots" :key="`user-music-root-${index}`">
                  <div class="hx-form-row">
                    <div class="hx-field">
                      <label class="hx-field-label">App user ID</label>
                      <input class="hx-input" v-model="userMusicRoot.userId" placeholder="user-1" />
                    </div>
                    <div class="hx-field">
                      <label class="hx-field-label">Relative subdirectory</label>
                      <input class="hx-input" v-model="userMusicRoot.relativeRoot" placeholder="household/alice" />
                    </div>
                  </div>
                  <button type="button" class="hx-btn" data-variant="ghost" @click="removeUserMusicRoot(index)">Remove</button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- Path validation (read-only, shown post-save) -->
      <article class="hx-card" style="margin-top: var(--hx-space-4)" v-if="pathValidation">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Path validation</h3>
            <p class="hx-card-subtitle">{{ pathValidation.summary.message }}</p>
          </div>
          <span class="hx-pill" :data-tone="statusTone(pathValidation.summary.status)">
            {{ statusLabel(pathValidation.summary.status) }}
          </span>
        </header>
        <div class="hx-card-body" v-if="pathValidation.roots?.length">
          <div class="dependency-grid">
            <article class="dependency-card" :class="`dependency-card-${root.status}`" v-for="root in pathValidation.roots" :key="root.key">
              <div class="dependency-card-header">
                <div>
                  <p>{{ root.label }}</p>
                  <strong>{{ root.path }}</strong>
                </div>
                <span class="dependency-status-dot" />
              </div>
              <p class="dependency-message">{{ root.message }}</p>
              <p class="dependency-observed" v-if="root.resolvedPath && root.resolvedPath !== root.path">Resolved {{ root.resolvedPath }}</p>
            </article>
          </div>
        </div>
        <div class="hx-card-body" v-if="pathValidation.downloadMappings?.length">
          <div class="cfg-mapping-list">
            <div class="cfg-mapping-card" v-for="mapping in pathValidation.downloadMappings" :key="mapping.index">
              <div class="cfg-provider-header">
                <span>
                  <strong>Mapping {{ mapping.index + 1 }}</strong>
                  <span class="hx-text-muted"> — {{ mapping.slskdPrefix }} → {{ mapping.harmoniarrPrefix }}</span>
                </span>
                <span class="hx-pill" :data-tone="statusTone(mapping.status)">{{ statusLabel(mapping.status) }}</span>
              </div>
              <p class="hx-text-muted">{{ mapping.message }}</p>
              <dl class="review-meta-grid review-meta-grid-wide">
                <div><dt>Example source</dt><dd>{{ mapping.exampleSourcePath }}</dd></div>
                <div><dt>Example translated</dt><dd>{{ mapping.exampleTranslatedPath }}</dd></div>
              </dl>
            </div>
          </div>
        </div>
        <div class="hx-card-body" v-if="pathValidation.userMusicRoots?.length">
          <div class="cfg-mapping-list">
            <div class="cfg-mapping-card" v-for="userMusicRoot in pathValidation.userMusicRoots" :key="`validated-user-root-${userMusicRoot.index}`">
              <div class="cfg-provider-header">
                <span>
                  <strong>Per-user root {{ userMusicRoot.index + 1 }}</strong>
                  <span class="hx-text-muted"> — {{ userMusicRoot.userId }} → {{ userMusicRoot.relativeRoot }}</span>
                </span>
                <span class="hx-pill" :data-tone="statusTone(userMusicRoot.status)">{{ statusLabel(userMusicRoot.status) }}</span>
              </div>
              <p class="hx-text-muted">{{ userMusicRoot.message }}</p>
            </div>
          </div>
        </div>
        <div class="hx-card-body" v-if="!pathValidation.downloadMappings?.length && !pathValidation.userMusicRoots?.length">
          <p class="hx-text-muted">{{ pathValidation.notes?.remoteSlskdValidation }}</p>
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

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
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchSettings, updateSettings } from '../lib/settings-api.js';
import {
  buildSettingsUpdatePayload,
  createEmptyDownloadMapping,
  createEmptyUserMusicRoot,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../lib/settings-form.js';
import FolderBrowserModal from '../components/FolderBrowserModal.vue';

const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const pathValidation = ref(null);

const browseTarget = ref(null); // which form field key is being browsed
const browseInitial = ref('/');
const browseLabel = ref('Select a folder');
const browseOpen = ref(false);

function openBrowse(label, currentValue, callback) {
  browseLabel.value = label;
  browseInitial.value = currentValue || '/';
  browseTarget.value = callback;
  browseOpen.value = true;
}

function onBrowseSelect(path) {
  if (typeof browseTarget.value === 'function') {
    browseTarget.value(path);
  }
  browseOpen.value = false;
}

function onBrowseClose() {
  browseOpen.value = false;
}

const maxOriginalFileSizeMb = computed({
  get: () => Math.round(form.artwork.maxOriginalFileSizeBytes / 1048576),
  set: (mb) => { form.artwork.maxOriginalFileSizeBytes = Math.round(mb) * 1048576; },
});

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

        <!-- Cover art -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Cover art</h3>
              <p class="hx-card-subtitle">How Harmoniarr finds and stores album artwork.</p>
            </div>
          </header>
          <div class="hx-card-body">

            <div class="cfg-group">
              <p class="cfg-group-title">Finding art</p>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.fetchEnabled" />
                <span>Download cover art from the internet</span>
              </label>
              <p class="cfg-field-hint">Searches online sources for album covers automatically.</p>
              <div class="hx-field" v-if="form.artwork.fetchEnabled">
                <label class="hx-field-label">Sources to try</label>
                <input class="hx-input" v-model="form.artwork.providerOrderText" placeholder="coverArtArchive" />
                <p class="cfg-field-hint">Try these sources in order, separated by commas. <code>coverArtArchive</code> is the main free source.</p>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.captureEmbedded" />
                <span>Pull art from inside your audio files</span>
              </label>
              <p class="cfg-field-hint">Extracts cover art embedded in .flac, .mp3, .m4a, and similar files.</p>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.captureFolderArtwork" />
                <span>Use cover images found in download folders</span>
              </label>
              <p class="cfg-field-hint">Picks up cover.jpg or folder.jpg files sitting alongside your music.</p>
            </div>

            <div class="cfg-group">
              <p class="cfg-group-title">Thumbnails</p>
              <p class="hx-text-muted">The app keeps small display copies of each cover so pages load quickly. These are <strong>cache files only</strong> — your actual artwork is stored separately and is never deleted just because a thumbnail expires. Leave everything in this section at the defaults.</p>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Image format</label>
                  <select class="hx-select" v-model="form.artwork.derivativeFormat">
                    <option value="webp">WebP — best choice for most people</option>
                    <option value="jpeg">JPEG — if you're seeing display issues</option>
                    <option value="png">PNG — lossless, largest file size</option>
                  </select>
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Thumbnail sizes</label>
                  <input class="hx-input" v-model="form.artwork.derivativeSizesText" placeholder="256, 512" />
                  <p class="cfg-field-hint">Leave this at the default. These are the sizes (in pixels) the app pre-generates so covers load quickly — changing it is rarely needed.</p>
                </div>
              </div>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Max thumbnail storage (MB)</label>
                  <input class="hx-input" v-model.number="form.artwork.derivativeCacheSizeMb" type="number" min="64" max="16384" step="64" />
                  <p class="cfg-field-hint">How much disk space thumbnails can use. 1,024 MB is plenty for most libraries. Old ones are deleted automatically when this limit is hit.</p>
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Regenerate after (days)</label>
                  <input class="hx-input" v-model.number="form.artwork.derivativeRetentionDays" type="number" min="1" max="3650" />
                  <p class="cfg-field-hint">When a cached thumbnail is older than this, the app quietly regenerates it from the original. Your artwork is not deleted — only the small display copy is refreshed.</p>
                </div>
              </div>
            </div>

            <div class="cfg-group">
              <p class="cfg-group-title">Storage limits</p>
              <p class="hx-text-muted">These guard against storing absurdly large or corrupt image files. You almost certainly don't need to change any of this.</p>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Ignore images over this size (MB)</label>
                  <input class="hx-input" v-model.number="maxOriginalFileSizeMb" type="number" min="1" max="100" step="1" />
                  <p class="cfg-field-hint">Leave this at the default (20 MB). Images bigger than this are probably not real album art.</p>
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Ignore images wider than this (px)</label>
                  <input class="hx-input" v-model.number="form.artwork.maxOriginalDimensionPixels" type="number" min="256" max="8192" step="64" />
                  <p class="cfg-field-hint">Leave this at the default (4,000 px). Same idea — album art isn't that wide.</p>
                </div>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Remove art with no album attached after (days)</label>
                <input class="hx-input" v-model.number="form.artwork.unassignedRetentionDays" type="number" min="1" max="3650" />
                <p class="cfg-field-hint">Art that is linked to an album in your library is <strong>never</strong> automatically deleted. This only removes stray image files that aren't attached to anything — for example leftovers from a failed import.</p>
              </div>
            </div>

            <div class="cfg-group">
              <p class="cfg-group-title">Automatic refresh</p>
              <p class="hx-text-muted">Choose when Harmoniarr should look for better artwork on its own.</p>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.refreshAfterMetadataRefresh" />
                <span>After metadata is refreshed</span>
              </label>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.refreshAfterImport" />
                <span>When an album is imported</span>
              </label>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.refreshAfterLibraryScan" />
                <span>During library scans</span>
              </label>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.artwork.refetchMissingAutomatically" />
                <span>Keep looking for missing art automatically</span>
              </label>
              <p class="cfg-field-hint" v-if="form.artwork.refetchMissingAutomatically">Harmoniarr will periodically retry albums that don't have any artwork yet.</p>
            </div>

          </div>
        </article>

        <!-- Folder locations -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Folder locations</h3>
              <p class="hx-card-subtitle">Tell Harmoniarr where your files live on disk.</p>
            </div>
          </header>
          <div class="hx-card-body">

            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <div class="hx-field">
                <label class="hx-field-label">Downloads folder</label>
                <div class="hx-field-with-browse">
                  <input class="hx-input" v-model="form.paths.downloads" />
                  <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Downloads folder', form.paths.downloads, v => form.paths.downloads = v)">Browse…</button>
                </div>
                <p class="cfg-field-hint">Where slskd puts completed downloads. Harmoniarr reads from here.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Music library</label>
                <div class="hx-field-with-browse">
                  <input class="hx-input" v-model="form.paths.music" />
                  <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Music library', form.paths.music, v => form.paths.music = v)">Browse…</button>
                </div>
                <p class="cfg-field-hint">Your organized music collection. Accepted imports are moved here.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Staging area</label>
                <div class="hx-field-with-browse">
                  <input class="hx-input" v-model="form.paths.staging" />
                  <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Staging area', form.paths.staging, v => form.paths.staging = v)">Browse…</button>
                </div>
                <p class="cfg-field-hint">A holding area where files wait while an import is being reviewed.</p>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Transcode workspace</label>
                <div class="hx-field-with-browse">
                  <input class="hx-input" v-model="form.paths.transcodeTemp" />
                  <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Transcode workspace', form.paths.transcodeTemp, v => form.paths.transcodeTemp = v)">Browse…</button>
                </div>
                <p class="cfg-field-hint">Temporary space used when converting audio formats. Can point to fast storage.</p>
              </div>
            </div>

            <!-- Path translations -->
            <div class="cfg-group">
              <div class="cfg-subsection-header">
                <div>
                  <p class="cfg-group-title">Path translations</p>
                  <p class="hx-text-muted">slskd and Harmoniarr may run in separate containers with different folder names pointing to the same place on disk. Add a translation for each mismatch.</p>
                </div>
                <button type="button" class="hx-btn" @click="addDownloadMapping">Add</button>
              </div>
              <div class="hx-empty" v-if="!form.paths.downloadMappings.length">
                <p class="hx-empty-copy">Not needed if slskd and Harmoniarr share the same folder paths.</p>
              </div>
              <div class="cfg-mapping-list" v-else>
                <div class="cfg-mapping-card" v-for="(mapping, index) in form.paths.downloadMappings" :key="index">
                  <div class="hx-form-row">
                    <div class="hx-field">
                      <label class="hx-field-label">slskd sees this path</label>
                      <input class="hx-input" v-model="mapping.slskdPrefix" placeholder="/downloads/complete" />
                    </div>
                    <div class="hx-field">
                      <label class="hx-field-label">Harmoniarr sees it as</label>
                      <input class="hx-input" v-model="mapping.harmoniarrPrefix" placeholder="/data/downloads/complete" />
                    </div>
                  </div>
                  <button type="button" class="hx-btn" data-variant="ghost" @click="removeDownloadMapping(index)">Remove</button>
                </div>
              </div>
            </div>

            <!-- Per-user library folders -->
            <div class="cfg-group">
              <div class="cfg-subsection-header">
                <div>
                  <p class="cfg-group-title">Per-user library folders</p>
                  <p class="hx-text-muted">Give each user their own subfolder inside the music library. Their imports go into that folder instead of the shared root.</p>
                </div>
                <button type="button" class="hx-btn" @click="addUserMusicRoot">Add</button>
              </div>
              <div class="hx-empty" v-if="!form.paths.userMusicRoots.length">
                <p class="hx-empty-copy">Without a personal folder, everyone's imports land in the shared library root.</p>
              </div>
              <div class="cfg-mapping-list" v-else>
                <div class="cfg-mapping-card" v-for="(userMusicRoot, index) in form.paths.userMusicRoots" :key="`user-music-root-${index}`">
                  <div class="hx-form-row">
                    <div class="hx-field">
                      <label class="hx-field-label">User</label>
                      <input class="hx-input" v-model="userMusicRoot.userId" placeholder="alice" />
                    </div>
                    <div class="hx-field">
                      <label class="hx-field-label">Subfolder</label>
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

    <FolderBrowserModal
      v-if="browseOpen"
      :initial="browseInitial"
      :label="browseLabel"
      @select="onBrowseSelect"
      @close="onBrowseClose"
    />
  </div>
</template>

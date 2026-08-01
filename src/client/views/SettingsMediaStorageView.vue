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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  formatProviderLabel,
  formatQuotaPercentage,
  formatQuotaRemaining,
  formatQuotaUsage,
  resolveQuotaTone,
  buildSparklineData,
} from '../lib/artwork-quota-presentation.js';
import {
  createEmptyDownloadMapping,
  createEmptyUserMusicRoot,
} from '../lib/settings-form.js';
import {
  buildDownloadMappingSourceLabel,
  buildDownloadsPathHint,
  buildPathTranslationSetupPrompt,
  buildPathTranslationsDescription,
  buildPathTranslationsEmptyState,
} from '../lib/settings-media-storage-presentation.js';
import FolderBrowserModal from '../components/FolderBrowserModal.vue';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import SettingsFolderReadiness from '../components/settings/SettingsFolderReadiness.vue';
import SettingsFormGroup from '../components/settings/SettingsFormGroup.vue';
import SettingsRecoveryConfirmation from '../components/settings/SettingsRecoveryConfirmation.vue';
import SettingsSaveBar from '../components/settings/SettingsSaveBar.vue';
import { useArtworkQuota } from '../composables/useArtworkQuota.js';
import { useQuotaHistory } from '../composables/useQuotaHistory.js';
import { useSettingsForm } from '../composables/useSettingsForm.js';
import {
  buildSettingsFolderRecoveryConfirmation,
  resolveSettingsRecoveryContext,
} from '../lib/settings-recovery-handoff.js';
import { buildSettingsMusicQueueSafeAddRecheckConfirmation } from '../lib/settings-music-queue-safe-add-recheck-presentation.js';
import { buildSettingsSaveState } from '../lib/settings-save-state-presentation.js';
import { recheckMusicQueueReleaseSafeAdd } from '../lib/acquisition-api.js';

const route = useRoute();
const pathValidation = ref(null);
const recoveryConfirmation = ref(null);

const artworkQuota = useArtworkQuota();

const quotaHistory = useQuotaHistory({ days: 30 });

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
} = useSettingsForm({
  extraApply: (payload) => { pathValidation.value = payload.pathValidation ?? null; },
  onSaveSuccess: () => {
    void artworkQuota.revalidate();
    void quotaHistory.revalidate();
  },
});

const browseTarget = ref(null);
const browseInitial = ref('/');
const browseLabel = ref('Select a folder');
const browseOpen = ref(false);
const isPathTranslationsOpen = ref(false);

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

function addDownloadMapping() {
  form.paths.downloadMappings.push({
    ...createEmptyDownloadMapping(),
    harmoniarrPrefix: form.paths.downloads,
  });
  isPathTranslationsOpen.value = true;
}
function removeDownloadMapping(index) { form.paths.downloadMappings.splice(index, 1); }
function addUserMusicRoot() { form.paths.userMusicRoots.push(createEmptyUserMusicRoot()); }
function removeUserMusicRoot(index) { form.paths.userMusicRoots.splice(index, 1); }

const providerSparklines = computed(() => {
  if (!quotaHistory.history.value) return {};
  const result = {};
  for (const provider of Object.keys(quotaHistory.history.value.history)) {
    result[provider] = buildSparklineData(
      quotaHistory.history.value.history[provider],
      quotaHistory.history.value.limit,
    );
  }
  return result;
});

const settingsSaveState = computed(() => buildSettingsSaveState({
  hasSaved: hasSaved.value,
  isDirty: isDirty.value,
  isSaving: isSaving.value,
  saveErrorMessage: saveErrorMessage.value,
  successMessage: successMessage.value,
}));

const pathTranslationSetupPrompt = computed(() => buildPathTranslationSetupPrompt({
  downloadMappingCount: form.paths.downloadMappings.length,
  providerMode: form.slskd.providerMode,
}));
const recoveryContext = computed(() => resolveSettingsRecoveryContext(route.query));

async function handleSaveSettings() {
  recoveryConfirmation.value = null;
  const outcome = await saveSettings();
  if (!outcome?.ok || !recoveryContext.value) return;

  const folderConfirmation = buildSettingsFolderRecoveryConfirmation({
    recoveryContext: recoveryContext.value,
    validation: outcome.payload?.pathValidation ?? pathValidation.value,
  });
  if (folderConfirmation?.outcome !== 'ready' || !recoveryContext.value.wantedReleaseId) {
    recoveryConfirmation.value = folderConfirmation;
    return;
  }

  try {
    const recheck = await recheckMusicQueueReleaseSafeAdd({
      wantedReleaseId: recoveryContext.value.wantedReleaseId,
    });
    recoveryConfirmation.value = buildSettingsMusicQueueSafeAddRecheckConfirmation({
      recoveryContext: recoveryContext.value,
      recheck,
    }) ?? folderConfirmation;
  } catch {
    recoveryConfirmation.value = folderConfirmation;
  }
}

onMounted(() => { void loadSettings(); });
onMounted(() => { void artworkQuota.loadQuota(); });
onMounted(() => { void quotaHistory.load(); });
onMounted(() => { artworkQuota.attachVisibilityListener(); });
onMounted(() => { quotaHistory.attachVisibilityListener(); });
onBeforeUnmount(() => { artworkQuota.destroy(); });
onBeforeUnmount(() => { quotaHistory.destroy(); });
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

    <form @submit.prevent="handleSaveSettings" v-else>
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Media folders</h3>
            <p class="hx-card-subtitle">Required locations for downloads, staging, and your music library.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <SettingsFormGroup
            kind="core"
            title="Required folders"
            description="Harmoniarr must reach all three folders before it can download and add music automatically."
          >
            <div class="hx-field">
              <label class="hx-field-label" for="settings-downloads-folder">Downloads folder</label>
              <div class="hx-field-with-browse">
                <input id="settings-downloads-folder" class="hx-input" v-model="form.paths.downloads" />
                <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Downloads folder', form.paths.downloads, v => form.paths.downloads = v)">Browse…</button>
              </div>
              <p class="cfg-field-hint">{{ buildDownloadsPathHint() }}</p>
            </div>
            <div class="hx-field">
              <label class="hx-field-label" for="settings-music-library">Music library</label>
              <div class="hx-field-with-browse">
                <input id="settings-music-library" class="hx-input" v-model="form.paths.music" />
                <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Music library', form.paths.music, v => form.paths.music = v)">Browse…</button>
              </div>
            </div>
            <div class="hx-field">
              <label class="hx-field-label" for="settings-staging-area">Staging area</label>
              <div class="hx-field-with-browse">
                <input id="settings-staging-area" class="hx-input" v-model="form.paths.staging" />
                <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Staging area', form.paths.staging, v => form.paths.staging = v)">Browse…</button>
              </div>
            </div>
            <SettingsFolderReadiness :validation="pathValidation" />
          </SettingsFormGroup>

          <div v-if="pathTranslationSetupPrompt" class="cfg-download-setup" role="status">
            <div>
              <strong>{{ pathTranslationSetupPrompt.title }}</strong>
              <p>{{ pathTranslationSetupPrompt.description }}</p>
            </div>
            <button type="button" class="hx-btn" data-variant="primary" @click="addDownloadMapping">
              {{ pathTranslationSetupPrompt.actionLabel }}
            </button>
          </div>

          <SettingsDisclosure
            v-model:open="isPathTranslationsOpen"
            panel-id="settings-path-translations"
            action-style="compact"
            category="advanced"
            title="Path translations"
            :subtitle="buildPathTranslationsDescription()"
            show-label="Show path translations"
            hide-label="Hide path translations"
            variant="inline"
          >
            <div class="cfg-subsection-header">
              <p class="cfg-group-title">Path translations</p>
              <button type="button" class="hx-btn" @click="addDownloadMapping">Add path translation</button>
            </div>
            <div class="hx-empty" v-if="!form.paths.downloadMappings.length">
              <p class="hx-empty-copy">{{ buildPathTranslationsEmptyState() }}</p>
            </div>
            <div class="cfg-mapping-list" v-else>
              <div class="cfg-mapping-card" v-for="(mapping, index) in form.paths.downloadMappings" :key="index">
                <div class="hx-form-row">
                  <div class="hx-field">
                    <label class="hx-field-label">{{ buildDownloadMappingSourceLabel() }}</label>
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
          </SettingsDisclosure>

          <SettingsDisclosure
            panel-id="settings-additional-folder-options"
            action-style="compact"
            category="advanced"
            title="Additional folders"
            subtitle="Audio conversion workspace and separate household library folders."
            show-label="Show additional folder options"
            hide-label="Hide additional folder options"
            variant="inline"
          >
            <div class="hx-field">
              <label class="hx-field-label" for="settings-transcode-workspace">Transcode workspace</label>
              <div class="hx-field-with-browse">
                <input id="settings-transcode-workspace" class="hx-input" v-model="form.paths.transcodeTemp" />
                <button type="button" class="hx-btn fb-trigger" @click="openBrowse('Transcode workspace', form.paths.transcodeTemp, v => form.paths.transcodeTemp = v)">Browse…</button>
              </div>
              <p class="cfg-field-hint">Temporary space used when converting audio formats. It can point to fast storage.</p>
            </div>
            <div class="cfg-group">
              <div class="cfg-subsection-header">
                <div>
                  <p class="cfg-group-title">Per-user library folders</p>
                  <p class="hx-text-muted">Give each user a subfolder inside the music library instead of using the shared root.</p>
                </div>
                <button type="button" class="hx-btn" @click="addUserMusicRoot">Add folder</button>
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
          </SettingsDisclosure>
        </div>
      </article>

      <SettingsRecoveryConfirmation :confirmation="recoveryConfirmation" />

      <div class="settings-media-storage__artwork-stack">

        <SettingsDisclosure
          panel-id="settings-cover-art"
          action-style="compact"
          category="optional"
          title="Cover art"
          subtitle="Find and cache album images when you want them."
          show-label="Show cover art settings"
          hide-label="Hide cover art settings"
        >

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
                <p class="cfg-field-hint">Try sources in order, separated by commas. <code>coverArtArchive</code> is the default and the main free option (Cover Art Archive).</p>
              </div>
              <div class="hx-field" v-if="form.artwork.fetchEnabled">
                <label class="hx-field-label">Daily request limit</label>
                <input class="hx-input" v-model.number="form.artwork.dailyQuotaLimit" type="number" min="1" max="100000" step="1" />
                <p class="cfg-field-hint">Maximum external API calls per day across all providers. Prevents excessive usage. Resets at midnight UTC.</p>
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
                  <input class="hx-input" v-model.number="form.artwork.maxOriginalDimensionPixels" type="number" min="256" max="8192" step="1" />
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

        </SettingsDisclosure>

      </div>

      <SettingsDisclosure
        v-if="artworkQuota.quota.value"
        panel-id="settings-artwork-provider-usage"
        action-style="compact"
        category="optional"
        title="Artwork provider usage"
        subtitle="Daily request usage for external artwork providers. Resets at midnight UTC."
        show-label="Show artwork provider usage"
        hide-label="Hide artwork provider usage"
      >
        <div class="settings-media-storage__quota-status" role="status" aria-atomic="true">
          <span class="hx-pill" :data-tone="artworkQuota.anyExceeded.value ? 'danger' : 'success'">
            {{ artworkQuota.anyExceeded.value ? 'Limit reached' : 'Within limits' }}
          </span>
          <span class="hx-text-muted">{{ artworkQuota.anyExceeded.value ? 'Artwork requests will resume after the next daily reset.' : 'Artwork requests are within the daily limit.' }}</span>
        </div>
          <div class="cfg-quota-grid">
            <div class="cfg-quota-card" v-for="provider in artworkQuota.providers.value" :key="provider.provider">
              <div class="cfg-quota-header">
                <strong>{{ formatProviderLabel(provider.provider) }}</strong>
                <span class="hx-pill" :data-tone="resolveQuotaTone(provider.exceeded, provider.used, provider.limit)">
                  {{ formatQuotaUsage(provider.used, provider.limit) }}
                </span>
              </div>
              <div class="cfg-quota-bar-track">
                <div
                  class="cfg-quota-bar-fill"
                  :style="{ '--quota-fill': formatQuotaPercentage(provider.used, provider.limit) + '%' }"
                  :data-tone="resolveQuotaTone(provider.exceeded, provider.used, provider.limit)"
                />
              </div>
              <p class="cfg-quota-meta">{{ formatQuotaRemaining(provider.remaining) }}</p>
              <div
                v-if="providerSparklines[provider.provider]?.length"
                class="cfg-sparkline"
                :aria-label="`${formatProviderLabel(provider.provider)} usage over 30 days`"
                role="img"
              >
                <span
                  v-for="bar in providerSparklines[provider.provider]"
                  :key="bar.date"
                  class="cfg-sparkline-bar"
                  :data-tone="bar.tone"
                  :style="{ '--bar-height': bar.height + '%' }"
                  :title="`${bar.date}: ${bar.requestCount}`"
                />
              </div>
            </div>
          </div>
      </SettingsDisclosure>

      <SettingsSaveBar :save-state="settingsSaveState" />
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

<style scoped>
.settings-media-storage__artwork-stack {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
}

.settings-media-storage__quota-status {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  margin-bottom: var(--hx-space-3);
}

.cfg-quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--hx-space-4);
}

.cfg-quota-card {
  display: grid;
  gap: var(--hx-space-2);
}

.cfg-quota-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--hx-space-2);
}

.cfg-quota-bar-track {
  height: 6px;
  background: var(--hx-bg-surface-sunken);
  border-radius: var(--hx-radius-full);
  overflow: hidden;
}

.cfg-quota-bar-fill {
  height: 100%;
  width: var(--quota-fill, 0%);
  border-radius: var(--hx-radius-full);
  transition: width 0.3s ease;
}

.cfg-quota-bar-fill[data-tone="success"] { background: oklch(0.65 0.15 150); }
.cfg-quota-bar-fill[data-tone="warning"] { background: oklch(0.75 0.15 80); }
.cfg-quota-bar-fill[data-tone="danger"]  { background: oklch(0.6 0.18 25); }

.cfg-quota-meta {
  font-size: var(--hx-font-size-sm);
  color: var(--hx-text-secondary);
}

.cfg-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 2rem;
  padding-top: var(--hx-space-1);
}

.cfg-sparkline-bar {
  flex: 1;
  min-width: 2px;
  height: var(--bar-height, 1%);
  border-radius: 1px 1px 0 0;
  transition: height 0.3s ease;
}

.cfg-sparkline-bar[data-tone="success"] { background: oklch(0.65 0.15 150 / 0.6); }
.cfg-sparkline-bar[data-tone="warning"] { background: oklch(0.75 0.15 80 / 0.7); }
.cfg-sparkline-bar[data-tone="danger"]  { background: oklch(0.6 0.18 25 / 0.7); }
</style>

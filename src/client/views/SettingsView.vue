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

const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const pathValidation = ref(null);
const successMessage = ref('');
const form = reactive({
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
  },
});

function createEmptyDownloadMapping() {
  return {
    harmoniarrPrefix: '',
    slskdPrefix: '',
  };
}

function normalizeDownloadMappings(value) {
  return Array.isArray(value)
    ? value.map((entry) => ({
      harmoniarrPrefix: typeof entry?.harmoniarrPrefix === 'string' ? entry.harmoniarrPrefix : '',
      slskdPrefix: typeof entry?.slskdPrefix === 'string' ? entry.slskdPrefix : '',
    }))
    : [];
}

function applySettings(payload) {
  Object.assign(form.system, payload.settings.system);
  Object.assign(form.paths, {
    ...payload.settings.paths,
    downloadMappings: form.paths.downloadMappings,
  });
  pathValidation.value = payload.pathValidation ?? null;
  form.paths.downloadMappings.splice(
    0,
    form.paths.downloadMappings.length,
    ...normalizeDownloadMappings(payload.settings.paths?.downloadMappings),
  );
}

function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Needs attention';
  }
}

function statusClass(status) {
  switch (status) {
    case 'healthy':
      return 'review-status-selected';
    case 'unavailable':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function addDownloadMapping() {
  form.paths.downloadMappings.push(createEmptyDownloadMapping());
}

function removeDownloadMapping(index) {
  form.paths.downloadMappings.splice(index, 1);
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
    const payload = await updateSettings({
      system: { ...form.system },
      paths: {
        ...form.paths,
        downloadMappings: normalizeDownloadMappings(form.paths.downloadMappings),
      },
    });
    applySettings(payload);
    successMessage.value = 'Settings saved.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings save failed';
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">System configuration</p>
      <h2>Settings contract</h2>
      <p>The first protected settings surface now persists allowlisted path and runtime keys.</p>
    </article>

    <article class="panel-light" v-if="isLoading">
      <h3>Loading settings</h3>
      <p>Fetching the current allowlisted settings.</p>
    </article>

    <article class="panel-light error-panel" v-else-if="errorMessage && !successMessage">
      <h3>Settings unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <article class="panel-light" v-else>
      <form class="settings-grid" @submit.prevent="saveSettings">
        <section>
          <p class="eyebrow">System</p>
          <label>
            Base URL
            <input v-model="form.system.baseUrl" placeholder="https://harmoniarr.example" />
          </label>
          <label>
            Log level
            <select v-model="form.system.logLevel">
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
        </section>

        <section>
          <p class="eyebrow">Paths</p>
          <label>
            Downloads
            <input v-model="form.paths.downloads" />
          </label>
          <label>
            Music
            <input v-model="form.paths.music" />
          </label>
          <label>
            Staging
            <input v-model="form.paths.staging" />
          </label>
          <label>
            Transcode temp
            <input v-model="form.paths.transcodeTemp" />
          </label>

          <section class="settings-mapping-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">Download path mappings</p>
                <p class="metadata-card-copy">Map the slskd completed-download namespace into Harmoniarr's local downloads namespace. This preview stays explicit and avoids guessing when multiple mappings could apply.</p>
              </div>
              <button type="button" class="review-reset-button" @click="addDownloadMapping">Add mapping</button>
            </div>

            <article class="panel-light review-empty-state" v-if="!form.paths.downloadMappings.length">
              <h3>No mappings configured</h3>
              <p>Without explicit mappings, preview resolution falls back to the configured downloads root and marks that assumption as a warning.</p>
            </article>

            <div class="settings-mapping-list" v-else>
              <article class="settings-mapping-card" v-for="(mapping, index) in form.paths.downloadMappings" :key="index">
                <label>
                  slskd prefix
                  <input v-model="mapping.slskdPrefix" placeholder="/downloads/completed" />
                </label>
                <label>
                  Harmoniarr prefix
                  <input v-model="mapping.harmoniarrPrefix" placeholder="/data/downloads/completed" />
                </label>
                <button type="button" class="review-reset-button" @click="removeDownloadMapping(index)">Remove mapping</button>
              </article>
            </div>
          </section>

          <section class="settings-validation-section" v-if="pathValidation">
            <div class="section-header">
              <div>
                <p class="eyebrow">Path validation</p>
                <p class="metadata-card-copy">{{ pathValidation.summary.message }}</p>
              </div>
              <span class="review-status-pill" :class="statusClass(pathValidation.summary.status)">
                {{ statusLabel(pathValidation.summary.status) }}
              </span>
            </div>

            <div class="dependency-grid" v-if="pathValidation.roots?.length">
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

            <div class="settings-mapping-list" v-if="pathValidation.downloadMappings?.length">
              <article class="settings-mapping-card" v-for="mapping in pathValidation.downloadMappings" :key="mapping.index">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">Mapping {{ mapping.index + 1 }}</p>
                    <h3>{{ mapping.slskdPrefix }} -> {{ mapping.harmoniarrPrefix }}</h3>
                  </div>
                  <span class="review-status-pill" :class="statusClass(mapping.status)">{{ statusLabel(mapping.status) }}</span>
                </div>
                <p class="metadata-card-copy">{{ mapping.message }}</p>
                <dl class="review-meta-grid review-meta-grid-wide">
                  <div>
                    <dt>Example source</dt>
                    <dd>{{ mapping.exampleSourcePath }}</dd>
                  </div>
                  <div>
                    <dt>Example translated</dt>
                    <dd>{{ mapping.exampleTranslatedPath }}</dd>
                  </div>
                </dl>
              </article>
            </div>

            <article class="panel-light review-empty-state" v-else>
              <h3>No mapping validation rows</h3>
              <p>{{ pathValidation.notes.remoteSlskdValidation }}</p>
            </article>
          </section>
        </section>

        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <p class="success-copy" v-if="successMessage">{{ successMessage }}</p>
        <button type="submit" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save settings' }}
        </button>
      </form>
    </article>
  </section>
</template>

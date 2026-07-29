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
import { computed } from 'vue';
import {
  buildFolderReadinessSummary,
  formatMappingLabel,
  formatPathStatusLabel,
  formatPathStatusTone,
  formatPathValidationNote,
  formatUserRootLabel,
  getFolderReadinessAttention,
} from '../../lib/settings-media-storage-presentation.js';
import SettingsDisclosure from './SettingsDisclosure.vue';

const props = defineProps({
  validation: {
    default: null,
    type: Object,
  },
});

const summary = computed(() => buildFolderReadinessSummary(props.validation));
const roots = computed(() => Array.isArray(props.validation?.roots) ? props.validation.roots : []);
const hasValidationDetails = computed(() => (
  Boolean(props.validation?.downloadMappings?.length)
  || Boolean(props.validation?.userMusicRoots?.length)
  || Boolean(formatPathValidationNote(props.validation?.notes?.remoteSlskdValidation))
));
const attentionCount = computed(() => getFolderReadinessAttention(props.validation).length);
</script>

<template>
  <section class="settings-folder-readiness" aria-labelledby="settings-folder-readiness-heading">
    <div class="settings-folder-readiness__header">
      <div>
        <h4 id="settings-folder-readiness-heading" class="settings-folder-readiness__title">Folder readiness</h4>
        <p class="settings-folder-readiness__subtitle">The last saved check of the folders Harmoniarr uses for downloads and imports.</p>
      </div>
      <span class="hx-pill" :data-tone="summary.tone">{{ summary.statusLabel }}</span>
    </div>

    <p class="settings-folder-readiness__message" role="status" aria-atomic="true">{{ summary.message }}</p>

    <div v-if="roots.length" class="settings-folder-readiness__roots">
      <div v-for="root in roots" :key="root.key" class="settings-folder-readiness__root">
        <div>
          <strong>{{ root.label }}</strong>
          <span class="settings-folder-readiness__path">{{ root.path }}</span>
        </div>
        <span class="hx-pill" :data-tone="formatPathStatusTone(root.status)">
          {{ formatPathStatusLabel(root.status) }}
        </span>
        <p>{{ root.message }}</p>
        <p v-if="root.resolvedPath && root.resolvedPath !== root.path" class="settings-folder-readiness__resolved">
          Resolved {{ root.resolvedPath }}
        </p>
      </div>
    </div>

    <SettingsDisclosure
      v-if="hasValidationDetails"
      panel-id="settings-folder-validation-details"
      title="Folder validation details"
      :subtitle="attentionCount ? `${attentionCount} additional check${attentionCount === 1 ? '' : 's'} need attention.` : 'Review saved path translations and personal folders.'"
      show-label="Show folder validation details"
      hide-label="Hide folder validation details"
      variant="inline"
    >
      <div v-if="validation?.downloadMappings?.length" class="settings-folder-readiness__details">
        <div v-for="mapping in validation?.downloadMappings ?? []" :key="mapping.index" class="settings-folder-readiness__detail-row">
          <div>
            <strong>{{ formatMappingLabel(mapping.index) }}</strong>
            <p>{{ mapping.message }}</p>
          </div>
          <span class="hx-pill" :data-tone="formatPathStatusTone(mapping.status)">{{ formatPathStatusLabel(mapping.status) }}</span>
        </div>
      </div>
      <div v-if="validation?.userMusicRoots?.length" class="settings-folder-readiness__details">
        <div v-for="userMusicRoot in validation?.userMusicRoots ?? []" :key="`validated-user-root-${userMusicRoot.index}`" class="settings-folder-readiness__detail-row">
          <div>
            <strong>{{ formatUserRootLabel(userMusicRoot.index) }}</strong>
            <p>{{ userMusicRoot.message }}</p>
          </div>
          <span class="hx-pill" :data-tone="formatPathStatusTone(userMusicRoot.status)">{{ formatPathStatusLabel(userMusicRoot.status) }}</span>
        </div>
      </div>
      <p v-if="formatPathValidationNote(validation?.notes?.remoteSlskdValidation)" class="hx-text-muted">
        {{ formatPathValidationNote(validation?.notes?.remoteSlskdValidation) }}
      </p>
    </SettingsDisclosure>
  </section>
</template>

<style scoped>
.settings-folder-readiness {
  border-top: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-4);
  padding-top: var(--hx-space-4);
}

.settings-folder-readiness__header,
.settings-folder-readiness__detail-row {
  align-items: center;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
}

.settings-folder-readiness__title,
.settings-folder-readiness__subtitle,
.settings-folder-readiness__message,
.settings-folder-readiness__root p,
.settings-folder-readiness__detail-row p,
.settings-folder-readiness__resolved {
  margin: 0;
}

.settings-folder-readiness__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.settings-folder-readiness__subtitle,
.settings-folder-readiness__path,
.settings-folder-readiness__root p,
.settings-folder-readiness__detail-row p,
.settings-folder-readiness__resolved {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.settings-folder-readiness__message {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.settings-folder-readiness__roots,
.settings-folder-readiness__details {
  display: grid;
  gap: var(--hx-space-2);
}

.settings-folder-readiness__root,
.settings-folder-readiness__detail-row {
  border-bottom: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-1) var(--hx-space-3);
  grid-template-columns: minmax(0, 1fr) auto;
  padding-bottom: var(--hx-space-2);
}

.settings-folder-readiness__root:last-child,
.settings-folder-readiness__detail-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.settings-folder-readiness__path {
  display: block;
  margin-top: var(--hx-space-1);
  overflow-wrap: anywhere;
}

.settings-folder-readiness__root p,
.settings-folder-readiness__resolved,
.settings-folder-readiness__detail-row p {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .settings-folder-readiness__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

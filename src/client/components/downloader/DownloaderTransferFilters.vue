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
import { DOWNLOADER_TRANSFER_STATE_FILTER_OPTIONS } from '../../lib/downloader-transfer-filter.js';

defineProps({
  musicQueueLinkedOnly: {
    type: Boolean,
    default: false,
  },
  releaseFilterActive: {
    type: Boolean,
    default: false,
  },
  stateFilter: {
    type: String,
    default: 'all',
  },
});

const emit = defineEmits([
  'update:music-queue-linked-only',
  'update:state-filter',
]);

function updateStateFilter(event) {
  emit('update:state-filter', event.target.value);
}

function updateMusicQueueLinkedOnly(event) {
  emit('update:music-queue-linked-only', event.target.checked);
}
</script>

<template>
  <fieldset class="downloader-transfer-filters">
    <legend class="sr-only">Filter transfers</legend>
    <label class="hx-field downloader-transfer-filter-state">
      <span class="hx-field-label">State</span>
      <select class="hx-select" :value="stateFilter" @change="updateStateFilter">
        <option
          v-for="option in DOWNLOADER_TRANSFER_STATE_FILTER_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label v-if="!releaseFilterActive" class="downloader-transfer-filter-linkage">
      <input
        type="checkbox"
        :checked="musicQueueLinkedOnly"
        @change="updateMusicQueueLinkedOnly"
      >
      <span>Only transfers linked to Missing Music</span>
    </label>
  </fieldset>
</template>

<style scoped>
.downloader-transfer-filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.downloader-transfer-filter-state {
  flex: 0 1 150px;
}

.downloader-transfer-filter-linkage {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  gap: var(--hx-space-2);
  padding: 0 var(--hx-space-3);
  color: var(--hx-text-muted);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  cursor: pointer;
  font-size: var(--hx-text-sm);
}

.downloader-transfer-filter-linkage input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--hx-accent);
}

.downloader-transfer-filter-linkage:focus-within {
  outline: 2px solid var(--hx-accent-soft);
  outline-offset: 0;
  border-color: var(--hx-accent);
}

@media (max-width: 640px) {
  .downloader-transfer-filters {
    align-items: stretch;
    width: 100%;
  }

  .downloader-transfer-filter-state {
    flex-basis: 100%;
  }

  .downloader-transfer-filter-linkage {
    min-height: 44px;
    width: 100%;
  }
}
</style>

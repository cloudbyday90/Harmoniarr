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
import { computed, ref, watch } from 'vue';
import { buildReleaseEditionOptions, getAvailableReleaseEditionKey } from '../../lib/release-edition-options.js';

const props = defineProps({
  editions: { type: Array, default: () => [] },
  currentEdition: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  canLoadMore: Boolean,
  loadingMore: Boolean,
  loadError: { type: String, default: null },
  loadedCount: { type: Number, default: 0 },
  showContinuation: Boolean,
});
const emit = defineEmits(['preview', 'load-more']);
const options = computed(() => buildReleaseEditionOptions(props.editions));
const currentKey = computed(() => getAvailableReleaseEditionKey(options.value, props.currentEdition));
const selectedKey = ref('');
watch(currentKey, (key) => { selectedKey.value = key; }, { immediate: true });
const selected = computed(() => options.value.find((option) => option.key === selectedKey.value));
const canPreview = computed(() => !props.disabled && Boolean(selected.value?.target) && selectedKey.value !== currentKey.value);

function preview() {
  if (!canPreview.value) return;
  const { preferReleaseId, preferReleaseMbid } = selected.value.target;
  emit('preview', { preferReleaseId, preferReleaseMbid });
}
function loadMore() {
  if (!props.disabled && !props.loadingMore && props.canLoadMore) emit('load-more');
}
</script>

<template>
  <div class="hx-release-edition-picker">
    <label class="hx-field">
      <span class="hx-field-label">Preview an edition</span>
      <select v-model="selectedKey" class="hx-select" :disabled="disabled">
        <option v-if="!currentKey" disabled value="">Choose an edition</option>
        <option v-for="option in options" :key="option.key" :value="option.key" :disabled="!option.target">
          {{ option.label }}
        </option>
      </select>
    </label>
    <button type="button" class="hx-btn" :disabled="!canPreview" @click="preview">Preview edition</button>
    <p>Previewing an edition does not save your selection.</p>
    <div v-if="showContinuation" class="hx-release-edition-pagination">
      <p role="status" aria-atomic="true">{{ loadingMore ? 'Loading more editions…' : `${loadedCount} editions loaded.` }}</p>
      <p v-if="loadError" role="alert">Could not load more editions. Try again.</p>
      <button
        type="button"
        class="hx-btn"
        :aria-disabled="disabled || loadingMore || !canLoadMore"
        :aria-busy="loadingMore"
        @click="loadMore"
      >{{ loadingMore ? 'Loading editions…' : canLoadMore ? (loadError ? 'Retry loading editions' : 'Load more editions') : 'End of edition pages' }}</button>
    </div>
  </div>
</template>

<style scoped>
.hx-release-edition-picker {
  display: grid;
  gap: var(--hx-space-2);
  flex: 1;
  min-width: 0;
}
.hx-release-edition-pagination {
  display: grid;
  gap: var(--hx-space-2);
}
.hx-release-edition-picker .hx-select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
.hx-release-edition-picker .hx-btn {
  justify-self: start;
}
.hx-release-edition-picker p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}
@media (max-width: 640px) {
  .hx-release-edition-picker .hx-select,
  .hx-release-edition-picker .hx-btn {
    min-height: 44px;
  }
}
</style>

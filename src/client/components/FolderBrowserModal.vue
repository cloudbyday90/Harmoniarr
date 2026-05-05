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
import { ref, onMounted } from 'vue';
import { browseFsDirectory } from '../lib/system-api.js';

const props = defineProps({
  initial: { type: String, default: '/' },
  label: { type: String, default: 'Select a folder' },
});

const emit = defineEmits(['select', 'close']);

const dialogRef = ref(null);
const currentPath = ref('/');
const entries = ref([]);
const parentPath = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

async function navigate(path) {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const result = await browseFsDirectory({ path });
    currentPath.value = result.path;
    parentPath.value = result.parent ?? null;
    entries.value = result.entries ?? [];
    if (!result.ok) errorMessage.value = result.error ?? 'Could not read this folder.';
  } catch {
    errorMessage.value = 'Failed to load folder contents.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  dialogRef.value?.showModal();
  navigate(props.initial || '/');
});

function selectCurrent() {
  emit('select', currentPath.value);
  emit('close');
}

function handleClose() {
  emit('close');
}

function handleBackdropClick(e) {
  if (e.target === dialogRef.value) handleClose();
}
</script>

<template>
  <dialog ref="dialogRef" class="fb-dialog" @click="handleBackdropClick" @cancel.prevent="handleClose">
    <div class="fb-shell">
      <header class="fb-header">
        <span class="fb-title">{{ label }}</span>
        <button type="button" class="fb-close" @click="handleClose" aria-label="Close">✕</button>
      </header>

      <div class="fb-path-bar">
        <button
          type="button"
          class="fb-up-btn hx-btn"
          :disabled="!parentPath || isLoading"
          @click="navigate(parentPath)"
        >↑ Up</button>
        <span class="fb-current-path" :title="currentPath">{{ currentPath }}</span>
      </div>

      <div class="fb-body" role="listbox" aria-label="Folders">
        <div v-if="isLoading" class="fb-loading">Loading…</div>
        <div v-else-if="errorMessage" class="fb-error">{{ errorMessage }}</div>
        <div v-else-if="!entries.length" class="fb-empty">No subfolders here.</div>
        <button
          v-else
          v-for="entry in entries"
          :key="entry.path"
          type="button"
          class="fb-entry"
          role="option"
          @click="navigate(entry.path)"
          @dblclick="() => { navigate(entry.path); }"
        >
          <span class="fb-entry-icon">📁</span>
          <span class="fb-entry-name">{{ entry.name }}</span>
        </button>
      </div>

      <footer class="fb-footer">
        <span class="fb-selected-path" :title="currentPath">{{ currentPath }}</span>
        <div class="fb-footer-actions">
          <button type="button" class="hx-btn" data-variant="ghost" @click="handleClose">Cancel</button>
          <button type="button" class="hx-btn" data-variant="primary" @click="selectCurrent" :disabled="isLoading">
            Select this folder
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>

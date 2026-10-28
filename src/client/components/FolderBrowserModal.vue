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
import { computed, ref, onBeforeUnmount, onMounted, useId } from 'vue';
import { useFolderBrowser } from '../composables/useFolderBrowser.js';

const props = defineProps({
  initial: { type: String, default: '/' },
  label: { type: String, default: 'Select a folder' },
});

const emit = defineEmits(['select', 'close']);

const dialogRef = ref(null);
const pathRef = ref(null);
const titleId = useId();
const { requestedPath, currentPath, entries, parentPath, isLoading, errorMessage,
  page, canSelect, navigate, retry, dispose } = useFolderBrowser();
const displayedPath = computed(() => currentPath.value ?? requestedPath.value);
const statusMessage = computed(() => isLoading.value ? 'Loading folders…'
  : errorMessage.value || (currentPath.value === null ? ''
    : page.value?.total ? `Folders ${page.value.from}–${page.value.to} of ${page.value.total}.` : 'No subfolders here.'));
let settled = false;

function navigateFromControl(path, event, cursor) {
  // Keep focus on a persistent target before the initiating control is replaced.
  if (event.currentTarget === event.currentTarget.ownerDocument.activeElement) {
    pathRef.value?.focus();
  }
  void navigate(path, cursor);
}

function retryFromControl(event) {
  if (event.currentTarget === event.currentTarget.ownerDocument.activeElement) pathRef.value?.focus();
  void retry();
}

onMounted(() => {
  dialogRef.value?.showModal();
  navigate(props.initial || '/');
});

function selectCurrent() {
  if (canSelect.value) finish(currentPath.value);
}

function finish(path) {
  if (settled) return;
  settled = true;
  dispose();
  // Native close returns focus while the invoker is still connected.
  if (dialogRef.value?.open) dialogRef.value.close();
  if (path !== undefined) emit('select', path);
  emit('close');
}

function handleClose() { finish(); }

function handleBackdropClick(e) {
  if (e.target === dialogRef.value) handleClose();
}

onBeforeUnmount(() => {
  settled = true;
  dispose();
  if (dialogRef.value?.open) dialogRef.value.close();
});
</script>

<template>
  <dialog ref="dialogRef" class="fb-dialog" :aria-labelledby="titleId" @click="handleBackdropClick" @close="handleClose">
    <div class="fb-shell">
      <header class="fb-header">
        <h2 :id="titleId" class="fb-title">{{ label }}</h2>
        <button type="button" class="fb-close" autofocus @click="handleClose" aria-label="Close folder browser">✕</button>
      </header>

      <div class="fb-path-bar">
        <button
          type="button"
          class="fb-up-btn hx-btn"
          :disabled="!parentPath || isLoading"
          @click="navigateFromControl(parentPath, $event)"
        >↑ Up</button>
        <span ref="pathRef" class="fb-current-path" tabindex="-1" :title="displayedPath">{{ displayedPath }}</span>
      </div>

      <p class="fb-status" :class="{ 'fb-error': errorMessage }" role="status" aria-atomic="true">{{ statusMessage }}</p>
      <div class="fb-body" :aria-busy="isLoading">
        <button v-if="errorMessage" type="button" class="hx-btn" @click="retryFromControl($event)">Retry</button>
        <ul v-else-if="entries.length" class="fb-entries" aria-label="Folders">
          <li v-for="entry in entries" :key="entry.path">
            <button type="button" class="fb-entry" @click="navigateFromControl(entry.path, $event)">
              <span class="fb-entry-icon" aria-hidden="true">📁</span>
              <span class="fb-entry-name">{{ entry.name }}</span>
            </button>
          </li>
        </ul>
      </div>

      <nav class="fb-pagination" aria-label="Folder pages">
        <button type="button" class="hx-btn" :disabled="isLoading || !page?.previousCursor" @click="navigateFromControl(displayedPath, $event, page.previousCursor)">Previous folders</button>
        <button type="button" class="hx-btn" :disabled="isLoading || !page?.nextCursor" @click="navigateFromControl(displayedPath, $event, page.nextCursor)">Next folders</button>
        <button type="button" class="hx-btn" :disabled="isLoading" @click="navigateFromControl(displayedPath, $event)">Start again</button>
      </nav>

      <footer class="fb-footer">
        <span class="fb-selected-path" :title="displayedPath">{{ displayedPath }}</span>
        <div class="fb-footer-actions">
          <button type="button" class="hx-btn" data-variant="ghost" @click="handleClose">Cancel</button>
          <button type="button" class="hx-btn" data-variant="primary" @click="selectCurrent" :disabled="!canSelect">
            Select this folder
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.fb-dialog { max-height: calc(100dvh - var(--hx-space-4)); display: block; overflow: auto; }
.fb-shell { height: auto; overflow: visible; }
.fb-dialog:modal { overscroll-behavior: contain; }
.fb-title { margin: 0; }
.fb-close { min-width: 24px; min-height: 24px; }
.fb-body { min-height: 4rem; max-height: 35dvh; flex: none; }
.fb-status { margin: 0; padding: var(--hx-space-2) var(--hx-space-4); font-size: var(--hx-text-sm); flex-shrink: 0; }
.fb-entries { list-style: none; margin: 0; padding: 0; }
.fb-footer { flex-wrap: wrap; }
.fb-selected-path { min-width: 0; }
.fb-pagination { display: flex; flex-wrap: wrap; gap: var(--hx-space-2); padding: var(--hx-space-2) var(--hx-space-4); flex-shrink: 0; }
.fb-current-path:focus-visible, .fb-close:focus-visible, .fb-entry:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: -2px;
}
</style>

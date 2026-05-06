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
import ArtworkImage from '../ArtworkImage.vue';
import { getReleaseArtistName, getReleaseTitle, getReleaseYear } from '../../lib/release-normalization.js';

/**
 * ConfirmRequestModal — lightweight release request confirmation dialog.
 *
 * Presents a single release for the user to confirm or cancel before submitting
 * a media request. Intentionally not a full release detail modal — it shows
 * enough information to confirm identity, and explains the action.
 *
 * Behavior:
 * - Opens when `open` is true.
 * - Cannot be closed while `loading` is true (Escape and Cancel are blocked).
 * - On success, the parent should set `open` to false.
 * - On failure, the modal remains open for retry or cancel.
 * - Uses accessible dialog markup: role="dialog", aria-modal, labelled heading.
 */
const props = defineProps({
  /** Whether the modal is visible. */
  open: {
    type: Boolean,
    default: false,
  },
  /** The release being confirmed, or null. */
  release: {
    type: Object,
    default: null,
  },
  /** Whether the request submission is in progress. */
  loading: {
    type: Boolean,
    default: false,
  },
  /** Whether the request has already been submitted successfully. */
  requested: {
    type: Boolean,
    default: false,
  },
  /** Error message to display if the last submission failed. */
  errorMessage: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['confirm', 'close']);

const dialogRef = ref(null);

// Sync the native dialog open state with the `open` prop.
watch(
  () => props.open,
  (isOpen) => {
    if (!dialogRef.value) return;
    if (isOpen) {
      if (!dialogRef.value.open) {
        dialogRef.value.showModal();
      }
    } else {
      if (dialogRef.value.open) {
        dialogRef.value.close();
      }
    }
  },
  { immediate: true },
);

const artistName = computed(() => getReleaseArtistName(props.release));
const releaseTitle = computed(() => getReleaseTitle(props.release));
const year = computed(() => getReleaseYear(props.release));

const releaseMbid = computed(() => {
  if (!props.release) return null;
  return props.release.id ?? props.release.musicbrainzReleaseId ?? null;
});

const releaseGroupMbid = computed(() => {
  if (!props.release) return null;
  return props.release.releaseGroup?.id ?? props.release.releaseGroupId ?? null;
});

const metaLine = computed(() => {
  if (!props.release) return null;
  const parts = [];
  if (year.value) parts.push(year.value);
  const type = props.release.releaseGroup?.primaryType ?? null;
  if (type) parts.push(type);
  if (props.release.status) parts.push(props.release.status);
  return parts.length ? parts.join(' · ') : null;
});

/** Block Escape key close while loading. */
function handleCancel(event) {
  event.preventDefault();
  if (!props.loading) {
    emit('close');
  }
}

/** Block backdrop click close while loading. */
function handleBackdropClick(event) {
  if (props.loading) return;
  if (event.target === dialogRef.value) {
    emit('close');
  }
}

function handleClose() {
  if (!props.loading) {
    emit('close');
  }
}

function handleConfirm() {
  emit('confirm');
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="crm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="crm-heading"
    @cancel="handleCancel"
    @click="handleBackdropClick"
  >
    <div class="crm-shell">
      <header class="crm-header">
        <h2 id="crm-heading" class="crm-title">Request this release?</h2>
        <button
          type="button"
          class="crm-close hx-btn"
          data-variant="ghost"
          :disabled="loading"
          aria-label="Close"
          @click="handleClose"
        >✕</button>
      </header>

      <div class="crm-body">
        <div v-if="release" class="crm-release">
          <div class="crm-artwork">
            <ArtworkImage
              :mbid="releaseMbid || releaseGroupMbid || undefined"
              :mbid-type="releaseMbid ? 'release' : 'release-group'"
              :alt="releaseTitle || 'Release artwork'"
            />
          </div>
          <div class="crm-release-info">
            <p class="crm-release-title">{{ releaseTitle || '—' }}</p>
            <p v-if="artistName" class="crm-release-artist">{{ artistName }}</p>
            <p v-if="metaLine" class="crm-release-meta">{{ metaLine }}</p>
          </div>
        </div>

        <p class="crm-explanation">
          Harmoniarr will add this release to your requests so it can be searched and fulfilled.
        </p>

        <p v-if="errorMessage" class="crm-error" role="alert">{{ errorMessage }}</p>
      </div>

      <footer class="crm-footer">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          :disabled="loading"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          type="button"
          class="hx-btn"
          data-variant="primary"
          :disabled="loading || requested"
          :aria-busy="loading || undefined"
          @click="handleConfirm"
        >
          <template v-if="loading">Requesting…</template>
          <template v-else-if="requested">Requested</template>
          <template v-else>Confirm request</template>
        </button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.crm-dialog {
  border: none;
  border-radius: var(--hx-radius-lg);
  background: var(--hx-bg-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.32);
  padding: 0;
  width: min(480px, 96vw);
  max-height: 90vh;
  overflow: hidden;
  color: var(--hx-text);
}

.crm-dialog::backdrop {
  background: var(--hx-bg-overlay);
  backdrop-filter: blur(2px);
}

.crm-shell {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.crm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  padding: var(--hx-space-4) var(--hx-space-5);
  border-bottom: 1px solid var(--hx-border-subtle);
  flex-shrink: 0;
}

.crm-title {
  margin: 0;
  font-size: var(--hx-text-md);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.crm-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 0.85rem;
  color: var(--hx-text-muted);
}

.crm-body {
  padding: var(--hx-space-5);
  display: grid;
  gap: var(--hx-space-4);
  overflow-y: auto;
}

.crm-release {
  display: flex;
  gap: var(--hx-space-4);
  align-items: flex-start;
}

.crm-artwork {
  width: 72px;
  flex-shrink: 0;
}

.crm-release-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.crm-release-title {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 600;
  color: var(--hx-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crm-release-artist {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crm-release-meta {
  margin: 0;
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
}

.crm-explanation {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.55;
}

.crm-error {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-danger);
  background: var(--hx-danger-soft);
  border: 1px solid rgba(197, 69, 69, 0.28);
  border-radius: var(--hx-radius-sm);
  padding: var(--hx-space-2) var(--hx-space-3);
}

.crm-footer {
  display: flex;
  gap: var(--hx-space-2);
  justify-content: flex-end;
  align-items: center;
  padding: var(--hx-space-4) var(--hx-space-5);
  border-top: 1px solid var(--hx-border-subtle);
  flex-shrink: 0;
}
</style>

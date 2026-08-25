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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import ArtworkImage from '../ArtworkImage.vue';
import { containDialogTabFocus } from '../../lib/dialog-focus-trap.js';
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
 * - When `users` has two or more entries, a "Request for" selector is shown
 *   (operator-only feature). The `confirm` event carries `{ requestedForUserId }`
 *   which is null when "Myself" is selected.
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
  /**
   * List of eligible request-target users for the "Request for" selector.
   * Each item: { id: string, username: string }.
   * When this array has fewer than two entries the selector is not rendered.
   * Only pass this prop for admin sessions.
   */
  users: {
    type: Array,
    default: () => [],
  },
  /** The surrounding workflow that initiated the request. */
  actionContext: {
    type: String,
    default: 'request',
  },
});

const emit = defineEmits(['confirm', 'close']);

const dialogRef = ref(null);
const closeButtonRef = ref(null);
const confirmButtonRef = ref(null);
let previouslyFocusedElement = null;

/**
 * The selected beneficiary user ID for the "Request for" selector.
 * null means "myself" (the session user). Reset whenever the modal opens.
 */
const selectedForUserId = ref(null);

function openDialogSession() {
  if (!dialogRef.value) return;
  previouslyFocusedElement = globalThis.document?.activeElement instanceof HTMLElement
    ? globalThis.document.activeElement
    : null;
  if (!dialogRef.value.open) {
    dialogRef.value.showModal();
  }
  selectedForUserId.value = null;
  closeButtonRef.value?.focus({ preventScroll: true });
}

function closeDialogSession() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
  if (previouslyFocusedElement?.isConnected) {
    previouslyFocusedElement.focus({ preventScroll: true });
  }
  previouslyFocusedElement = null;
}

onMounted(() => {
  if (props.open) {
    openDialogSession();
  }
});

watch(
  () => props.open,
  (isOpen) => {
    if (!dialogRef.value) return;
    if (isOpen) {
      openDialogSession();
    } else {
      closeDialogSession();
    }
  },
);

watch(
  () => [props.errorMessage, props.loading, props.open],
  async ([errorMessage, loading, isOpen]) => {
    if (!errorMessage || loading || !isOpen) {
      return;
    }

    await nextTick();
    confirmButtonRef.value?.focus({ preventScroll: true });
  },
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

const actionCopy = computed(() => {
  if (props.actionContext === 'music_queue_search') {
    return {
      confirmLabel: 'Start search',
      explanation: 'Harmoniarr will add this release to Music Queue, where it will be searched using your active settings.',
      heading: 'Search for this release?',
      loadingLabel: 'Starting search…',
      requestedLabel: 'Search started',
    };
  }

  return {
    confirmLabel: 'Confirm request',
    explanation: 'Harmoniarr will add this release to your requests so it can be searched and fulfilled.',
    heading: 'Request this release?',
    loadingLabel: 'Requesting…',
    requestedLabel: 'Requested',
  };
});

/** Block Escape key close while loading. */
function handleCancel(event) {
  event.preventDefault();
  if (!props.loading) {
    closeDialogSession();
    emit('close');
  }
}

/** Block backdrop click close while loading. */
function handleBackdropClick(event) {
  if (props.loading) return;
  if (event.target === dialogRef.value) {
    closeDialogSession();
    emit('close');
  }
}

function handleClose() {
  if (!props.loading) {
    closeDialogSession();
    emit('close');
  }
}

function handleKeydown(event) {
  containDialogTabFocus(event, dialogRef.value);
}

function handleConfirm() {
  emit('confirm', { requestedForUserId: selectedForUserId.value ?? null });
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
    @keydown="handleKeydown"
  >
    <div class="crm-shell">
      <header class="crm-header">
        <h2 id="crm-heading" class="crm-title">{{ actionCopy.heading }}</h2>
        <button
          ref="closeButtonRef"
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

        <p class="crm-explanation">{{ actionCopy.explanation }}</p>

        <div v-if="users.length >= 2" class="crm-for-user">
          <label class="crm-for-user__label" for="crm-for-user-select">Request for</label>
          <select
            id="crm-for-user-select"
            v-model="selectedForUserId"
            class="crm-for-user__select"
            :disabled="loading"
          >
            <option :value="null">Myself</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
          </select>
        </div>

        <p v-if="errorMessage" class="crm-error" role="alert">{{ errorMessage }}</p>
      </div>

      <footer class="crm-footer">
        <button
          ref="confirmButtonRef"
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
          <template v-if="loading">{{ actionCopy.loadingLabel }}</template>
          <template v-else-if="requested">{{ actionCopy.requestedLabel }}</template>
          <template v-else>{{ actionCopy.confirmLabel }}</template>
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

.crm-for-user {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-1);
}

.crm-for-user__label {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  font-weight: 500;
}

.crm-for-user__select {
  width: 100%;
  padding: var(--hx-space-2) var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-input, var(--hx-bg-surface));
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
  cursor: pointer;
}

.crm-for-user__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.crm-for-user__select:focus-visible {
  outline: 2px solid var(--hx-focus-ring, var(--hx-accent));
  outline-offset: 2px;
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

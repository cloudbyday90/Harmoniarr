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
import { computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { formatTransferFilename } from '../../lib/activity-downloads-presentation.js';
import { buildDownloaderImportCandidateLocation } from '../../lib/downloader-import-review-link.js';
import { formatOperationTimestampShort } from '../../lib/operation-run-presentation.js';
import { formatBytes, formatSpeed } from '../../lib/search-presentation.js';

const props = defineProps({
  actionError: { type: String, default: '' },
  actionPending: { type: String, default: '' },
  observedAt: { type: String, default: null },
  open: { type: Boolean, default: false },
  transfer: { type: Object, default: null },
});

const emit = defineEmits(['close', 'request-action']);

let dialogRef = null;

const title = computed(() => (
  props.transfer?.filename
    ? formatTransferFilename(props.transfer.filename)
    : 'Transfer details'
));

const diagnostics = computed(() => props.transfer?.diagnostics ?? {});
const importCandidateLocation = computed(() => buildDownloaderImportCandidateLocation(props.transfer));
const recommendedAction = computed(() => diagnostics.value.recommendedNextAction ?? null);
const timestamps = computed(() => props.transfer?.timestamps ?? {});
const transferActions = computed(() => (
  Array.isArray(props.transfer?.actionEligibility?.actions)
    ? props.transfer.actionEligibility.actions
    : []
));
const visibleActions = computed(() => transferActions.value.filter((action) => (
  action.code === 'cancel' || action.code === 'remove' || action.code === 'retry'
)));

const detailRows = computed(() => [
  { label: 'Source user', value: props.transfer?.sourceUser ?? 'Unknown source' },
  { label: 'Directory', value: props.transfer?.directory ?? 'Not reported' },
  { label: 'Provider state', value: diagnostics.value.provider?.state ?? props.transfer?.state?.raw ?? 'Unknown' },
  { label: 'Queue position', value: diagnostics.value.queue?.hasQueuePosition ? diagnostics.value.queue.placeInQueue : 'Not reported' },
  { label: 'Average speed', value: formatSpeed(props.transfer?.averageSpeed) },
  { label: 'Size', value: formatBytes(props.transfer?.progress?.size) },
  { label: 'Transferred', value: formatBytes(props.transfer?.progress?.bytesTransferred) },
  { label: 'Requested', value: formatOperationTimestampShort(timestamps.value.requestedAt) },
  { label: 'Enqueued', value: formatOperationTimestampShort(timestamps.value.enqueuedAt) },
  { label: 'Started', value: formatOperationTimestampShort(timestamps.value.startedAt) },
  { label: 'Ended', value: formatOperationTimestampShort(timestamps.value.endedAt) },
  { label: 'Last known event', value: formatOperationTimestampShort(diagnostics.value.timing?.lastKnownEventAt) },
]);

function setDialogRef(el) {
  if (el instanceof HTMLDialogElement) {
    dialogRef = el;
    if (props.open && !dialogRef.open) {
      dialogRef.showModal();
    }
  } else if (el === null) {
    dialogRef = null;
  }
}

function closeDrawer() {
  emit('close');
}

function onCancel(event) {
  event.preventDefault();
  closeDrawer();
}

function onBackdropClick(event) {
  if (event.target === event.currentTarget) {
    closeDrawer();
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    if (dialogRef && !dialogRef.open) {
      dialogRef.showModal();
      await nextTick();
      dialogRef.querySelector('.downloader-detail-close')?.focus();
    }
  } else if (dialogRef?.open) {
    dialogRef.close();
  }
});

onBeforeUnmount(() => {
  if (dialogRef?.open) {
    dialogRef.close();
  }
});
</script>

<template>
  <dialog
    v-if="open && transfer"
    :ref="setDialogRef"
    class="downloader-detail-drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="downloader-detail-title"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <div class="downloader-detail-shell">
      <header class="downloader-detail-header">
        <div>
          <p class="downloader-detail-kicker">Transfer diagnostics</p>
          <h2 id="downloader-detail-title" class="downloader-detail-title">{{ title }}</h2>
          <p class="downloader-detail-summary">{{ diagnostics.summary ?? 'No diagnostics are available for this transfer.' }}</p>
        </div>
        <button
          type="button"
          class="hx-btn hx-btn-icon downloader-detail-close"
          aria-label="Close transfer diagnostics"
          @click="closeDrawer"
        >
          &times;
        </button>
      </header>

      <section class="downloader-detail-status" aria-label="Transfer status">
        <span class="hx-pill" :data-tone="transfer.state?.tone ?? 'info'">
          {{ transfer.state?.label ?? 'Unknown' }}
        </span>
        <span
          v-if="diagnostics.provider?.hasProviderError"
          class="hx-pill"
          data-tone="danger"
        >
          Provider error reported
        </span>
        <span
          v-if="observedAt"
          class="downloader-detail-observed"
        >
          Observed {{ formatOperationTimestampShort(observedAt) }}
        </span>
      </section>

      <section v-if="recommendedAction" class="downloader-detail-panel" aria-label="Recommended next action">
        <h3>Recommended next action</h3>
        <div class="downloader-detail-recommendation">
          <span class="hx-pill" :data-tone="recommendedAction.tone ?? 'info'">
            {{ recommendedAction.label }}
          </span>
          <p>{{ recommendedAction.description }}</p>
        </div>
      </section>

      <section class="downloader-detail-panel" aria-label="Operator controls">
        <h3>Operator controls</h3>
        <p class="downloader-detail-muted">
          Actions are evaluated from the latest observed provider state and rechecked on the server before execution.
        </p>
        <div class="downloader-detail-actions">
          <button
            v-for="action in visibleActions"
            :key="action.code"
            type="button"
            class="hx-btn"
            :data-variant="action.destructive ? 'danger' : undefined"
            :disabled="!action.enabled || Boolean(actionPending)"
            :title="action.enabled ? action.label : action.reason"
            @click="emit('request-action', action.code)"
          >
            {{ actionPending === action.code ? 'Working...' : action.label }}
          </button>
        </div>
        <p v-if="actionError" class="downloader-detail-error" role="alert">{{ actionError }}</p>
      </section>

      <section class="downloader-detail-panel" aria-label="Transfer facts">
        <h3>Transfer facts</h3>
        <dl class="downloader-detail-grid">
          <div v-for="row in detailRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="downloader-detail-panel" aria-label="Diagnostics contract">
        <h3>Diagnostics contract</h3>
        <dl class="downloader-detail-grid">
          <div>
            <dt>Import linkage</dt>
            <dd>
              <span>{{ diagnostics.importLinkage?.summary ?? 'Not linked.' }}</span>
              <RouterLink
                v-if="importCandidateLocation"
                class="downloader-detail-import-link"
                :to="importCandidateLocation"
                @click="closeDrawer"
              >
                Open advanced diagnostics
              </RouterLink>
            </dd>
          </div>
          <div>
            <dt>Retry tracking</dt>
            <dd>{{ diagnostics.retry?.summary ?? 'Retry tracking is not available.' }}</dd>
          </div>
          <div>
            <dt>Action eligibility</dt>
            <dd>{{ transfer.actionEligibility?.reason ?? 'No action eligibility reason reported.' }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.downloader-detail-drawer {
  width: min(560px, calc(100vw - 24px));
  max-width: min(560px, calc(100vw - 24px));
  height: min(100vh - 24px, 900px);
  max-height: min(100vh - 24px, 900px);
  margin: auto 12px auto auto;
  padding: 0;
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-lg);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-lg);
  color: var(--hx-text);
}

.downloader-detail-drawer::backdrop {
  background: var(--hx-bg-overlay);
}

.downloader-detail-shell {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: var(--hx-space-4);
  padding: var(--hx-space-5);
}

.downloader-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
}

.downloader-detail-kicker {
  margin: 0 0 var(--hx-space-1);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.downloader-detail-title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-xl);
}

.downloader-detail-summary {
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
  line-height: 1.5;
}

.downloader-detail-close {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  font-size: var(--hx-text-lg);
}

.downloader-detail-status {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.downloader-detail-observed {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-sm);
}

.downloader-detail-panel {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-muted);
}

.downloader-detail-panel h3 {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.downloader-detail-recommendation {
  display: grid;
  gap: var(--hx-space-2);
}

.downloader-detail-recommendation p {
  margin: 0;
  color: var(--hx-text-muted);
  line-height: 1.5;
}

.downloader-detail-muted {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.downloader-detail-actions {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.downloader-detail-actions .hx-btn {
  min-height: 36px;
}

.downloader-detail-error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.downloader-detail-grid {
  display: grid;
  gap: var(--hx-space-2);
  margin: 0;
}

.downloader-detail-grid div {
  display: grid;
  grid-template-columns: minmax(120px, 0.4fr) minmax(0, 1fr);
  gap: var(--hx-space-3);
}

.downloader-detail-grid dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.downloader-detail-grid dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
}

.downloader-detail-import-link {
  display: block;
  width: fit-content;
  margin-top: var(--hx-space-1);
  color: var(--hx-accent);
  font-weight: 700;
  text-decoration: none;
}

.downloader-detail-import-link:hover,
.downloader-detail-import-link:focus-visible {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .downloader-detail-drawer {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    max-height: calc(100vh - 16px);
    margin: auto 8px 8px;
  }

  .downloader-detail-shell {
    padding: var(--hx-space-4);
  }

  .downloader-detail-grid div {
    grid-template-columns: 1fr;
    gap: var(--hx-space-1);
  }
}
</style>

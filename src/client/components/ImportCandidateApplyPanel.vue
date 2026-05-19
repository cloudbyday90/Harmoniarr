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
import { ref } from 'vue';
import {
  canStartApplyRun,
  describeApplyOperation,
  formatPath,
  formatRunStatus,
  formatTimestamp,
  getApplyItemOperationHistory,
  getApplyItemStatusClass,
  getApplyItemStatusLabel,
  getApplyOperationStatusClass,
  getApplyOperationStatusLabel,
  getApplyOperationStepLabel,
  getRunStatusClass,
} from '../lib/import-candidate-presentation.js';
import {
  formatElapsedDuration,
  formatOperationTimestampShort,
} from '../lib/operation-run-presentation.js';
import ConfirmDialog from './ConfirmDialog.vue';

defineProps({
  actionErrorMessage: {
    type: String,
    default: '',
  },
  currentRun: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  importPendingCandidateCount: {
    type: Number,
    default: 0,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isStarting: {
    type: Boolean,
    default: false,
  },
  recentRuns: {
    type: Array,
    default: () => [],
  },
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  selectedRunId: {
    type: String,
    default: null,
  },
  summary: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'select-run', 'start']);

const confirmOpen = ref(false);
const applyTyped = ref('');
const applyAcknowledged = ref(false);

function openConfirm() {
  applyTyped.value = '';
  applyAcknowledged.value = false;
  confirmOpen.value = true;
}

function onApplyConfirm() {
  confirmOpen.value = false;
  emit('start');
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Library import</p>
        <h3>Move downloads to library</h3>
      </div>
      <div class="review-filter-actions">
        <button
          type="button"
          :disabled="isLoading"
          class="secondary-button"
          @click="$emit('refresh')"
        >
          {{ isLoading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          type="button"
          :disabled="!canStartApplyRun(currentRun, importPendingCandidateCount) || isStarting"
          @click="openConfirm"
        >
          {{ isStarting ? 'Starting...' : 'Start import apply' }}
        </button>
      </div>
    </div>

    <p class="review-summary-copy">Moves downloaded files into your library. Files are staged first and only committed once all moves succeed safely.</p>
    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <article class="panel-light error-panel" v-if="errorMessage">
      <h3>Import run unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading import run</h3>
      <p>Loading import run…</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No import run yet</h3>
      <p>Downloads ready to import will appear above. Start an import run to move them into your library.</p>
    </article>

    <template v-else>
      <article class="onboarding-step-card" v-if="recentRuns.length">
        <div class="review-detail-header">
          <div>
            <p>Recent apply history</p>
            <strong>The last {{ recentRuns.length }} import apply run{{ recentRuns.length === 1 ? '' : 's' }}.</strong>
          </div>
        </div>
        <table class="hx-table apply-runs-subtable">
          <thead>
            <tr>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Requested</th>
              <th>Applied</th>
              <th>Warnings</th>
              <th>Failed</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in recentRuns"
              :key="run.id"
              class="apply-runs-subtable-row"
              :aria-selected="run.id === (selectedRunId || currentRun?.id) ? 'true' : 'false'"
              :class="{ 'is-selected': run.id === (selectedRunId || currentRun?.id) }"
            >
              <td>
                <span class="review-status-pill" :class="getRunStatusClass(run.status)">
                  {{ formatRunStatus(run.status) }}
                </span>
              </td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatOperationTimestampShort(run.startedAt) }}</span></td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatElapsedDuration(run.startedAt, run.finishedAt) }}</span></td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.requestedCandidateCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.appliedCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.appliedWithWarningsCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.applyFailedCount ?? 0 }}</td>
              <td class="apply-run-detail-cell">
                <button
                  type="button"
                  class="hx-btn apply-run-detail-btn"
                  :aria-pressed="run.id === (selectedRunId || currentRun?.id) ? 'true' : 'false'"
                  @click="$emit('select-run', run.id)"
                >
                  {{ run.id === (selectedRunId || currentRun?.id) ? 'Selected' : 'View' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <div class="review-detail-header">
        <div>
          <p>Selected run</p>
          <strong>Run {{ currentRun.id }}</strong>
          <p class="metadata-card-copy">{{ currentRun.currentStep || 'No current step reported' }}</p>
        </div>
        <span class="review-status-pill" :class="getRunStatusClass(currentRun.status)">
          {{ formatRunStatus(currentRun.status) }}
        </span>
      </div>

      <dl class="review-meta-grid review-meta-grid-wide">
        <div>
          <dt>Started</dt>
          <dd>{{ formatTimestamp(currentRun.startedAt) }}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{{ formatTimestamp(currentRun.finishedAt) }}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{{ currentRun.requestedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>{{ currentRun.processedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Applied</dt>
          <dd>{{ currentRun.appliedCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Applied with warnings</dt>
          <dd>{{ currentRun.appliedWithWarningsCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Apply failed</dt>
          <dd>{{ currentRun.applyFailedCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Blocked</dt>
          <dd>{{ currentRun.blockedCount ?? 0 }}</dd>
        </div>
      </dl>

      <div class="review-queue-stack" v-if="currentRun.items?.length">
        <article class="review-file-item" v-for="item in currentRun.items" :key="item.id">
          <div class="review-file-header">
            <div>
              <p class="eyebrow">{{ item.applySnapshot?.candidate?.username || 'unknown user' }}</p>
              <strong>{{ item.applySnapshot?.candidate?.folderPath || 'Root-level files' }}</strong>
              <p class="metadata-card-copy">{{ item.statusMessage }}</p>
            </div>
            <span class="review-status-pill" :class="getApplyItemStatusClass(item.itemStatus)">
              {{ getApplyItemStatusLabel(item.itemStatus) }}
            </span>
          </div>

          <div class="metadata-card-grid review-preview-grid">
            <article class="path-card">
              <p>Translated source</p>
              <strong>{{ formatPath(item.applySnapshot?.planning?.sourceFolderPath) }}</strong>
            </article>
            <article class="path-card">
              <p>Staging preview</p>
              <strong>{{ formatPath(item.applySnapshot?.planning?.stagingFolderPath) }}</strong>
            </article>
            <article class="path-card">
              <p>Library preview</p>
              <strong>{{ formatPath(item.applySnapshot?.planning?.libraryFolderPath) }}</strong>
            </article>
          </div>

          <dl class="review-meta-grid review-meta-grid-wide" v-if="item.applySnapshot?.apply?.result">
            <div>
              <dt>Applied files</dt>
              <dd>{{ item.applySnapshot.apply.result.appliedFileCount ?? 0 }}</dd>
            </div>
            <div>
              <dt>Failed files</dt>
              <dd>{{ item.applySnapshot.apply.result.failedFileCount ?? 0 }}</dd>
            </div>
            <div>
              <dt>Not attempted</dt>
              <dd>{{ item.applySnapshot.apply.result.notAttemptedCount ?? 0 }}</dd>
            </div>
            <div>
              <dt>Staged first</dt>
              <dd>{{ item.applySnapshot.apply.result.stagedFromSourceCount ?? 0 }}</dd>
            </div>
          </dl>

          <div class="review-queue-stack" v-if="getApplyItemOperationHistory(item).length">
            <article
              class="review-file-item"
              v-for="operation in getApplyItemOperationHistory(item)"
              :key="operation.id || `${operation.fileId || operation.importCandidateFileId || operation.filename}-${operation.stepType || operation.status}`"
            >
              <div class="review-file-header">
                <div>
                  <p class="eyebrow">{{ getApplyOperationStepLabel(operation.stepType) }} operation</p>
                  <strong>{{ operation.filename || operation.stepType || 'Unknown file operation' }}</strong>
                  <p class="metadata-card-copy">{{ describeApplyOperation(operation) }}</p>
                </div>
                <span class="review-status-pill" :class="getApplyOperationStatusClass(operation.status)">
                  {{ getApplyOperationStatusLabel(operation.status) }}
                </span>
              </div>

              <div class="metadata-card-grid review-preview-grid">
                <article class="path-card">
                  <p>Source</p>
                  <strong>{{ formatPath(operation.sourcePath) }}</strong>
                </article>
                <article class="path-card">
                  <p>Staging</p>
                  <strong>{{ formatPath(operation.stagingPath) }}</strong>
                </article>
                <article class="path-card">
                  <p>Library</p>
                  <strong>{{ formatPath(operation.libraryPath) }}</strong>
                </article>
              </div>

              <dl class="review-meta-grid review-meta-grid-wide" v-if="operation.position || operation.startedAt || operation.finishedAt">
                <div v-if="operation.position">
                  <dt>Sequence</dt>
                  <dd>{{ operation.position }}</dd>
                </div>
                <div v-if="operation.startedAt">
                  <dt>Started</dt>
                  <dd>{{ formatTimestamp(operation.startedAt) }}</dd>
                </div>
                <div v-if="operation.finishedAt">
                  <dt>Finished</dt>
                  <dd>{{ formatTimestamp(operation.finishedAt) }}</dd>
                </div>
              </dl>
            </article>
          </div>
        </article>
      </div>
      <article class="panel-light review-empty-state" v-else>
        <h3>No import items yet</h3>
        <p>No items have been recorded for this run yet.</p>
      </article>
    </template>
  </article>

  <ConfirmDialog
    :is-open="confirmOpen"
    :is-confirming="true"
    :is-executing="false"
    :is-done="false"
    :title="'Start import apply?'"
    :confirm-level="'type_to_confirm'"
    :confirm-text="'start import apply'"
    :gate-label="'I understand this will move files from staging into the music library. This cannot be undone.'"
    :typed="applyTyped"
    :acknowledged="applyAcknowledged"
    :matches="applyTyped === 'start import apply'"
    :can-confirm="applyAcknowledged && applyTyped === 'start import apply'"
    :button-enabled="applyAcknowledged && applyTyped === 'start import apply'"
    :error="''"
    @close="confirmOpen = false"
    @execute="onApplyConfirm"
    @update:typed="applyTyped = $event"
    @update:acknowledged="applyAcknowledged = $event"
  />
</template>

<style scoped>
.apply-runs-subtable {
  margin: 0;
  background: var(--hx-bg-surface-sunken);
}

.apply-runs-subtable thead,
.apply-runs-subtable tbody,
.apply-runs-subtable thead tr,
.apply-runs-subtable tbody tr {
  background: var(--hx-bg-surface-sunken);
}

.apply-runs-subtable thead th,
.apply-runs-subtable tbody td {
  background: var(--hx-bg-surface-sunken);
}

.apply-runs-subtable thead tr:hover > th,
.apply-runs-subtable tbody tr:hover > td {
  background: var(--hx-bg-surface-sunken);
}

.apply-runs-subtable-row {
  cursor: default;
}

.apply-runs-subtable tbody tr.is-selected > td {
  background: var(--hx-bg-surface) !important;
  border-top-color: rgba(94, 173, 255, 0.22);
  border-bottom-color: rgba(94, 173, 255, 0.22);
}

.apply-runs-subtable tbody tr.is-selected > td:first-child {
  border-left: 3px solid var(--hx-accent);
  padding-left: 9px;
}

.apply-run-detail-cell {
  text-align: right;
  white-space: nowrap;
}

.apply-run-detail-btn {
  min-height: 28px;
  padding: 4px 10px;
  font-size: var(--hx-text-xs);
}

.apply-run-detail-btn[aria-pressed='true'] {
  background: var(--hx-accent-soft);
  border-color: rgba(94, 173, 255, 0.32);
  color: var(--hx-accent-strong);
}
</style>

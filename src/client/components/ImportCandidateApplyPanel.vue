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
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  summary: {
    type: Object,
    default: null,
  },
});

defineEmits(['refresh', 'start']);
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
          @click="$emit('start')"
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
      <div class="review-detail-header">
        <div>
          <p class="eyebrow">Move</p>
          <h3>Run {{ currentRun.id }}</h3>
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
</template>

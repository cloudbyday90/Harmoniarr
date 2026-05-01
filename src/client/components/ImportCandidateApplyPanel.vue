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
const props = defineProps({
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
  summary: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'start']);

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown';
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}

function formatPath(value) {
  return value || 'Unavailable';
}

function formatRunStatus(status) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}

function statusClass(status) {
  switch (status) {
    case 'running':
      return 'review-status-selected';
    case 'failed':
      return 'review-status-failed';
    case 'completed':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

function itemStatusClass(status) {
  switch (status) {
    case 'blocked':
      return 'review-status-failed';
    case 'apply_failed':
      return 'review-status-failed';
    case 'applied_with_warnings':
      return 'review-status-held';
    case 'applied':
      return 'review-status-selected';
    case 'ready_with_warnings':
      return 'review-status-held';
    default:
      return 'review-status-selected';
  }
}

function itemStatusLabel(status) {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'apply_failed':
      return 'Apply failed';
    case 'applied_with_warnings':
      return 'Applied with warnings';
    case 'applied':
      return 'Applied';
    case 'ready_with_warnings':
      return 'Ready with warnings';
    default:
      return 'Ready';
  }
}

function operationStatusClass(status) {
  switch (status) {
    case 'failed':
      return 'review-status-failed';
    case 'not_attempted':
      return 'review-status-pending';
    case 'skipped':
      return 'review-status-held';
    default:
      return 'review-status-selected';
  }
}

function operationStatusLabel(status) {
  switch (status) {
    case 'failed':
      return 'Failed';
    case 'not_attempted':
      return 'Not attempted';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Applied';
  }
}

function operationStepLabel(stepType) {
  switch (stepType) {
    case 'finalize':
      return 'Finalize';
    default:
      return 'Stage';
  }
}

function describeOperation(operation) {
  if (operation?.errorMessage) {
    return operation.errorMessage;
  }

  return `${operationStepLabel(operation?.stepType)} ${operation?.status || 'pending'} via ${operation?.transport || 'planned apply'}`;
}

function itemOperationHistory(item) {
  if (Array.isArray(item?.importOperations) && item.importOperations.length > 0) {
    return item.importOperations;
  }

  return Array.isArray(item?.applySnapshot?.fileOperations)
    ? item.applySnapshot.fileOperations
    : [];
}

function canStartRun(currentRun, importPendingCandidateCount) {
  return !currentRun || (currentRun.status !== 'pending' && currentRun.status !== 'running' && importPendingCandidateCount > 0);
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Import apply</p>
        <h3>Durable library apply</h3>
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
          :disabled="!canStartRun(currentRun, importPendingCandidateCount) || isStarting"
          @click="$emit('start')"
        >
          {{ isStarting ? 'Starting...' : 'Start import apply' }}
        </button>
      </div>
    </div>

    <p class="review-summary-copy">This run snapshots import-pending candidates, stages guarded file moves, and only marks candidates applied after every planned file reaches the library without overwriting an existing target.</p>
    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <article class="panel-light error-panel" v-if="errorMessage">
      <h3>Import apply summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading import apply summary</h3>
      <p>Resolving the latest durable import apply run and its item outcomes.</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No import apply run yet</h3>
      <p>Start an import apply run to persist guarded library-mutation outcomes for import-pending candidates.</p>
    </article>

    <template v-else>
      <div class="review-detail-header">
        <div>
          <p class="eyebrow">Move</p>
          <h3>Run {{ currentRun.id }}</h3>
          <p class="metadata-card-copy">{{ currentRun.currentStep || 'No current step reported' }}</p>
        </div>
        <span class="review-status-pill" :class="statusClass(currentRun.status)">
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
            <span class="review-status-pill" :class="itemStatusClass(item.itemStatus)">
              {{ itemStatusLabel(item.itemStatus) }}
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

          <div class="review-queue-stack" v-if="itemOperationHistory(item).length">
            <article
              class="review-file-item"
              v-for="operation in itemOperationHistory(item)"
              :key="operation.id || `${operation.fileId || operation.importCandidateFileId || operation.filename}-${operation.stepType || operation.status}`"
            >
              <div class="review-file-header">
                <div>
                  <p class="eyebrow">{{ operationStepLabel(operation.stepType) }} operation</p>
                  <strong>{{ operation.filename || operation.stepType || 'Unknown file operation' }}</strong>
                  <p class="metadata-card-copy">{{ describeOperation(operation) }}</p>
                </div>
                <span class="review-status-pill" :class="operationStatusClass(operation.status)">
                  {{ operationStatusLabel(operation.status) }}
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
        <h3>No persisted import apply items</h3>
        <p>This run has not recorded per-candidate apply items yet.</p>
      </article>
    </template>
  </article>
</template>
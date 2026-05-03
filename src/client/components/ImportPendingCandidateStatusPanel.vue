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
defineProps({
  counts: {
    type: Object,
    default: () => ({
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalImportPending: 0,
    }),
  },
  errorMessage: {
    type: String,
    default: '',
  },
  importPendingCandidates: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  summary: {
    type: Object,
    default: null,
  },
});

function importStatusClass(code) {
  switch (code) {
    case 'blocked':
      return 'review-status-failed';
    case 'ready_with_warnings':
      return 'review-status-held';
    default:
      return 'review-status-import_pending';
  }
}

function importStatusLabel(code) {
  switch (code) {
    case 'blocked':
      return 'Blocked';
    case 'ready_with_warnings':
      return 'Ready with warnings';
    default:
      return 'Ready';
  }
}

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

function formatTokenLabel(value) {
  return String(value || 'unknown').replaceAll(/[_-]+/g, ' ');
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Import pending</p>
        <h3>Import-ready staging queue</h3>
      </div>
    </div>

    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <div class="pill-row" v-if="counts.totalImportPending">
      <div class="pill">
        <span>Import pending</span>
        <strong>{{ counts.totalImportPending }}</strong>
      </div>
      <div class="pill">
        <span>Ready</span>
        <strong>{{ counts.ready }}</strong>
      </div>
      <div class="pill">
        <span>Warnings</span>
        <strong>{{ counts.readyWithWarnings }}</strong>
      </div>
      <div class="pill">
        <span>Blocked</span>
        <strong>{{ counts.blocked }}</strong>
      </div>
    </div>

    <article class="panel-light error-panel" v-if="errorMessage">
      <h3>Import-pending summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !importPendingCandidates.length">
      <h3>Loading import-pending status</h3>
      <p>Resolving completed-download candidates that are ready for the import review stage.</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!importPendingCandidates.length">
      <h3>No import-pending candidates</h3>
      <p>Completed downloads will appear here once transfer reconciliation moves them into the import review stage.</p>
    </article>

    <div class="review-queue-stack" v-else>
      <article class="review-file-item" v-for="candidate in importPendingCandidates" :key="candidate.id">
        <div class="review-file-header">
          <div>
            <p class="eyebrow">{{ candidate.username }}</p>
            <strong>{{ candidate.folderPath || 'Root-level files' }}</strong>
            <p class="metadata-card-copy">{{ candidate.sourceProvider }} search {{ candidate.sourceSearchId || 'unknown' }}</p>
          </div>
          <span class="review-status-pill" :class="importStatusClass(candidate.importStatus.code)">
            {{ importStatusLabel(candidate.importStatus.code) }}
          </span>
        </div>

        <p class="review-summary-copy">{{ candidate.importStatus.message }}</p>

        <dl class="review-meta-grid review-meta-grid-wide">
          <div>
            <dt>Import pending at</dt>
            <dd>{{ formatTimestamp(candidate.importPendingAt) }}</dd>
          </div>
          <div>
            <dt>Files</dt>
            <dd>{{ candidate.fileCount }}</dd>
          </div>
          <div>
            <dt>Locked files</dt>
            <dd>{{ candidate.lockedFileCount }}</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>{{ formatTokenLabel(candidate.planning.resolutionStrategy) }}</dd>
          </div>
        </dl>

        <div class="metadata-card-grid review-preview-grid">
          <article class="path-card">
            <p>Translated source</p>
            <strong>{{ formatPath(candidate.planning.sourceFolderPath) }}</strong>
          </article>
          <article class="path-card">
            <p>Staging preview</p>
            <strong>{{ formatPath(candidate.planning.stagingFolderPath) }}</strong>
          </article>
          <article class="path-card">
            <p>Library preview</p>
            <strong>{{ formatPath(candidate.planning.libraryFolderPath) }}</strong>
          </article>
        </div>

        <div class="review-warning-stack" v-if="candidate.planning.primaryBlocker || candidate.planning.primaryWarning">
          <article class="review-warning-card is-blocker" v-if="candidate.planning.primaryBlocker">
            <p>Blocker</p>
            <strong>{{ candidate.planning.primaryBlocker }}</strong>
          </article>
          <article class="review-warning-card" v-if="candidate.planning.primaryWarning">
            <p>Warning</p>
            <strong>{{ candidate.planning.primaryWarning }}</strong>
          </article>
        </div>
      </article>
    </div>
  </article>
</template>

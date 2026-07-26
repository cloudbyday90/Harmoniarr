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
import { computed } from 'vue';
import {
  candidateStatusLabel,
  candidateStatusTone,
  formatCandidateCountLabel,
  formatPath,
  formatSourceProvider,
  formatTimestamp,
  formatTokenLabel,
} from '../lib/import-candidate-presentation.js';
import { formatOperationTimestamp } from '../lib/operation-run-presentation.js';
import { formatBytes } from '../lib/search-presentation.js';
import {
  fetchImportCandidates,
  fetchImportPendingCandidateSummary,
} from '../lib/import-candidate-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const props = defineProps({
  status: { type: String, default: 'import_pending' },
  title: { type: String, default: 'Library-add diagnostics' },
  subtitle: { type: String, default: 'Completed downloads that need deeper review before they can be added safely.' },
  emptyTitle: { type: String, default: 'No library adds need review' },
  emptyCopy: { type: String, default: 'Downloads that need manual library-add review will appear here.' },
});

const isImportPendingRoute = computed(() => props.status === 'import_pending');

function createEmptyImportPendingPayload() {
  return {
    counts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalImportPending: 0,
    },
    candidates: [],
    mode: 'import_pending',
    summary: {
      message: props.emptyCopy,
      status: 'empty',
    },
  };
}

function projectImportPendingPayload(payload) {
  const summaryPayload = payload?.importPendingCandidates;

  return {
    counts: summaryPayload?.counts ?? createEmptyImportPendingPayload().counts,
    candidates: Array.isArray(summaryPayload?.importPendingCandidates)
      ? summaryPayload.importPendingCandidates
      : [],
    mode: 'import_pending',
    summary: summaryPayload?.summary ?? createEmptyImportPendingPayload().summary,
  };
}

function projectCandidatePayload(payload) {
  return {
    candidates: Array.isArray(payload?.importCandidates) ? payload.importCandidates : [],
    counts: null,
    mode: 'candidate_list',
    summary: null,
  };
}

const {
  data: importsPayload,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => (isImportPendingRoute.value
    ? fetchImportPendingCandidateSummary({ limit: 100 })
    : fetchImportCandidates({ status: props.status, limit: 100 })),
  project: (payload) => (isImportPendingRoute.value
    ? projectImportPendingPayload(payload)
    : projectCandidatePayload(payload)),
  initialData: createEmptyImportPendingPayload(),
  fallbackErrorMessage: 'Failed to load import candidates',
});

const candidates = computed(() => importsPayload.value?.candidates ?? []);
const candidateCount = computed(() => candidates.value?.length ?? 0);
const importPendingCounts = computed(() => importsPayload.value?.counts ?? createEmptyImportPendingPayload().counts);
const importPendingSummary = computed(() => importsPayload.value?.summary ?? null);

function importStatusTone(code) {
  switch (code) {
    case 'blocked':
      return 'danger';
    case 'ready_with_warnings':
      return 'warning';
    default:
      return 'info';
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

function buildImportReviewLocation(candidate) {
  return {
    hash: '#import-review-selection-stage',
    name: 'activity-diagnostics-matches',
    query: {
      candidate: candidate.id,
      status: 'import_pending',
    },
  };
}
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">{{ title }}</h2>
        <p class="hx-page-subtitle">{{ subtitle }} {{ formatCandidateCountLabel(candidateCount) }}.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading\u2026' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="isImportPendingRoute && importPendingSummary" class="hx-card">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Import readiness</h3>
          <p class="hx-card-subtitle">{{ importPendingSummary.message }}</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink class="hx-btn" :to="{ name: 'settings-media-storage' }">
            Check path mappings
          </RouterLink>
          <RouterLink class="hx-btn" data-variant="primary" :to="{ name: 'activity-diagnostics-matches', query: { status: 'import_pending' } }">
            Open advanced diagnostics
          </RouterLink>
        </div>
      </div>
      <div class="hx-card-body">
        <div class="hx-stat-grid">
          <div class="hx-stat">
            <span class="hx-stat-label">Import pending</span>
            <span class="hx-stat-value">{{ importPendingCounts.totalImportPending }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">Ready</span>
            <span class="hx-stat-value">{{ importPendingCounts.ready }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">Warnings</span>
            <span class="hx-stat-value">{{ importPendingCounts.readyWithWarnings }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">Blocked</span>
            <span class="hx-stat-value">{{ importPendingCounts.blocked }}</span>
          </div>
        </div>
      </div>
    </article>

    <article v-if="errorMessage" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article class="hx-card">
      <div class="hx-card-body is-flush">
        <div v-if="isLoading && !candidateCount" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!candidateCount" class="hx-empty">
          <p class="hx-empty-title">{{ emptyTitle }}</p>
          <p class="hx-empty-copy">{{ emptyCopy }}</p>
        </div>
        <div v-else-if="isImportPendingRoute" class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>User</th>
                <th>Status</th>
                <th>Source path</th>
                <th>Library target</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="candidate in candidates" :key="candidate.id">
                <td>
                  <strong>{{ candidate.folderPath || 'Root-level files' }}</strong>
                  <p class="hx-text-muted">{{ candidate.fileCount }} file{{ candidate.fileCount === 1 ? '' : 's' }} from {{ formatSourceProvider(candidate.sourceProvider) }}</p>
                </td>
                <td>{{ candidate.username ?? '—' }}</td>
                <td>
                  <span class="hx-pill" :data-tone="importStatusTone(candidate.importStatus?.code)">
                    {{ importStatusLabel(candidate.importStatus?.code) }}
                  </span>
                  <p class="hx-text-muted">{{ candidate.importStatus?.message }}</p>
                  <p class="hx-text-muted" v-if="candidate.planning?.primaryBlocker">Blocker: {{ candidate.planning.primaryBlocker }}</p>
                  <p class="hx-text-muted" v-else-if="candidate.planning?.primaryWarning">Warning: {{ candidate.planning.primaryWarning }}</p>
                </td>
                <td>
                  <span>{{ formatPath(candidate.planning?.sourceFolderPath) }}</span>
                  <p class="hx-text-muted">{{ formatTokenLabel(candidate.planning?.resolutionStrategy) }}</p>
                </td>
                <td>{{ formatPath(candidate.planning?.libraryFolderPath) }}</td>
                <td>{{ formatTimestamp(candidate.importPendingAt) }}</td>
                <td>
                  <RouterLink class="hx-btn" :to="buildImportReviewLocation(candidate)">
                    Open diagnostics
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>User</th>
                <th>Source</th>
                <th class="hx-table-num">Size</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="candidate in candidates" :key="candidate.id">
                <td>{{ candidate.folderPath ?? '\u2014' }}</td>
                <td>{{ candidate.username ?? '\u2014' }}</td>
                <td>{{ formatSourceProvider(candidate.sourceProvider) }}</td>
                <td class="hx-table-num">{{ formatBytes(candidate.totalSizeBytes) }}</td>
                <td><span class="hx-pill" :data-tone="candidateStatusTone(candidate.status)">{{ candidateStatusLabel(candidate.status) }}</span></td>
                <td>{{ candidate.importPendingAt ?? candidate.updatedAt ?? candidate.createdAt ? formatOperationTimestamp(candidate.importPendingAt ?? candidate.updatedAt ?? candidate.createdAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>

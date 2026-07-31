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
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
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
  fetchReleaseAddDiagnostics,
} from '../lib/import-candidate-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const props = defineProps({
  status: { type: String, default: 'import_pending' },
  title: { type: String, default: 'Library-add diagnostics' },
  subtitle: { type: String, default: 'Completed downloads that need deeper review before they can be added safely.' },
  emptyTitle: { type: String, default: 'No library adds need review' },
  emptyCopy: { type: String, default: 'Downloads that need manual library-add review will appear here.' },
});

const route = useRoute();
const isImportPendingRoute = computed(() => props.status === 'import_pending');
const wantedReleaseId = computed(() => {
  const value = route.query.wantedReleaseId;
  return typeof value === 'string' ? value.trim() : '';
});
const isReleaseScopedDiagnostics = computed(() => (
  isImportPendingRoute.value && wantedReleaseId.value.length > 0
));

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

function projectReleaseAddDiagnosticsPayload(payload) {
  const diagnostics = payload?.releaseAddDiagnostics ?? {};
  return {
    candidates: [],
    counts: null,
    latestOutcome: diagnostics.latestOutcome ?? null,
    mode: 'release_add_diagnostics',
    outcomes: Array.isArray(diagnostics.outcomes) ? diagnostics.outcomes : [],
    release: diagnostics.release ?? null,
    summary: diagnostics.summary ?? null,
  };
}

const {
  data: importsPayload,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => (isReleaseScopedDiagnostics.value
    ? fetchReleaseAddDiagnostics({ limit: 10, wantedReleaseId: wantedReleaseId.value })
    : isImportPendingRoute.value
      ? fetchImportPendingCandidateSummary({ limit: 100 })
    : fetchImportCandidates({ status: props.status, limit: 100 })),
  project: (payload) => (isReleaseScopedDiagnostics.value
    ? projectReleaseAddDiagnosticsPayload(payload)
    : isImportPendingRoute.value
      ? projectImportPendingPayload(payload)
    : projectCandidatePayload(payload)),
  initialData: createEmptyImportPendingPayload(),
  fallbackErrorMessage: 'Failed to load import candidates',
});

const candidates = computed(() => importsPayload.value?.candidates ?? []);
const candidateCount = computed(() => candidates.value?.length ?? 0);
const importPendingCounts = computed(() => importsPayload.value?.counts ?? createEmptyImportPendingPayload().counts);
const importPendingSummary = computed(() => importsPayload.value?.summary ?? null);
const releaseAddDiagnostics = computed(() => importsPayload.value?.mode === 'release_add_diagnostics'
  ? importsPayload.value
  : null);
const releaseAddOutcomes = computed(() => releaseAddDiagnostics.value?.outcomes ?? []);
const releaseAddLatestOutcome = computed(() => releaseAddDiagnostics.value?.latestOutcome ?? null);
const releaseAddRelease = computed(() => releaseAddDiagnostics.value?.release ?? null);
const releaseAddSummary = computed(() => releaseAddDiagnostics.value?.summary ?? null);
const pageTitle = computed(() => (isReleaseScopedDiagnostics.value
  ? 'Library-add details'
  : props.title));
const pageSubtitle = computed(() => {
  if (!isReleaseScopedDiagnostics.value) {
    return `${props.subtitle} ${formatCandidateCountLabel(candidateCount.value)}.`;
  }

  if (releaseAddRelease.value) {
    return `Recent safe library-add outcomes for ${releaseAddRelease.value.releaseTitle} by ${releaseAddRelease.value.artistName}.`;
  }

  return 'Recent safe library-add outcomes for this Music Queue release.';
});

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

function buildImportReviewLocation(candidateId) {
  return {
    hash: '#import-review-selection-stage',
    name: 'activity-diagnostics-matches',
    query: {
      candidate: candidateId,
    },
  };
}

watch(wantedReleaseId, (nextWantedReleaseId, previousWantedReleaseId) => {
  if (nextWantedReleaseId !== previousWantedReleaseId) {
    void load();
  }
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">{{ pageTitle }}</h2>
        <p class="hx-page-subtitle">{{ pageSubtitle }}</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading\u2026' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="isReleaseScopedDiagnostics" class="hx-card">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">{{ releaseAddLatestOutcome?.presentation?.label ?? 'No library-add result yet' }}</h3>
          <p class="hx-card-subtitle">{{ releaseAddSummary?.message ?? 'No library-add result has been recorded for this release yet.' }}</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink class="hx-btn" :to="{ name: 'music-queue-release', params: { wantedReleaseId } }">
            Return to Music Queue
          </RouterLink>
          <RouterLink
            v-if="releaseAddLatestOutcome?.presentation?.settingsRouteName"
            class="hx-btn"
            data-variant="primary"
            :to="{ name: releaseAddLatestOutcome.presentation.settingsRouteName }"
          >
            {{ releaseAddLatestOutcome.presentation.settingsRouteLabel }}
          </RouterLink>
          <RouterLink
            v-if="releaseAddLatestOutcome?.diagnosticCandidateId"
            class="hx-btn"
            data-variant="primary"
            :to="buildImportReviewLocation(releaseAddLatestOutcome.diagnosticCandidateId)"
          >
            Open match diagnostics
          </RouterLink>
        </div>
      </div>
      <div class="hx-card-body">
        <dl v-if="releaseAddLatestOutcome" class="release-add-diagnostics__facts">
          <div>
            <dt>Latest check</dt>
            <dd><span class="hx-pill" :data-tone="releaseAddLatestOutcome.presentation.tone">{{ releaseAddLatestOutcome.presentation.label }}</span></dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{{ formatOperationTimestamp(releaseAddLatestOutcome.updatedAt) }}</dd>
          </div>
        </dl>
        <p v-if="releaseAddLatestOutcome?.presentation?.nextStep" class="hx-text-muted">
          {{ releaseAddLatestOutcome.presentation.nextStep }}
        </p>
      </div>
    </article>

    <article v-else-if="isImportPendingRoute && importPendingSummary" class="hx-card">
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
        <div v-else-if="isReleaseScopedDiagnostics" class="hx-card-body">
          <div v-if="!releaseAddOutcomes.length" class="hx-empty">
            <p class="hx-empty-title">No library-add history yet</p>
            <p class="hx-empty-copy">Harmoniarr will add a safe outcome here when this release reaches the library-add step.</p>
          </div>
          <div v-else class="release-add-diagnostics__history">
            <section v-for="outcome in releaseAddOutcomes" :key="`${outcome.diagnosticCandidateId}:${outcome.updatedAt}`" class="release-add-diagnostics__outcome">
              <div>
                <strong>{{ outcome.presentation.label }}</strong>
                <p class="hx-text-muted">{{ outcome.presentation.detail }}</p>
                <p class="hx-text-muted">{{ formatOperationTimestamp(outcome.updatedAt) }}</p>
              </div>
              <RouterLink class="hx-btn" :to="buildImportReviewLocation(outcome.diagnosticCandidateId)">
                Open match diagnostics
              </RouterLink>
            </section>
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
                  <RouterLink class="hx-btn" :to="buildImportReviewLocation(candidate.id)">
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

<style scoped>
.release-add-diagnostics__facts {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.release-add-diagnostics__facts div {
  display: grid;
  gap: var(--hx-space-1);
}

.release-add-diagnostics__facts dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-font-size-xs);
  font-weight: var(--hx-font-weight-semibold);
  text-transform: uppercase;
}

.release-add-diagnostics__facts dd {
  margin: 0;
}

.release-add-diagnostics__history {
  display: grid;
}

.release-add-diagnostics__outcome {
  align-items: center;
  border-top: 1px solid var(--hx-border-subtle);
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
  padding: var(--hx-space-3) 0;
}

.release-add-diagnostics__outcome:first-child {
  border-top: 0;
  padding-top: 0;
}

.release-add-diagnostics__outcome:last-child {
  padding-bottom: 0;
}

.release-add-diagnostics__outcome p {
  margin: var(--hx-space-1) 0 0;
}

@media (max-width: 640px) {
  .release-add-diagnostics__facts {
    grid-template-columns: 1fr;
  }

  .release-add-diagnostics__outcome {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

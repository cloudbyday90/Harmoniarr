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
import { nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ImportCandidateApplyPanel from '../components/ImportCandidateApplyPanel.vue';
import ImportCandidateExecutionPanel from '../components/ImportCandidateExecutionPanel.vue';
import ImportCandidateDetailPanel from '../components/ImportCandidateDetailPanel.vue';
import ImportCandidateFilters from '../components/ImportCandidateFilters.vue';
import ImportCandidateQueueList from '../components/ImportCandidateQueueList.vue';
import ImportPendingCandidateStatusPanel from '../components/ImportPendingCandidateStatusPanel.vue';
import {
  buildImportReviewRouteQuery,
  getImportReviewRouteStateKey,
  normalizeImportReviewRouteState,
} from '../lib/import-review-route-state.js';
import { useImportCandidateApplySummary } from '../composables/useImportCandidateApplySummary.js';
import SelectedImportCandidateStatusPanel from '../components/SelectedImportCandidateStatusPanel.vue';
import { useImportCandidateExecutionSummary } from '../composables/useImportCandidateExecutionSummary.js';
import { useImportReviewWorkspace } from '../composables/useImportReviewWorkspace.js';

const route = useRoute();
const router = useRouter();

const {
  actionError,
  actionReason,
  activeFilterCount,
  applyPreview,
  applyPreviewError,
  applyFilters,
  candidates,
  decisionError,
  detailError,
  folderPathFilter,
  importPendingCandidates,
  importPendingSummary,
  importPendingSummaryCounts,
  importPendingSummaryError,
  isLoadingApplyPreview,
  isLoadingCandidate,
  isUpdatingFileDecision,
  isLoadingImportPendingSummary,
  isLoadingPreview,
  isLoadingQueue,
  isTransitionPending,
  lastLoadedAt,
  listError,
  openCandidate,
  pagination,
  pendingFileDecisionId,
  preview,
  previewError,
  refreshQueue,
  resetQueueFilters,
  runClearCandidateFileDecision,
  runHoldCandidate,
  runRejectCandidate,
  runReopenCandidate,
  runSkipCandidateFile,
  runSelectCandidate,
  selectedCandidates,
  selectedCandidate,
  selectedCandidateId,
  selectedSummary,
  selectedSummaryCounts,
  selectedSummaryError,
  sourceSearchIdFilter,
  statusFilter,
  summaryPills,
  usernameFilter,
  isLoadingSelectedSummary,
} = useImportReviewWorkspace();

const {
  actionErrorMessage: applyActionErrorMessage,
  currentRun: currentApplyRun,
  errorMessage: applyErrorMessage,
  isLoading: isLoadingApplySummary,
  isStarting: isStartingApplyRun,
  loadImportCandidateApplySummary,
  runDetailErrorMessage: applyRunDetailErrorMessage,
  selectedRunId: selectedApplyRunId,
  startApplyRun,
  summary: applyRunSummary,
} = useImportCandidateApplySummary();

const {
  actionErrorMessage: executionActionErrorMessage,
  currentRun,
  errorMessage: executionErrorMessage,
  isLoading: isLoadingExecutionSummary,
  isReconciling: isReconcilingExecutionState,
  isStarting: isStartingExecutionRun,
  loadImportCandidateExecutionSummary,
  reconcileExecutionState,
  runDetailErrorMessage: executionRunDetailErrorMessage,
  selectedRunId: selectedExecutionRunId,
  startExecutionRun,
  summary: executionSummary,
} = useImportCandidateExecutionSummary();

function importReviewRouteState() {
  return normalizeImportReviewRouteState(route.query);
}

function buildMergedImportReviewRouteQuery(nextState) {
  const query = { ...route.query };
  delete query.applyRunId;
  delete query.candidate;
  delete query.executionRunId;
  delete query.folderPath;
  delete query.sourceSearchId;
  delete query.status;
  delete query.username;

  return {
    ...query,
    ...buildImportReviewRouteQuery({
      ...importReviewRouteState(),
      ...nextState,
    }),
  };
}

async function replaceImportReviewRouteState(nextState, { hash = route.hash } = {}) {
  const normalizedCurrentState = importReviewRouteState();
  const normalizedNextState = normalizeImportReviewRouteState({
    ...normalizedCurrentState,
    ...nextState,
  });

  if (
    getImportReviewRouteStateKey(normalizedCurrentState) === getImportReviewRouteStateKey(normalizedNextState)
    && hash === route.hash
  ) {
    return;
  }

  await router.replace({
    hash,
    query: buildMergedImportReviewRouteQuery(normalizedNextState),
  });
}

function scrollPanelIntoView(panelId) {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById(panelId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

async function handleStartExecutionRun() {
  await replaceImportReviewRouteState({ executionRunId: '' }, { hash: '#import-execution-run-panel' });
  await startExecutionRun();
  await refreshQueue({ preserveSelection: true });
}

async function handleReconcileExecutionState() {
  await replaceImportReviewRouteState({ executionRunId: '' }, { hash: '#import-execution-run-panel' });
  await reconcileExecutionState();
  await refreshQueue({ preserveSelection: true });
}

async function handleStartApplyRun() {
  await replaceImportReviewRouteState({ applyRunId: '' }, { hash: '#import-apply-run-panel' });
  await startApplyRun();
  await refreshQueue({ preserveSelection: true });
}

watch(
  () => selectedSummaryCounts.value.totalSelected,
  () => {
    void loadImportCandidateExecutionSummary();
  },
  { immediate: true },
);

watch(
  () => importPendingSummaryCounts.value.totalImportPending,
  () => {
    void loadImportCandidateApplySummary();
  },
  { immediate: true },
);

watch(
  () => importReviewRouteState().executionRunId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      if (selectedExecutionRunId.value !== null) {
        void loadImportCandidateExecutionSummary({ preferredRunId: null });
      }
      return;
    }

    void loadImportCandidateExecutionSummary({ preferredRunId: nextRunId });
    void nextTick().then(() => scrollPanelIntoView('import-execution-run-panel'));
  },
);

watch(
  () => importReviewRouteState().applyRunId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      if (selectedApplyRunId.value !== null) {
        void loadImportCandidateApplySummary({ preferredRunId: null });
      }
      return;
    }

    void loadImportCandidateApplySummary({ preferredRunId: nextRunId });
    void nextTick().then(() => scrollPanelIntoView('import-apply-run-panel'));
  },
);
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Import review</p>
      <h2>Persisted slskd candidates</h2>
      <p>Review stored discovery results, inspect persisted files, and move candidates through the hold, select, reject, and reopen workflow before apply behavior lands.</p>
      <div class="pill-row" v-if="summaryPills.length">
        <div class="pill" v-for="pill in summaryPills" :key="pill.label">
          <span>{{ pill.label }}</span>
          <strong>{{ pill.value }}</strong>
        </div>
      </div>
    </article>

    <ImportCandidateFilters
      :active-filter-count="activeFilterCount"
      :folder-path="folderPathFilter"
      :is-loading-queue="isLoadingQueue"
      :source-search-id="sourceSearchIdFilter"
      :status="statusFilter"
      :username="usernameFilter"
      @apply-filters="applyFilters"
      @reset-filters="resetQueueFilters"
      @update:folder-path="folderPathFilter = $event"
      @update:source-search-id="sourceSearchIdFilter = $event"
      @update:status="statusFilter = $event"
      @update:username="usernameFilter = $event"
    />

    <section class="review-layout">
      <ImportCandidateQueueList
        :candidates="candidates"
        :is-loading-queue="isLoadingQueue"
        :last-loaded-at="lastLoadedAt"
        :list-error="listError"
        :selected-candidate-id="selectedCandidateId"
        :total-candidates="pagination.total"
        @refresh="refreshQueue"
        @select-candidate="openCandidate"
      />

      <ImportCandidateDetailPanel
        :action-error="actionError"
        :action-reason="actionReason"
        :apply-preview="applyPreview"
        :apply-preview-error="applyPreviewError"
        :candidate="selectedCandidate"
        :detail-error="detailError"
        :file-decision-error="decisionError"
        :is-loading-apply-preview="isLoadingApplyPreview"
        :is-loading-candidate="isLoadingCandidate"
        :is-updating-file-decision="isUpdatingFileDecision"
        :is-loading-preview="isLoadingPreview"
        :is-transition-pending="isTransitionPending"
        :pending-file-decision-id="pendingFileDecisionId"
        :preview="preview"
        :preview-error="previewError"
        @clear-file-decision="runClearCandidateFileDecision"
        @hold="runHoldCandidate"
        @reject="runRejectCandidate"
        @reopen="runReopenCandidate"
        @select="runSelectCandidate"
        @skip-file="runSkipCandidateFile"
        @update:action-reason="actionReason = $event"
      />
    </section>

    <SelectedImportCandidateStatusPanel
      :counts="selectedSummaryCounts"
      :error-message="selectedSummaryError"
      :is-loading="isLoadingSelectedSummary"
      :selected-candidates="selectedCandidates"
      :summary="selectedSummary"
    />

    <ImportCandidateExecutionPanel
      id="import-execution-run-panel"
      :action-error-message="executionActionErrorMessage"
      :current-run="currentRun"
      :error-message="executionErrorMessage"
      :is-loading="isLoadingExecutionSummary"
      :is-reconciling="isReconcilingExecutionState"
      :is-starting="isStartingExecutionRun"
      :run-detail-error-message="executionRunDetailErrorMessage"
      :selected-candidate-count="selectedSummaryCounts.totalSelected"
      :summary="executionSummary"
      @reconcile="handleReconcileExecutionState"
      @refresh="loadImportCandidateExecutionSummary"
      @start="handleStartExecutionRun"
    />

    <ImportCandidateApplyPanel
      id="import-apply-run-panel"
      :action-error-message="applyActionErrorMessage"
      :current-run="currentApplyRun"
      :error-message="applyErrorMessage"
      :import-pending-candidate-count="importPendingSummaryCounts.totalImportPending"
      :is-loading="isLoadingApplySummary"
      :is-starting="isStartingApplyRun"
      :run-detail-error-message="applyRunDetailErrorMessage"
      :summary="applyRunSummary"
      @refresh="loadImportCandidateApplySummary"
      @start="handleStartApplyRun"
    />

    <ImportPendingCandidateStatusPanel
      :counts="importPendingSummaryCounts"
      :error-message="importPendingSummaryError"
      :import-pending-candidates="importPendingCandidates"
      :is-loading="isLoadingImportPendingSummary"
      :summary="importPendingSummary"
    />
  </section>
</template>

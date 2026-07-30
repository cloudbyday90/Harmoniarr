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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ImportCandidateApplyPanel from '../components/ImportCandidateApplyPanel.vue';
import ImportCandidateExecutionPanel from '../components/ImportCandidateExecutionPanel.vue';
import ImportCandidateMediaInspectionPanel from '../components/ImportCandidateMediaInspectionPanel.vue';
import ImportCandidateDetailPanel from '../components/ImportCandidateDetailPanel.vue';
import ImportCandidateRecoveryPanel from '../components/ImportCandidateRecoveryPanel.vue';
import ImportReviewMatchFinder from '../components/ImportReviewMatchFinder.vue';
import ImportReviewCurrentAutomation from '../components/ImportReviewCurrentAutomation.vue';
import { useImportReviewWorkspace } from '../composables/useImportReviewWorkspace.js';
import { useImportCandidateApplySummary } from '../composables/useImportCandidateApplySummary.js';
import { useImportCandidateExecutionSummary } from '../composables/useImportCandidateExecutionSummary.js';
import { useImportCandidateMediaInspectionSummary } from '../composables/useImportCandidateMediaInspectionSummary.js';
import {
  IMPORT_REVIEW_APPLY_PANEL_ID,
  IMPORT_REVIEW_EXECUTION_PANEL_ID,
  IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID,
  useImportReviewAdminWorkflow,
} from '../composables/useImportReviewAdminWorkflow.js';
import { normalizeImportReviewRouteState } from '../lib/import-review-route-state.js';
import { shouldOpenCurrentAutomationForRoute } from '../lib/import-review-current-automation-presentation.js';
import { buildImportReviewRecoveryFocus } from '../lib/import-review-recovery-focus-presentation.js';
import { shouldOpenRunHistoryControls } from '../lib/import-review-runway-presentation.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const IMPORT_REVIEW_SELECTION_STAGE_ID = 'import-review-selection-stage';
const isCurrentAutomationOpen = ref(false);
const isEvidenceOpen = ref(false);
const isRunHistoryOpen = ref(false);

const {
  actionError,
  actionStatus,
  activeFilterCount,
  applyPreview,
  applyPreviewError,
  applyFilters,
  attachVisibilityListener,
  candidates,
  decisionError,
  destroy: destroyWorkspace,
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
  isRevalidating,
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
  usernameFilter,
  isLoadingSelectedSummary,
} = useImportReviewWorkspace({ pollIntervalMs: 15000, revalidateOnFocus: true });

async function scrollPanelIntoView(panelId, { focus = false } = {}) {
  if (typeof document === 'undefined') {
    return;
  }

  const panel = document.getElementById(panelId);
  if (panel?.closest('.import-review-runway')) {
    isRunHistoryOpen.value = true;
    await nextTick();
  }
  panel?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
  if (focus) {
    panel?.focus({ preventScroll: true });
  }
}

const applySummaryWorkflow = useImportCandidateApplySummary({ pollIntervalMs: 15000, revalidateOnFocus: true });
const executionSummaryWorkflow = useImportCandidateExecutionSummary({ pollIntervalMs: 15000, revalidateOnFocus: true });
const mediaInspectionSummaryWorkflow = useImportCandidateMediaInspectionSummary({ pollIntervalMs: 15000, revalidateOnFocus: true });

const adminWorkflow = useImportReviewAdminWorkflow({
  applySummaryWorkflow,
  executionSummaryWorkflow,
  importPendingCandidateCount: computed(() => importPendingSummaryCounts.value.totalImportPending),
  isAdmin,
  mediaInspectionSummaryWorkflow,
  onPanelNavigate: async (panelId) => {
    await scrollPanelIntoView(panelId);
  },
  refreshQueue,
  selectedCandidateCount: computed(() => selectedSummaryCounts.value.totalSelected),
});

const isAnyRunRevalidating = computed(() =>
  adminWorkflow.apply.isRevalidating?.value
  || adminWorkflow.execution.isRevalidating?.value
  || adminWorkflow.mediaInspection.isRevalidating?.value,
);

const focusedCandidateFileId = computed(() =>
  normalizeImportReviewRouteState(route.query).candidateFileId,
);
const importReviewRouteState = computed(() => normalizeImportReviewRouteState(route.query));
const recoveryFocus = computed(() => buildImportReviewRecoveryFocus(importReviewRouteState.value));

watch(focusedCandidateFileId, (fileId) => {
  if (fileId) {
    isEvidenceOpen.value = true;
  }
}, { immediate: true });

watch(importReviewRouteState, (nextRouteState) => {
  if (shouldOpenCurrentAutomationForRoute(nextRouteState)) {
    isCurrentAutomationOpen.value = true;
  }

  if (shouldOpenRunHistoryControls(nextRouteState)) {
    isRunHistoryOpen.value = true;
  }
}, { immediate: true });

function normalizeDiagnosticCandidateTarget(target) {
  if (typeof target === 'string') {
    return {
      candidateId: target.trim(),
      fileId: '',
    };
  }

  return {
    candidateId: typeof target?.candidateId === 'string' ? target.candidateId.trim() : '',
    fileId: typeof target?.fileId === 'string' ? target.fileId.trim() : '',
  };
}

async function openDiagnosticCandidate(target) {
  const { candidateId, fileId } = normalizeDiagnosticCandidateTarget(target);
  if (!candidateId) {
    return;
  }

  await adminWorkflow.replaceImportReviewRouteState(
    { candidateFileId: fileId, candidateId },
    { hash: `#${IMPORT_REVIEW_SELECTION_STAGE_ID}` },
  );
  await nextTick();
  await scrollPanelIntoView(IMPORT_REVIEW_SELECTION_STAGE_ID, { focus: true });
}

async function openMatchFinderResult(candidateId) {
  await openCandidate(candidateId);
  await nextTick();
  await scrollPanelIntoView(IMPORT_REVIEW_SELECTION_STAGE_ID, { focus: true });
}

onMounted(() => {
  if (!isAdmin.value && !route.query.status) {
    void adminWorkflow.replaceImportReviewRouteState({ status: '' });
  }
  attachVisibilityListener();
  adminWorkflow.attachVisibilityListener();
});

onBeforeUnmount(() => {
  destroyWorkspace();
  adminWorkflow.destroy();
});
</script>

<template>
  <section class="hx-page import-review-page">
    <header class="import-review-page__header">
      <div>
        <p class="import-review-page__eyebrow">Advanced diagnostics</p>
        <h1>Match diagnostics <span v-if="isRevalidating" class="import-review-revalidating" aria-label="Refreshing">↻</span></h1>
        <p>
          Music Queue handles normal progress. Use this page only when a match needs a closer look or a safe recovery action.
        </p>
      </div>
      <aside class="import-review-page__recovery-focus" aria-label="Recovery focus">
        <span>Recovery focus</span>
        <strong>{{ recoveryFocus }}</strong>
      </aside>
    </header>

    <article class="hx-card import-review-access-card" v-if="!isAdmin">
      <p>
        Music Queue handles the normal workflow. This diagnostics page exposes raw match details and admin-only recovery controls when a release needs deeper inspection.
      </p>
    </article>

    <section class="import-review-layout">
      <ImportReviewMatchFinder
          v-if="isAdmin"
          :active-filter-count="activeFilterCount"
          :candidates="candidates"
          :folder-path="folderPathFilter"
          :is-loading-queue="isLoadingQueue"
          :last-loaded-at="lastLoadedAt"
          :list-error="listError"
          :selected-candidate-id="selectedCandidateId"
          :source-search-id="sourceSearchIdFilter"
          :status="statusFilter"
          :total-candidates="pagination.total"
          :username="usernameFilter"
          @apply-filters="applyFilters"
          @refresh="refreshQueue"
          @reset-filters="resetQueueFilters"
          @select-match="openMatchFinderResult"
          @update:folder-path="folderPathFilter = $event"
          @update:source-search-id="sourceSearchIdFilter = $event"
          @update:status="statusFilter = $event"
          @update:username="usernameFilter = $event"
        />

      <div class="import-review-layout__workspace">
        <section :id="IMPORT_REVIEW_SELECTION_STAGE_ID" class="import-review-workspace-card" tabindex="-1">
          <div class="import-review-workspace-card__header">
            <div>
              <p class="import-review-workspace-card__eyebrow">Selected match</p>
              <h2 class="import-review-workspace-card__title">Current state and recovery</h2>
              <p class="import-review-workspace-card__copy">
                Start with the current automatic state. Detailed source and file evidence is available only when it is needed.
              </p>
            </div>
          </div>

          <ImportCandidateRecoveryPanel
            :action-error="actionError"
            :action-status="actionStatus"
            :candidate="selectedCandidate"
            :can-manage-candidates="isAdmin"
            :detail-error="detailError"
            :is-loading="isLoadingCandidate"
            :is-transition-pending="isTransitionPending"
            :preview="preview"
            @hold="runHoldCandidate"
            @reject="runRejectCandidate"
            @reopen="runReopenCandidate"
            @select="runSelectCandidate"
          />

          <details
            class="import-review-evidence"
            :open="isEvidenceOpen"
            @toggle="isEvidenceOpen = $event.currentTarget.open"
          >
            <summary>View match and file evidence</summary>
            <p>
              Source paths, file rows, collision checks, and exceptional file decisions are shown here for diagnosis only.
            </p>
            <ImportCandidateDetailPanel
              :apply-preview="applyPreview"
              :apply-preview-error="applyPreviewError"
              :candidate="selectedCandidate"
              :can-manage-candidates="isAdmin"
              :detail-error="detailError"
              :file-decision-error="decisionError"
              :focused-file-id="focusedCandidateFileId"
              :is-loading-apply-preview="isLoadingApplyPreview"
              :is-loading-candidate="isLoadingCandidate"
              :is-loading-preview="isLoadingPreview"
              :is-transition-pending="isTransitionPending"
              :is-updating-file-decision="isUpdatingFileDecision"
              :pending-file-decision-id="pendingFileDecisionId"
              :preview="preview"
              :preview-error="previewError"
              @clear-file-decision="runClearCandidateFileDecision"
              @skip-file="runSkipCandidateFile"
            />
          </details>
        </section>

        <ImportReviewCurrentAutomation
          :import-pending-candidates="importPendingCandidates"
          :import-pending-counts="importPendingSummaryCounts"
          :import-pending-error="importPendingSummaryError"
          :import-pending-summary="importPendingSummary"
          :is-loading-import-pending="isLoadingImportPendingSummary"
          :is-loading-selected="isLoadingSelectedSummary"
          :is-open="isCurrentAutomationOpen"
          :selected-candidates="selectedCandidates"
          :selected-counts="selectedSummaryCounts"
          :selected-error="selectedSummaryError"
          :selected-summary="selectedSummary"
          @update:is-open="isCurrentAutomationOpen = $event"
        />
      </div>
    </section>

    <details
      class="import-review-runway"
      v-if="isAdmin"
      :open="isRunHistoryOpen"
      @toggle="isRunHistoryOpen = $event.currentTarget.open"
    >
      <summary class="import-review-runway__summary">
        <hgroup class="import-review-runway__heading">
          <p class="import-review-workspace-card__eyebrow">Advanced diagnostics</p>
          <h2 class="import-review-workspace-card__title">Run history and controls <span v-if="isAnyRunRevalidating" class="import-review-revalidating" aria-label="Refreshing">↻</span></h2>
          <p class="import-review-workspace-card__copy">
            Check media, send selected matches to downloads, or add completed downloads to the library when a release needs operator attention.
          </p>
        </hgroup>
        <span class="import-review-runway__summary-state">{{ isRunHistoryOpen ? 'Hide' : 'Show' }}</span>
      </summary>

      <div class="import-review-runway__content">
        <p class="import-review-runway__notice">
          Music Queue handles normal progress. These controls preserve detailed run history and manual recovery for exceptional cases.
        </p>
        <div class="import-review-runway__stack">
          <ImportCandidateMediaInspectionPanel
            :id="IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID"
            :action-error-message="adminWorkflow.mediaInspection.actionErrorMessage?.value"
            :current-run="adminWorkflow.mediaInspection.currentRun?.value"
            :error-message="adminWorkflow.mediaInspection.errorMessage?.value"
            :is-loading="adminWorkflow.mediaInspection.isLoading?.value"
            :is-starting="adminWorkflow.mediaInspection.isStarting?.value"
            :recent-runs="adminWorkflow.mediaInspection.recentRuns?.value"
            :run-detail-error-message="adminWorkflow.mediaInspection.runDetailErrorMessage?.value"
            :selected-candidate-count="selectedSummaryCounts.totalSelected"
            :selected-run-id="adminWorkflow.mediaInspection.selectedRunId?.value"
            :summary="adminWorkflow.mediaInspection.summary?.value"
            @refresh="adminWorkflow.mediaInspection.handleRefresh"
            @open-candidate="openDiagnosticCandidate"
            @select-run="adminWorkflow.mediaInspection.handleSelectRun"
            @start="adminWorkflow.mediaInspection.handleStartRun"
          />

          <ImportCandidateExecutionPanel
            :id="IMPORT_REVIEW_EXECUTION_PANEL_ID"
            :action-error-message="adminWorkflow.execution.actionErrorMessage?.value"
            :current-run="adminWorkflow.execution.currentRun?.value"
            :error-message="adminWorkflow.execution.errorMessage?.value"
            :is-loading="adminWorkflow.execution.isLoading?.value"
            :is-reconciling="adminWorkflow.execution.isReconciling?.value"
            :is-starting="adminWorkflow.execution.isStarting?.value"
            :recent-runs="adminWorkflow.execution.recentRuns?.value"
            :run-detail-error-message="adminWorkflow.execution.runDetailErrorMessage?.value"
            :selected-candidate-count="selectedSummaryCounts.totalSelected"
            :selected-run-id="adminWorkflow.execution.selectedRunId?.value"
            :summary="adminWorkflow.execution.summary?.value"
            @reconcile="adminWorkflow.execution.handleReconcile"
            @refresh="adminWorkflow.execution.handleRefresh"
            @select-run="adminWorkflow.execution.handleSelectRun"
            @start="adminWorkflow.execution.handleStartRun"
          />

          <ImportCandidateApplyPanel
            :id="IMPORT_REVIEW_APPLY_PANEL_ID"
            :action-error-message="adminWorkflow.apply.actionErrorMessage?.value"
            :current-run="adminWorkflow.apply.currentRun?.value"
            :error-message="adminWorkflow.apply.errorMessage?.value"
            :import-pending-candidate-count="importPendingSummaryCounts.totalImportPending"
            :is-loading="adminWorkflow.apply.isLoading?.value"
            :is-starting="adminWorkflow.apply.isStarting?.value"
            :recent-runs="adminWorkflow.apply.recentRuns?.value"
            :run-detail-error-message="adminWorkflow.apply.runDetailErrorMessage?.value"
            :selected-run-id="adminWorkflow.apply.selectedRunId?.value"
            :summary="adminWorkflow.apply.summary?.value"
            @refresh="adminWorkflow.apply.handleRefresh"
            @select-run="adminWorkflow.apply.handleSelectRun"
            @start="adminWorkflow.apply.handleStartRun"
          />
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.import-review-page {
  display: grid;
  gap: var(--hx-space-5);
}

.import-review-page__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding-bottom: var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border);
}

.import-review-page__eyebrow {
  margin: 0 0 var(--hx-space-2);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.import-review-page__header h1 {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-2xl);
}

.import-review-page__header p:not(.import-review-page__eyebrow) {
  max-width: 72ch;
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
  line-height: 1.55;
}

.import-review-page__recovery-focus {
  display: grid;
  flex: 0 0 auto;
  gap: var(--hx-space-1);
  text-align: right;
  white-space: nowrap;
}

.import-review-page__recovery-focus span {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.import-review-page__recovery-focus strong {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.import-review-evidence {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-sunken);
}

.import-review-evidence > summary {
  padding: var(--hx-space-4);
  color: var(--hx-text-strong);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.import-review-evidence > summary:focus-visible {
  border-radius: var(--hx-radius-sm);
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.import-review-evidence > p {
  max-width: 74ch;
  margin: 0;
  padding: 0 var(--hx-space-4) var(--hx-space-4);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.import-review-evidence :deep(.review-panel) {
  margin: 0 var(--hx-space-3) var(--hx-space-3);
}

.import-review-workspace-card__eyebrow {
  margin: 0 0 var(--hx-space-2);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.import-review-revalidating {
  display: inline-block;
  font-size: 0.5em;
  animation: import-review-spin 1s linear infinite;
  color: var(--hx-text-on-dark-muted);
}

@keyframes import-review-spin {
  to { transform: rotate(360deg); }
}

.import-review-workspace-card__copy {
  margin: var(--hx-space-3) 0 0;
  max-width: 70ch;
  color: var(--hx-text-muted);
  line-height: 1.6;
}

.import-review-access-card {
  padding: var(--hx-space-4);
}

.import-review-access-card p {
  margin: 0;
  color: var(--hx-text-muted);
}

.import-review-layout {
  display: grid;
  gap: var(--hx-space-4);
  align-items: start;
}

.import-review-layout__workspace,
.import-review-runway__stack,
.import-review-runway__content {
  display: grid;
  gap: var(--hx-space-4);
}

.import-review-workspace-card,
.import-review-runway {
  display: grid;
  gap: var(--hx-space-4);
}

.import-review-workspace-card:focus-visible {
  border-radius: var(--hx-radius-md);
  outline: 2px solid var(--hx-accent);
  outline-offset: 3px;
}

.import-review-workspace-card__header {
  padding: var(--hx-space-4) var(--hx-space-4) 0;
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

.import-review-workspace-card__header {
  padding-bottom: var(--hx-space-4);
}

.import-review-workspace-card__title {
  margin: 0;
  font-size: clamp(1.25rem, 0.8vw + 1rem, 1.85rem);
  line-height: 1.15;
}

.import-review-runway {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
  gap: var(--hx-space-3);
}

.import-review-runway__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-4);
  cursor: pointer;
  list-style: none;
}

.import-review-runway__summary::-webkit-details-marker {
  display: none;
}

.import-review-runway__heading {
  margin: 0;
}

.import-review-runway__summary:focus-visible {
  border-radius: var(--hx-radius-sm);
  outline: 2px solid var(--hx-accent);
  outline-offset: -3px;
}

.import-review-runway__summary-state {
  flex: 0 0 auto;
  color: var(--hx-accent);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.import-review-runway__content {
  padding: 0 var(--hx-space-4) var(--hx-space-4);
}

.import-review-runway__notice {
  max-width: 74ch;
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

:deep(.import-review-layout__workspace .review-panel),
:deep(.import-review-current-automation__details .review-panel),
:deep(.import-review-runway__stack .review-panel) {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

:deep(.import-review-layout__workspace .review-panel),
:deep(.import-review-current-automation__details .review-panel),
:deep(.import-review-runway__stack .review-panel) {
  overflow: hidden;
}

:deep(.import-review-layout__workspace .review-panel > .section-header),
:deep(.import-review-current-automation__details .review-panel > .section-header),
:deep(.import-review-runway__stack .review-panel > .section-header) {
  padding: var(--hx-space-4) var(--hx-space-4) 0;
}

:deep(.import-review-layout__workspace .review-panel > .review-summary-copy),
:deep(.import-review-current-automation__details .review-panel > .review-summary-copy),
:deep(.import-review-runway__stack .review-panel > .review-summary-copy) {
  padding-inline: var(--hx-space-4);
}

:deep(.import-review-layout__workspace .review-panel > *:last-child),
:deep(.import-review-current-automation__details .review-panel > *:last-child),
:deep(.import-review-runway__stack .review-panel > *:last-child) {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .import-review-page {
    gap: var(--hx-space-4);
  }

  .import-review-workspace-card__header {
    padding: var(--hx-space-4);
  }

  .import-review-runway__summary {
    align-items: flex-start;
  }

  .import-review-page__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .import-review-page__recovery-focus {
    text-align: left;
    white-space: normal;
  }
}
</style>

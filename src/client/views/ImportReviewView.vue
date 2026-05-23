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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import ImportCandidateApplyPanel from '../components/ImportCandidateApplyPanel.vue';
import ImportCandidateExecutionPanel from '../components/ImportCandidateExecutionPanel.vue';
import ImportCandidateMediaInspectionPanel from '../components/ImportCandidateMediaInspectionPanel.vue';
import ImportCandidateDetailPanel from '../components/ImportCandidateDetailPanel.vue';
import ImportCandidateFilters from '../components/ImportCandidateFilters.vue';
import ImportCandidateQueueList from '../components/ImportCandidateQueueList.vue';
import ImportPendingCandidateStatusPanel from '../components/ImportPendingCandidateStatusPanel.vue';
import SelectedImportCandidateStatusPanel from '../components/SelectedImportCandidateStatusPanel.vue';
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
import {
  buildImportReviewOverviewCards,
  buildImportReviewWorkflowStages,
} from '../lib/import-review-workspace-presentation.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');

const {
  actionError,
  actionReason,
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
  summaryPills,
  usernameFilter,
  isLoadingSelectedSummary,
} = useImportReviewWorkspace({ pollIntervalMs: 15000, revalidateOnFocus: true });

function scrollPanelIntoView(panelId) {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById(panelId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
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
    scrollPanelIntoView(panelId);
  },
  refreshQueue,
  selectedCandidateCount: computed(() => selectedSummaryCounts.value.totalSelected),
});

const overviewCards = computed(() => buildImportReviewOverviewCards({
  activeFilterCount: activeFilterCount.value,
  importPendingCounts: importPendingSummaryCounts.value,
  isAdmin: isAdmin.value,
  pagination: pagination.value,
  selectedCounts: selectedSummaryCounts.value,
  statusFilter: statusFilter.value,
}));

const isAnyRunRevalidating = computed(() =>
  adminWorkflow.apply.isRevalidating?.value
  || adminWorkflow.execution.isRevalidating?.value
  || adminWorkflow.mediaInspection.isRevalidating?.value,
);

const workflowStages = computed(() => buildImportReviewWorkflowStages({
  applyCurrentRun: adminWorkflow.apply.currentRun?.value,
  applySummary: adminWorkflow.apply.summary?.value,
  executionCurrentRun: adminWorkflow.execution.currentRun?.value,
  executionSummary: adminWorkflow.execution.summary?.value,
  importPendingCounts: importPendingSummaryCounts.value,
  mediaInspectionCurrentRun: adminWorkflow.mediaInspection.currentRun?.value,
  mediaInspectionSummary: adminWorkflow.mediaInspection.summary?.value,
  selectedCounts: selectedSummaryCounts.value,
}));

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
    <article class="hx-card import-review-stage">
      <div class="import-review-stage__wash" aria-hidden="true"></div>
      <div class="import-review-stage__body">
        <div class="import-review-stage__intro">
          <div>
            <p class="import-review-stage__eyebrow">Import candidates</p>
            <h1 class="import-review-stage__title">Download candidates <span v-if="isRevalidating" class="import-review-revalidating" aria-label="Refreshing">↻</span></h1>
            <p class="import-review-stage__copy" v-if="isAdmin">
              Review each match, pressure-test the files, queue the download run, and only then apply completed downloads into the library.
            </p>
            <p class="import-review-stage__copy" v-else>
              Track the candidates assigned to your account and follow their progress through review, download, and import.
            </p>
          </div>

          <div class="import-review-stage__signals">
            <div class="import-review-stage__signal" v-for="pill in summaryPills" :key="pill.label">
              <span>{{ pill.label }}</span>
              <strong>{{ pill.value }}</strong>
            </div>
          </div>
        </div>

        <div class="import-review-stage__cards">
          <article
            v-for="card in overviewCards"
            :key="card.id"
            class="import-review-overview-card"
            :data-tone="card.tone"
          >
            <span class="import-review-overview-card__label">{{ card.label }}</span>
            <strong class="import-review-overview-card__value">{{ card.value }}</strong>
            <p class="import-review-overview-card__detail">{{ card.detail }}</p>
          </article>
        </div>
      </div>
    </article>

    <article class="hx-card import-review-access-card" v-if="!isAdmin">
      <p>
        You can inspect candidates assigned to your account. Admin-only controls remain available for review state changes and background runs.
      </p>
    </article>

    <section class="import-review-flow" aria-label="Import review workflow">
      <a
        v-for="stage in workflowStages"
        :key="stage.id"
        class="import-review-flow__stage"
        :data-tone="stage.tone"
        :href="`#${stage.targetId}`"
      >
        <span class="import-review-flow__eyebrow">{{ stage.eyebrow }}</span>
        <strong class="import-review-flow__title">{{ stage.title }}</strong>
        <p class="import-review-flow__body">{{ stage.body }}</p>
        <div class="import-review-flow__metric">
          <span>{{ stage.metric.label }}</span>
          <strong>{{ stage.metric.value }}</strong>
        </div>
      </a>
    </section>

    <section class="import-review-layout">
      <div class="import-review-layout__rail">
        <ImportCandidateFilters
          v-if="isAdmin"
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
      </div>

      <div class="import-review-layout__workspace">
        <section id="import-review-selection-stage" class="import-review-workspace-card">
          <div class="import-review-workspace-card__header">
            <div>
              <p class="import-review-workspace-card__eyebrow">Selection workspace</p>
              <h2 class="import-review-workspace-card__title">Review details and exceptions</h2>
              <p class="import-review-workspace-card__copy">
                Keep the candidate queue on the left and use this workspace to inspect file paths, collision risks, and operator notes before a candidate moves forward.
              </p>
            </div>
          </div>

          <ImportCandidateDetailPanel
            :action-error="actionError"
            :action-reason="actionReason"
            :apply-preview="applyPreview"
            :apply-preview-error="applyPreviewError"
            :candidate="selectedCandidate"
            :can-manage-candidates="isAdmin"
            :detail-error="detailError"
            :file-decision-error="decisionError"
            :is-loading-apply-preview="isLoadingApplyPreview"
            :is-loading-candidate="isLoadingCandidate"
            :is-loading-preview="isLoadingPreview"
            :is-transition-pending="isTransitionPending"
            :is-updating-file-decision="isUpdatingFileDecision"
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

        <div class="import-review-status-grid">
          <SelectedImportCandidateStatusPanel
            :counts="selectedSummaryCounts"
            :error-message="selectedSummaryError"
            :is-loading="isLoadingSelectedSummary"
            :selected-candidates="selectedCandidates"
            :summary="selectedSummary"
          />

          <ImportPendingCandidateStatusPanel
            :counts="importPendingSummaryCounts"
            :error-message="importPendingSummaryError"
            :import-pending-candidates="importPendingCandidates"
            :is-loading="isLoadingImportPendingSummary"
            :summary="importPendingSummary"
          />
        </div>
      </div>
    </section>

    <section class="import-review-runway" v-if="isAdmin">
      <div class="import-review-runway__header">
        <div>
          <p class="import-review-workspace-card__eyebrow">Operator runway</p>
          <h2 class="import-review-workspace-card__title">Advance the workflow in controlled stages <span v-if="isAnyRunRevalidating" class="import-review-revalidating" aria-label="Refreshing">↻</span></h2>
          <p class="import-review-workspace-card__copy">
            Each run below consumes the state prepared above. Inspection validates files, download execution hands work to slskd, and apply commits safe results into the library.
          </p>
        </div>
      </div>

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
          @refresh="adminWorkflow.mediaInspection.loadImportCandidateMediaInspectionSummary"
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
          @refresh="adminWorkflow.execution.loadImportCandidateExecutionSummary"
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
          @refresh="adminWorkflow.apply.loadImportCandidateApplySummary"
          @select-run="adminWorkflow.apply.handleSelectRun"
          @start="adminWorkflow.apply.handleStartRun"
        />
      </div>
    </section>
  </section>
</template>

<style scoped>
.import-review-page {
  display: grid;
  gap: var(--hx-space-5);
}

.import-review-stage {
  position: relative;
  overflow: hidden;
  border-color: rgba(94, 173, 255, 0.2);
  background:
    radial-gradient(circle at top right, rgba(94, 173, 255, 0.18), transparent 36%),
    linear-gradient(145deg, rgba(20, 32, 42, 0.96), rgba(15, 24, 32, 0.9));
  color: var(--hx-text-on-dark);
}

.import-review-stage__wash {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.05), transparent 40%),
    repeating-linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.03) 0,
      rgba(255, 255, 255, 0.03) 10px,
      transparent 10px,
      transparent 20px
    );
  pointer-events: none;
}

.import-review-stage__body {
  position: relative;
  display: grid;
  gap: var(--hx-space-5);
  padding: var(--hx-space-6);
}

.import-review-stage__intro {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
  gap: var(--hx-space-5);
  align-items: end;
}

.import-review-stage__eyebrow,
.import-review-workspace-card__eyebrow {
  margin: 0 0 var(--hx-space-2);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.import-review-stage__eyebrow {
  color: var(--hx-text-on-dark-faint);
}

.import-review-stage__title {
  margin: 0;
  font-size: clamp(1.8rem, 2vw + 1rem, 3rem);
  line-height: 1.02;
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

.import-review-stage__copy,
.import-review-workspace-card__copy {
  margin: var(--hx-space-3) 0 0;
  max-width: 70ch;
  color: var(--hx-text-muted);
  line-height: 1.6;
}

.import-review-stage__copy {
  color: var(--hx-text-on-dark-muted);
}

.import-review-stage__signals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--hx-space-3);
}

.import-review-stage__signal,
.import-review-overview-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--hx-radius-md);
  background: rgba(7, 11, 15, 0.24);
  backdrop-filter: blur(8px);
}

.import-review-stage__signal {
  display: grid;
  gap: var(--hx-space-1);
  min-height: 84px;
  padding: var(--hx-space-3);
}

.import-review-stage__signal span {
  color: var(--hx-text-on-dark-faint);
  font-size: var(--hx-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.import-review-stage__signal strong {
  font-size: var(--hx-text-lg);
}

.import-review-stage__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--hx-space-3);
}

.import-review-overview-card {
  display: grid;
  gap: var(--hx-space-2);
  min-height: 148px;
  padding: var(--hx-space-4);
  color: var(--hx-text-on-dark);
}

.import-review-overview-card[data-tone='success'] {
  border-color: rgba(47, 158, 107, 0.4);
}

.import-review-overview-card[data-tone='warning'] {
  border-color: rgba(192, 138, 22, 0.4);
}

.import-review-overview-card[data-tone='danger'] {
  border-color: rgba(197, 69, 69, 0.42);
}

.import-review-overview-card__label {
  color: var(--hx-text-on-dark-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.import-review-overview-card__value {
  font-size: clamp(1.7rem, 1vw + 1.4rem, 2.5rem);
  line-height: 1;
}

.import-review-overview-card__detail {
  margin: 0;
  color: var(--hx-text-on-dark-muted);
  line-height: 1.5;
}

.import-review-access-card {
  padding: var(--hx-space-4);
}

.import-review-access-card p {
  margin: 0;
  color: var(--hx-text-muted);
}

.import-review-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--hx-space-3);
}

.import-review-flow__stage {
  display: grid;
  gap: var(--hx-space-2);
  min-height: 168px;
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent), var(--hx-bg-surface);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--hx-shadow-sm);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.import-review-flow__stage:hover,
.import-review-flow__stage:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(94, 173, 255, 0.32);
  box-shadow: var(--hx-shadow-md);
}

.import-review-flow__stage[data-tone='success'] {
  background:
    linear-gradient(180deg, rgba(47, 158, 107, 0.08), transparent 55%),
    var(--hx-bg-surface);
}

.import-review-flow__stage[data-tone='warning'] {
  background:
    linear-gradient(180deg, rgba(192, 138, 22, 0.08), transparent 55%),
    var(--hx-bg-surface);
}

.import-review-flow__stage[data-tone='danger'] {
  background:
    linear-gradient(180deg, rgba(197, 69, 69, 0.08), transparent 55%),
    var(--hx-bg-surface);
}

.import-review-flow__stage[data-tone='info'] {
  background:
    linear-gradient(180deg, rgba(94, 173, 255, 0.1), transparent 55%),
    var(--hx-bg-surface);
}

.import-review-flow__eyebrow {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.import-review-flow__title {
  font-size: var(--hx-text-lg);
  line-height: 1.2;
}

.import-review-flow__body {
  margin: 0;
  color: var(--hx-text-muted);
  line-height: 1.5;
}

.import-review-flow__metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: var(--hx-space-2);
  border-top: 1px solid var(--hx-border-subtle);
  color: var(--hx-text-faint);
}

.import-review-flow__metric strong {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.import-review-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.95fr) minmax(0, 1.4fr);
  gap: var(--hx-space-4);
  align-items: start;
}

.import-review-layout__rail,
.import-review-layout__workspace,
.import-review-runway__stack {
  display: grid;
  gap: var(--hx-space-4);
}

.import-review-workspace-card,
.import-review-runway {
  display: grid;
  gap: var(--hx-space-4);
}

.import-review-workspace-card__header,
.import-review-runway__header {
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

.import-review-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-4);
}

.import-review-runway {
  gap: var(--hx-space-3);
}

:deep(.import-review-layout__rail > .panel-light),
:deep(.import-review-layout__workspace .review-panel),
:deep(.import-review-status-grid .review-panel),
:deep(.import-review-runway__stack .review-panel) {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

:deep(.import-review-layout__workspace .review-panel),
:deep(.import-review-status-grid .review-panel),
:deep(.import-review-runway__stack .review-panel) {
  overflow: hidden;
}

:deep(.import-review-layout__workspace .review-panel > .section-header),
:deep(.import-review-status-grid .review-panel > .section-header),
:deep(.import-review-runway__stack .review-panel > .section-header) {
  padding: var(--hx-space-4) var(--hx-space-4) 0;
}

:deep(.import-review-layout__workspace .review-panel > .review-summary-copy),
:deep(.import-review-status-grid .review-panel > .review-summary-copy),
:deep(.import-review-runway__stack .review-panel > .review-summary-copy) {
  padding-inline: var(--hx-space-4);
}

:deep(.import-review-layout__workspace .review-panel > *:last-child),
:deep(.import-review-status-grid .review-panel > *:last-child),
:deep(.import-review-runway__stack .review-panel > *:last-child) {
  margin-bottom: 0;
}

@media (max-width: 1180px) {
  .import-review-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .import-review-layout {
    grid-template-columns: 1fr;
  }

  .import-review-status-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .import-review-stage__intro {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .import-review-page {
    gap: var(--hx-space-4);
  }

  .import-review-stage__body,
  .import-review-workspace-card__header,
  .import-review-runway__header {
    padding: var(--hx-space-4);
  }

  .import-review-flow {
    grid-template-columns: 1fr;
  }

  .import-review-flow__stage {
    min-height: 0;
  }
}
</style>

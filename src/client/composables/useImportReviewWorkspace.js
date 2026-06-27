/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useImportCandidateApplyPreview } from './useImportCandidateApplyPreview.js';
import { useImportCandidateFileDecision } from './useImportCandidateFileDecision.js';
import { useImportCandidatePreview } from './useImportCandidatePreview.js';
import { useImportPendingCandidateSummary } from './useImportPendingCandidateSummary.js';
import { useImportReviewQueue } from './useImportReviewQueue.js';
import { useSelectedImportCandidateSummary } from './useSelectedImportCandidateSummary.js';
import {
  buildImportReviewRouteQuery,
  getImportReviewRouteStateKey,
  normalizeImportReviewRouteState,
} from '../lib/import-review-route-state.js';

function createRouteReplacer({ replaceRoute, router }) {
  if (replaceRoute) {
    return replaceRoute;
  }

  const resolvedRouter = router ?? useRouter();
  return (location) => resolvedRouter.replace(location);
}

async function refreshPreviewForSelection({ clearPreview, loadPreview, selectedCandidateId }) {
  if (!selectedCandidateId.value) {
    clearPreview();
    return null;
  }

  return loadPreview(selectedCandidateId.value);
}

async function refreshApplyPreviewForSelection({ clearApplyPreview, loadApplyPreview, selectedCandidate }) {
  if (!selectedCandidate.value?.id || selectedCandidate.value?.status !== 'import_pending') {
    clearApplyPreview();
    return null;
  }

  return loadApplyPreview(selectedCandidate.value.id);
}

export function useImportReviewWorkspace({
  applyPreviewWorkflow = useImportCandidateApplyPreview(),
  fileDecisionWorkflow = useImportCandidateFileDecision(),
  previewWorkflow = useImportCandidatePreview(),
  importPendingSummaryWorkflow = useImportPendingCandidateSummary(),
  queueWorkflow = useImportReviewQueue(),
  selectedSummaryWorkflow = useSelectedImportCandidateSummary(),
  replaceRoute = null,
  route = null,
  router = null,
} = {}) {
  const resolvedRoute = route ?? useRoute();
  const replaceResolvedRoute = createRouteReplacer({ replaceRoute, router });

  const {
    applyPreview,
    applyPreviewError,
    clearApplyPreview,
    isLoadingApplyPreview,
    loadApplyPreview,
  } = applyPreviewWorkflow;

  const {
    clearFileDecision,
    decisionError,
    isUpdatingFileDecision,
    pendingFileDecisionId,
    skipFile,
  } = fileDecisionWorkflow;

  const {
    clearPreview,
    isLoadingPreview,
    loadPreview,
    preview,
    previewError,
  } = previewWorkflow;

  const {
    counts: importPendingSummaryCounts,
    errorMessage: importPendingSummaryError,
    importPendingCandidates,
    isLoading: isLoadingImportPendingSummary,
    loadImportPendingSummary,
    summary: importPendingSummary,
  } = importPendingSummaryWorkflow;

  const {
    counts: selectedSummaryCounts,
    errorMessage: selectedSummaryError,
    isLoading: isLoadingSelectedSummary,
    loadSelectedSummary,
    selectedCandidates,
    summary: selectedSummary,
  } = selectedSummaryWorkflow;

  const {
    actionError,
    actionReason,
    actionStatus,
    activeFilterCount,
    attachVisibilityListener,
    candidates,
    clearSelection,
    destroy: destroyQueue,
    detailError,
    folderPathFilter,
    holdSelectedCandidate,
    isLoadingCandidate,
    isLoadingQueue,
    isRevalidating,
    isTransitionPending,
    lastLoadedAt,
    listError,
    loadQueue,
    pagination,
    rejectSelectedCandidate,
    reopenSelectedCandidate,
    resetFilters,
    selectSelectedCandidate,
    selectedCandidate,
    selectedCandidateId,
    selectCandidate,
    setFilters,
    sourceSearchIdFilter,
    statusFilter,
    usernameFilter,
  } = queueWorkflow;

  const summaryPills = computed(() => ([
    { label: 'Visible', value: String(candidates.value.length) },
    { label: 'Matching total', value: String(pagination.value.total ?? 0) },
    { label: 'Default status', value: statusFilter.value || 'All' },
  ]).filter((pill) => pill.value));

  function currentRouteState(overrides = {}) {
    const routeState = normalizeImportReviewRouteState(resolvedRoute.query);

    return {
      applyRunId: routeState.applyRunId,
      candidateFileId: routeState.candidateFileId,
      candidateId: selectedCandidateId.value ?? '',
      executionRunId: routeState.executionRunId,
      mediaInspectionRunId: routeState.mediaInspectionRunId,
      folderPath: folderPathFilter.value,
      sourceSearchId: sourceSearchIdFilter.value,
      status: statusFilter.value,
      username: usernameFilter.value,
      ...overrides,
    };
  }

  async function replaceRouteState(overrides = {}) {
    const currentState = normalizeImportReviewRouteState(resolvedRoute.query);
    const nextQuery = buildImportReviewRouteQuery(currentRouteState(overrides));
    const nextState = normalizeImportReviewRouteState(nextQuery);

    if (getImportReviewRouteStateKey(currentState) === getImportReviewRouteStateKey(nextState)) {
      return;
    }

    await replaceResolvedRoute({
      ...(resolvedRoute.hash ? { hash: resolvedRoute.hash } : {}),
      name: 'review-queue',
      query: nextQuery,
    });
  }

  async function syncFromRoute({ preserveSelection = true } = {}) {
    const routeState = normalizeImportReviewRouteState(resolvedRoute.query);

    setFilters(routeState);
    await Promise.all([
      loadImportPendingSummary(),
      loadQueue(),
      loadSelectedSummary(),
    ]);

    const candidateId = routeState.candidateId || candidates.value[0]?.id || '';
    if (!candidateId) {
      clearSelection();
      clearApplyPreview();
      clearPreview();
      return;
    }

    await selectCandidate(candidateId, {
      forceReload: preserveSelection || candidateId === selectedCandidateId.value,
    });

    if (selectedCandidate.value?.id) {
      await Promise.all([
        loadPreview(selectedCandidate.value.id),
        refreshApplyPreviewForSelection({ clearApplyPreview, loadApplyPreview, selectedCandidate }),
      ]);
    } else {
      clearApplyPreview();
      clearPreview();
    }

    if (candidateId !== routeState.candidateId) {
      await replaceRouteState({ candidateFileId: '', candidateId });
    }
  }

  async function refreshQueue({ preserveSelection = true } = {}) {
    await syncFromRoute({ preserveSelection });
  }

  async function applyFilters() {
    await replaceRouteState({ candidateFileId: '', candidateId: '' });
  }

  async function resetQueueFilters() {
    resetFilters();
    clearSelection();
    clearApplyPreview();
    clearPreview();
    await replaceRouteState({
      candidateId: '',
      candidateFileId: '',
      folderPath: '',
      sourceSearchId: '',
      status: 'pending',
      username: '',
    });
  }

  async function openCandidate(importCandidateId) {
    await replaceRouteState({
      candidateFileId: '',
      candidateId: importCandidateId,
    });
  }

  async function runTransition(action) {
    const result = await action();
    if (!result) {
      return null;
    }

    await replaceRouteState();
    await Promise.all([
      refreshApplyPreviewForSelection({ clearApplyPreview, loadApplyPreview, selectedCandidate }),
      refreshPreviewForSelection({ clearPreview, loadPreview, selectedCandidateId }),
      loadImportPendingSummary(),
      loadSelectedSummary(),
    ]);
    return result;
  }

  async function runFileDecision(action, importCandidateFileId) {
    if (!selectedCandidate.value?.id) {
      return null;
    }

    const result = await action(selectedCandidate.value.id, importCandidateFileId, actionReason.value);
    if (!result) {
      return null;
    }

    actionReason.value = '';
    await Promise.all([
      refreshApplyPreviewForSelection({ clearApplyPreview, loadApplyPreview, selectedCandidate }),
      loadImportPendingSummary(),
    ]);
    return result;
  }

  async function runSelectCandidate() {
    return runTransition(selectSelectedCandidate);
  }

  async function runHoldCandidate() {
    return runTransition(holdSelectedCandidate);
  }

  async function runRejectCandidate() {
    return runTransition(rejectSelectedCandidate);
  }

  async function runReopenCandidate() {
    return runTransition(reopenSelectedCandidate);
  }

  async function runSkipCandidateFile(importCandidateFileId) {
    await runFileDecision(skipFile, importCandidateFileId);
  }

  async function runClearCandidateFileDecision(importCandidateFileId) {
    await runFileDecision(clearFileDecision, importCandidateFileId);
  }

  function destroy() {
    destroyQueue();
  }

  watch(
    () => [
      resolvedRoute.query.candidate,
      resolvedRoute.query.folderPath,
      resolvedRoute.query.sourceSearchId,
      resolvedRoute.query.status,
      resolvedRoute.query.username,
    ],
    () => {
      void syncFromRoute({ preserveSelection: false });
    },
    { immediate: true },
  );

  return {
    actionError,
    actionReason,
    actionStatus,
    activeFilterCount,
    applyPreview,
    applyPreviewError,
    applyFilters,
    attachVisibilityListener,
    candidates,
    decisionError,
    destroy,
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
    runHoldCandidate,
    runClearCandidateFileDecision,
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
    syncFromRoute,
    isLoadingSelectedSummary,
    usernameFilter,
  };
}

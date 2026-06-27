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

import { nextTick, toValue, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useImportCandidateApplySummary } from './useImportCandidateApplySummary.js';
import { useImportCandidateExecutionSummary } from './useImportCandidateExecutionSummary.js';
import { useImportCandidateMediaInspectionSummary } from './useImportCandidateMediaInspectionSummary.js';
import {
  buildImportReviewRouteQuery,
  getImportReviewRouteStateKey,
  normalizeImportReviewRouteState,
} from '../lib/import-review-route-state.js';

export const IMPORT_REVIEW_EXECUTION_PANEL_ID = 'import-execution-run-panel';
export const IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID = 'import-media-inspection-run-panel';
export const IMPORT_REVIEW_APPLY_PANEL_ID = 'import-apply-run-panel';

function resolveRouteState(query = {}) {
  return normalizeImportReviewRouteState(query);
}

async function callMaybeAsync(fn, ...args) {
  if (typeof fn !== 'function') {
    return;
  }

  await fn(...args);
}

export function useImportReviewAdminWorkflow({
  applySummaryWorkflow = useImportCandidateApplySummary(),
  executionSummaryWorkflow = useImportCandidateExecutionSummary(),
  importPendingCandidateCount = 0,
  isAdmin = true,
  mediaInspectionSummaryWorkflow = useImportCandidateMediaInspectionSummary(),
  onPanelNavigate = null,
  refreshQueue = async () => {},
  route = null,
  router = null,
  selectedCandidateCount = 0,
} = {}) {
  const resolvedRoute = route ?? useRoute();
  const resolvedRouter = router ?? useRouter();

  function currentRouteState() {
    return resolveRouteState(resolvedRoute.query);
  }

  function buildMergedImportReviewRouteQuery(nextState) {
    const query = { ...resolvedRoute.query };
    delete query.applyRunId;
    delete query.candidate;
    delete query.candidateFile;
    delete query.executionRunId;
    delete query.mediaInspectionRunId;
    delete query.folderPath;
    delete query.sourceSearchId;
    delete query.status;
    delete query.username;

    return {
      ...query,
      ...buildImportReviewRouteQuery({
        ...currentRouteState(),
        ...nextState,
      }),
    };
  }

  async function replaceImportReviewRouteState(nextState, { hash = resolvedRoute.hash } = {}) {
    const normalizedCurrentState = currentRouteState();
    const normalizedNextState = resolveRouteState({
      ...normalizedCurrentState,
      ...nextState,
    });

    if (
      getImportReviewRouteStateKey(normalizedCurrentState) === getImportReviewRouteStateKey(normalizedNextState)
      && hash === resolvedRoute.hash
    ) {
      return;
    }

    await resolvedRouter.replace({
      hash,
      query: buildMergedImportReviewRouteQuery(normalizedNextState),
    });
  }

  async function navigateToPanel(panelId) {
    await nextTick();
    await callMaybeAsync(onPanelNavigate, panelId);
  }

  async function refreshQueueAndPreservePanel(panelId) {
    const hash = `#${panelId}`;
    await refreshQueue({ preserveSelection: true });
    await replaceImportReviewRouteState({}, { hash });
    await navigateToPanel(panelId);
  }

  async function refreshExecutionSummary() {
    await executionSummaryWorkflow.loadImportCandidateExecutionSummary({
      preferredRunId: currentRouteState().executionRunId || null,
    });
  }

  async function refreshMediaInspectionSummary() {
    await mediaInspectionSummaryWorkflow.loadImportCandidateMediaInspectionSummary({
      preferredRunId: currentRouteState().mediaInspectionRunId || null,
    });
  }

  async function refreshApplySummary() {
    await applySummaryWorkflow.loadImportCandidateApplySummary({
      preferredRunId: currentRouteState().applyRunId || null,
    });
  }

  async function handleStartExecutionRun() {
    const panelId = IMPORT_REVIEW_EXECUTION_PANEL_ID;
    await replaceImportReviewRouteState({ executionRunId: '' }, { hash: `#${panelId}` });
    await executionSummaryWorkflow.startExecutionRun();
    await refreshQueueAndPreservePanel(panelId);
  }

  async function handleReconcileExecutionState() {
    const panelId = IMPORT_REVIEW_EXECUTION_PANEL_ID;
    await replaceImportReviewRouteState({ executionRunId: '' }, { hash: `#${panelId}` });
    await executionSummaryWorkflow.reconcileExecutionState();
    await refreshQueueAndPreservePanel(panelId);
  }

  async function handleSelectExecutionRun(runId) {
    await replaceImportReviewRouteState({ executionRunId: runId }, { hash: `#${IMPORT_REVIEW_EXECUTION_PANEL_ID}` });
  }

  async function handleStartMediaInspectionRun() {
    const panelId = IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID;
    await replaceImportReviewRouteState(
      { mediaInspectionRunId: '' },
      { hash: `#${panelId}` },
    );
    await mediaInspectionSummaryWorkflow.startMediaInspectionRun();
    await refreshQueueAndPreservePanel(panelId);
  }

  async function handleSelectMediaInspectionRun(runId) {
    await replaceImportReviewRouteState(
      { mediaInspectionRunId: runId },
      { hash: `#${IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID}` },
    );
  }

  async function handleStartApplyRun() {
    const panelId = IMPORT_REVIEW_APPLY_PANEL_ID;
    await replaceImportReviewRouteState({ applyRunId: '' }, { hash: `#${panelId}` });
    await applySummaryWorkflow.startApplyRun();
    await refreshQueueAndPreservePanel(panelId);
  }

  async function handleSelectApplyRun(runId) {
    await replaceImportReviewRouteState({ applyRunId: runId }, { hash: `#${IMPORT_REVIEW_APPLY_PANEL_ID}` });
  }

  watch(
    () => [toValue(isAdmin), toValue(selectedCandidateCount)],
    ([nextIsAdmin]) => {
      if (!nextIsAdmin) {
        return;
      }

      void refreshExecutionSummary();
      void refreshMediaInspectionSummary();
    },
    { immediate: true },
  );

  watch(
    () => [toValue(isAdmin), toValue(importPendingCandidateCount)],
    ([nextIsAdmin]) => {
      if (!nextIsAdmin) {
        return;
      }

      void refreshApplySummary();
    },
    { immediate: true },
  );

  watch(
    () => [toValue(isAdmin), currentRouteState().executionRunId],
    ([nextIsAdmin, nextRunId], previousValues = []) => {
      const previousRunId = previousValues[1];

      if (!nextIsAdmin || nextRunId === previousRunId) {
        return;
      }

      if (!nextRunId) {
        if (executionSummaryWorkflow.selectedRunId?.value !== null) {
          void executionSummaryWorkflow.loadImportCandidateExecutionSummary({ preferredRunId: null });
        }
        return;
      }

      void executionSummaryWorkflow
        .loadImportCandidateExecutionSummary({ preferredRunId: nextRunId })
        .then(() => navigateToPanel(IMPORT_REVIEW_EXECUTION_PANEL_ID));
    },
    { immediate: true },
  );

  watch(
    () => [toValue(isAdmin), currentRouteState().mediaInspectionRunId],
    ([nextIsAdmin, nextRunId], previousValues = []) => {
      const previousRunId = previousValues[1];

      if (!nextIsAdmin || nextRunId === previousRunId) {
        return;
      }

      if (!nextRunId) {
        if (mediaInspectionSummaryWorkflow.selectedRunId?.value !== null) {
          void mediaInspectionSummaryWorkflow.loadImportCandidateMediaInspectionSummary({ preferredRunId: null });
        }
        return;
      }

      void mediaInspectionSummaryWorkflow
        .loadImportCandidateMediaInspectionSummary({ preferredRunId: nextRunId })
        .then(() => navigateToPanel(IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID));
    },
    { immediate: true },
  );

  watch(
    () => [toValue(isAdmin), currentRouteState().applyRunId],
    ([nextIsAdmin, nextRunId], previousValues = []) => {
      const previousRunId = previousValues[1];

      if (!nextIsAdmin || nextRunId === previousRunId) {
        return;
      }

      if (!nextRunId) {
        if (applySummaryWorkflow.selectedRunId?.value !== null) {
          void applySummaryWorkflow.loadImportCandidateApplySummary({ preferredRunId: null });
        }
        return;
      }

      void applySummaryWorkflow
        .loadImportCandidateApplySummary({ preferredRunId: nextRunId })
        .then(() => navigateToPanel(IMPORT_REVIEW_APPLY_PANEL_ID));
    },
    { immediate: true },
  );

  function destroy() {
    executionSummaryWorkflow.destroy?.();
    mediaInspectionSummaryWorkflow.destroy?.();
    applySummaryWorkflow.destroy?.();
  }

  function attachVisibilityListener() {
    executionSummaryWorkflow.attachVisibilityListener?.();
    mediaInspectionSummaryWorkflow.attachVisibilityListener?.();
    applySummaryWorkflow.attachVisibilityListener?.();
  }

  return {
    apply: {
      ...applySummaryWorkflow,
      handleRefresh: refreshApplySummary,
      handleSelectRun: handleSelectApplyRun,
      handleStartRun: handleStartApplyRun,
      panelId: IMPORT_REVIEW_APPLY_PANEL_ID,
    },
    attachVisibilityListener,
    destroy,
    execution: {
      ...executionSummaryWorkflow,
      handleRefresh: refreshExecutionSummary,
      handleReconcile: handleReconcileExecutionState,
      handleSelectRun: handleSelectExecutionRun,
      handleStartRun: handleStartExecutionRun,
      panelId: IMPORT_REVIEW_EXECUTION_PANEL_ID,
    },
    mediaInspection: {
      ...mediaInspectionSummaryWorkflow,
      handleRefresh: refreshMediaInspectionSummary,
      handleSelectRun: handleSelectMediaInspectionRun,
      handleStartRun: handleStartMediaInspectionRun,
      panelId: IMPORT_REVIEW_MEDIA_INSPECTION_PANEL_ID,
    },
    replaceImportReviewRouteState,
  };
}

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

import {
  fetchImportCandidateMediaInspectionRunDetail as defaultFetchImportCandidateMediaInspectionRunDetail,
  fetchImportCandidateMediaInspectionSummary as defaultFetchImportCandidateMediaInspectionSummary,
  startImportCandidateMediaInspectionRun as defaultStartImportCandidateMediaInspectionRun,
} from '../lib/import-candidate-api.js';
import { useImportCandidateRunSummary } from './useImportCandidateRunSummary.js';

export function useImportCandidateMediaInspectionSummary({
  fetchImportCandidateMediaInspectionRunDetail = defaultFetchImportCandidateMediaInspectionRunDetail,
  fetchImportCandidateMediaInspectionSummary = defaultFetchImportCandidateMediaInspectionSummary,
  startImportCandidateMediaInspectionRun = defaultStartImportCandidateMediaInspectionRun,
} = {}) {
  const workflow = useImportCandidateRunSummary({
    fetchRunDetail: async (runId) => (await fetchImportCandidateMediaInspectionRunDetail(runId)).importCandidateMediaInspectionRun ?? null,
    fetchSummary: fetchImportCandidateMediaInspectionSummary,
    loadErrorMessage: 'Import media inspection summary failed',
    startRun: startImportCandidateMediaInspectionRun,
    startRunErrorMessage: 'Import media inspection start failed',
    summaryKey: 'importCandidateMediaInspection',
  });

  return {
    actionErrorMessage: workflow.actionErrorMessage,
    attachVisibilityListener: workflow.attachVisibilityListener,
    currentRun: workflow.currentRun,
    destroy: workflow.destroy,
    errorMessage: workflow.errorMessage,
    isLoading: workflow.isLoading,
    isRevalidating: workflow.isRevalidating,
    isStarting: workflow.isStarting,
    loadImportCandidateMediaInspectionSummary: workflow.loadRunSummary,
    recentRuns: workflow.recentRuns,
    runDetailErrorMessage: workflow.runDetailErrorMessage,
    selectedRunId: workflow.selectedRunId,
    startMediaInspectionRun: workflow.startRunAction,
    summary: workflow.summary,
  };
}

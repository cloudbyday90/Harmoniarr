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
  fetchImportCandidateApplySummary as defaultFetchImportCandidateApplySummary,
  startImportCandidateApplyRun as defaultStartImportCandidateApplyRun,
} from '../lib/import-candidate-api.js';
import { useImportCandidateRunSummary } from './useImportCandidateRunSummary.js';

export function useImportCandidateApplySummary({
  fetchImportCandidateApplySummary = defaultFetchImportCandidateApplySummary,
  startImportCandidateApplyRun = defaultStartImportCandidateApplyRun,
} = {}) {
  const workflow = useImportCandidateRunSummary({
    fetchSummary: fetchImportCandidateApplySummary,
    loadErrorMessage: 'Import apply summary failed',
    startRun: startImportCandidateApplyRun,
    startRunErrorMessage: 'Import apply start failed',
    summaryKey: 'importCandidateApply',
  });

  return {
    actionErrorMessage: workflow.actionErrorMessage,
    activeRun: workflow.activeRun,
    applySummary: workflow.runSummary,
    currentRun: workflow.currentRun,
    errorMessage: workflow.errorMessage,
    isLoading: workflow.isLoading,
    isStarting: workflow.isStarting,
    latestRun: workflow.latestRun,
    loadImportCandidateApplySummary: workflow.loadRunSummary,
    startApplyRun: workflow.startRunAction,
    summary: workflow.summary,
  };
}
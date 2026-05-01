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
  fetchImportCandidateExecutionSummary as defaultFetchImportCandidateExecutionSummary,
  reconcileImportCandidateExecutionState as defaultReconcileImportCandidateExecutionState,
  startImportCandidateExecutionRun as defaultStartImportCandidateExecutionRun,
} from '../lib/import-candidate-api.js';
import { useImportCandidateRunSummary } from './useImportCandidateRunSummary.js';

export function useImportCandidateExecutionSummary({
  fetchImportCandidateExecutionSummary = defaultFetchImportCandidateExecutionSummary,
  reconcileImportCandidateExecutionState = defaultReconcileImportCandidateExecutionState,
  startImportCandidateExecutionRun = defaultStartImportCandidateExecutionRun,
} = {}) {
  const workflow = useImportCandidateRunSummary({
    fetchSummary: fetchImportCandidateExecutionSummary,
    loadErrorMessage: 'Import execution summary failed',
    secondaryAction: reconcileImportCandidateExecutionState,
    secondaryActionErrorMessage: 'Import execution reconciliation failed',
    startRun: startImportCandidateExecutionRun,
    startRunErrorMessage: 'Import execution start failed',
    summaryKey: 'importCandidateExecution',
  });

  return {
    actionErrorMessage: workflow.actionErrorMessage,
    activeRun: workflow.activeRun,
    currentRun: workflow.currentRun,
    errorMessage: workflow.errorMessage,
    executionSummary: workflow.runSummary,
    isLoading: workflow.isLoading,
    isReconciling: workflow.isSecondaryActionPending,
    isStarting: workflow.isStarting,
    latestRun: workflow.latestRun,
    loadImportCandidateExecutionSummary: workflow.loadRunSummary,
    reconcileExecutionState: workflow.runSecondaryAction,
    startExecutionRun: workflow.startRunAction,
    summary: workflow.summary,
  };
}
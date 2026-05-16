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

import { createImportCandidateMediaInspectionRunStore } from './import-candidate-media-inspection-run-store.js';
import { createImportCandidateRunSummaryService } from './import-candidate-run-summary-service.js';

function buildDisplayRunSummary(run) {
  if (!run) {
    return {
      message: 'No import media inspection run has been recorded yet.',
      status: 'not_started',
    };
  }

  if (run.status === 'pending' || run.status === 'running') {
    return {
      message: run.currentStep || 'Import media inspection is in progress.',
      status: 'running',
    };
  }

  if (run.status === 'failed') {
    return {
      message: run.errorMessage
        ? `The latest import media inspection run failed: ${run.errorMessage}`
        : 'The latest import media inspection run failed.',
      status: 'failed',
    };
  }

  if ((run.inspectionUnavailableCount ?? 0) > 0) {
    return {
      message: `${run.inspectionUnavailableCount} file${run.inspectionUnavailableCount === 1 ? '' : 's'} could not be inspected and need operator attention.`,
      status: 'failed',
    };
  }

  if ((run.warningCount ?? 0) > 0) {
    return {
      message: `${run.warningCount} media inspection warning${run.warningCount === 1 ? ' was' : 's were'} recorded.`,
      status: 'attention',
    };
  }

  if ((run.blockedCandidateCount ?? 0) > 0) {
    return {
      message: `${run.blockedCandidateCount} candidate${run.blockedCandidateCount === 1 ? ' was' : 's were'} blocked and skipped.`,
      status: 'blocked',
    };
  }

  return {
    message: `${run.inspectedFileCount ?? 0} file${run.inspectedFileCount === 1 ? ' was' : 's were'} inspected successfully.`,
    status: 'ready',
  };
}

export function createImportCandidateMediaInspectionSummaryService({
  importCandidateMediaInspectionRunStore = createImportCandidateMediaInspectionRunStore(),
} = {}) {
  const runSummaryService = createImportCandidateRunSummaryService({
    buildDisplayRunSummary,
    runNotFoundCode: 'import_candidate_media_inspection_run_not_found',
    runNotFoundMessage: 'Import media inspection run not found',
    runStore: importCandidateMediaInspectionRunStore,
  });

  return {
    buildImportCandidateMediaInspectionRunDetail: runSummaryService.buildRunDetail,
    buildImportCandidateMediaInspectionSummary: runSummaryService.buildRunSummary,
  };
}

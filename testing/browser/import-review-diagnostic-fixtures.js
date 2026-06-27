/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildImportReviewDiagnosticRunWorkspace } from './import-review-browser-helpers.js';

export const IMPORT_REVIEW_DIAGNOSTIC_FIXTURE = Object.freeze({
  comparisonCandidateId: 'candidate-normal',
  currentMediaInspectionRunId: 'media-inspection-run-current',
  diagnosticCandidateId: 'candidate-diagnostics',
  diagnosticFolderPath: '/private/staging/Boards of Canada/Geogaddi',
  mediaInspectionPanelHash: '#import-media-inspection-run-panel',
  primaryDiagnosticFileId: 'candidate-diagnostics-file-1',
  primaryDiagnosticFilename: 'alpha.flac',
  repairFailureMessage: 'Diagnostic repair is temporarily locked. Try again after the current import run finishes.',
  selectedMediaInspectionRunId: 'media-inspection-run-diagnostics',
  selectionStageHash: '#import-review-selection-stage',
  selectionStageId: 'import-review-selection-stage',
  secondaryDiagnosticFileId: 'candidate-diagnostics-file-2',
  secondaryDiagnosticFilename: 'beta.flac',
});

export function buildImportReviewDiagnosticFixturePack({
  includeComparisonCandidate = false,
} = {}) {
  return buildImportReviewDiagnosticRunWorkspace({
    includeComparisonCandidate,
  });
}

export function buildDiagnosticRunPanelRouteSuffix(workspace) {
  return `?mediaInspectionRunId=${workspace.run.id}${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.mediaInspectionPanelHash}`;
}

export function buildDirectDiagnosticRouteSuffix(workspace, {
  fileId = IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.primaryDiagnosticFileId,
} = {}) {
  const params = new URLSearchParams({
    candidate: workspace.diagnosticCandidate.id,
    candidateFile: fileId,
    mediaInspectionRunId: workspace.run.id,
  });

  return `?${params.toString()}${IMPORT_REVIEW_DIAGNOSTIC_FIXTURE.selectionStageHash}`;
}

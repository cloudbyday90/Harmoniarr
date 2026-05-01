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

import { createImportCandidateApplyPreviewService } from './import-candidate-apply-preview-service.js';
import { createImportCandidateApplyOperationService } from './import-candidate-apply-operation-service.js';
import { replaceImportApplyRunItems, updateImportApplyRunItem } from './import-candidate-apply-repository.js';
import { createImportCandidateApplyRunStore } from './import-candidate-apply-run-store.js';
import { createImportCandidateApplyService } from './import-candidate-apply-service.js';
import { createImportCandidateApplySummaryService } from './import-candidate-apply-summary-service.js';
import { createImportCandidateApplyWorker } from './import-candidate-apply-worker.js';
import { createImportCandidateFileDecisionService } from './import-candidate-file-decision-service.js';
import { createImportCandidateExecutionRunStore } from './import-candidate-execution-run-store.js';
import { resolveImportCandidateExecutionHeartbeatConfig } from './import-candidate-execution-heartbeat-config.js';
import { createImportCandidateExecutionHeartbeatState } from './import-candidate-execution-heartbeat-state.js';
import { createImportCandidateExecutionReconciliationService } from './import-candidate-execution-reconciliation-service.js';
import { createImportCandidateExecutionService } from './import-candidate-execution-service.js';
import { createImportCandidateExecutionSummaryService } from './import-candidate-execution-summary-service.js';
import { createImportCandidateExecutionWorker } from './import-candidate-execution-worker.js';
import { createImportCandidateImportPendingSummaryService } from './import-candidate-import-pending-summary-service.js';
import { listImportCandidateFileDecisions } from './import-candidate-file-decision-repository.js';
import { replaceImportExecutionRunItems, updateImportExecutionRunItem } from './import-candidate-execution-repository.js';
import { createImportCandidateService } from './import-candidate-service.js';
import { createImportCandidatePreviewService } from './import-candidate-preview-service.js';
import { createImportCandidateSelectionSummaryService } from './import-candidate-selection-summary-service.js';
import { createSlskdTransferSnapshotService } from '../slskd/slskd-transfer-snapshot-service.js';

export function createImportCandidateModule({
  slskdService,
  importCandidateService = createImportCandidateService({ slskdService }),
  importCandidatePreviewService = createImportCandidatePreviewService({
    getImportCandidate: importCandidateService.getImportCandidate,
  }),
  importCandidateApplyPreviewService = createImportCandidateApplyPreviewService({
    listImportCandidateFileDecisions,
    previewImportCandidate: importCandidatePreviewService.previewImportCandidate,
  }),
  importCandidateApplyOperationService = createImportCandidateApplyOperationService(),
  importCandidateSelectionSummaryService = createImportCandidateSelectionSummaryService({
    listImportCandidates: importCandidateService.listImportCandidates,
    previewImportCandidate: importCandidatePreviewService.previewImportCandidate,
  }),
  importCandidateImportPendingSummaryService = createImportCandidateImportPendingSummaryService({
    listImportCandidates: importCandidateService.listImportCandidates,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
  }),
  importCandidateExecutionHeartbeatConfig = resolveImportCandidateExecutionHeartbeatConfig(),
  importCandidateExecutionHeartbeatState = createImportCandidateExecutionHeartbeatState(),
  slskdTransferSnapshotService = createSlskdTransferSnapshotService({
    getDownloads: slskdService.getDownloads,
  }),
  importCandidateExecutionRunStore = createImportCandidateExecutionRunStore(),
  importCandidateApplyRunStore = createImportCandidateApplyRunStore(),
  importCandidateFileDecisionService = createImportCandidateFileDecisionService({
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
  }),
  importCandidateExecutionWorker = createImportCandidateExecutionWorker({
    acquireLease: importCandidateExecutionRunStore.acquireLease,
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    enqueueDownloads: slskdService.enqueueDownloads,
    getImportCandidate: importCandidateService.getImportCandidate,
    markImportCandidateDownloadFailed: importCandidateService.markImportCandidateDownloadFailed,
    markImportCandidateDownloading: importCandidateService.markImportCandidateDownloading,
    markRunCompleted: importCandidateExecutionRunStore.markRunCompleted,
    markRunFailed: importCandidateExecutionRunStore.markRunFailed,
    markRunStarted: importCandidateExecutionRunStore.markRunStarted,
    releaseLease: importCandidateExecutionRunStore.releaseLease,
    replaceImportExecutionRunItems,
    updateImportExecutionRunItem,
  }),
  importCandidateApplyWorker = createImportCandidateApplyWorker({
    acquireLease: importCandidateApplyRunStore.acquireLease,
    applyImportCandidatePreview: importCandidateApplyOperationService.applyImportCandidatePreview,
    buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
    markImportCandidateApplied: importCandidateService.markImportCandidateApplied,
    markRunCompleted: importCandidateApplyRunStore.markRunCompleted,
    markRunFailed: importCandidateApplyRunStore.markRunFailed,
    markRunStarted: importCandidateApplyRunStore.markRunStarted,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
    releaseLease: importCandidateApplyRunStore.releaseLease,
    replaceImportApplyRunItems,
    updateImportApplyRunItem,
  }),
  importCandidateExecutionService = createImportCandidateExecutionService({
    createOperationRun: importCandidateExecutionRunStore.createOperationRun,
    getActiveRun: importCandidateExecutionRunStore.getActiveRun,
    listImportCandidates: importCandidateService.listImportCandidates,
    startWorkerRun: importCandidateExecutionWorker.startWorkerRun,
  }),
  importCandidateApplyService = createImportCandidateApplyService({
    buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
    createOperationRun: importCandidateApplyRunStore.createOperationRun,
    getActiveRun: importCandidateApplyRunStore.getActiveRun,
    startWorkerRun: importCandidateApplyWorker.startWorkerRun,
  }),
  importCandidateExecutionSummaryService = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: slskdTransferSnapshotService.buildTransferSnapshot,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionRunStore,
  }),
  importCandidateApplySummaryService = createImportCandidateApplySummaryService({
    importCandidateApplyRunStore,
  }),
  importCandidateExecutionReconciliationService = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
    getImportCandidate: importCandidateService.getImportCandidate,
    markImportCandidateDownloadFailed: importCandidateService.markImportCandidateDownloadFailed,
    markImportCandidateDownloading: importCandidateService.markImportCandidateDownloading,
    markImportCandidateImportPending: importCandidateService.markImportCandidateImportPending,
    updateImportExecutionRunItem,
  }),
} = {}) {
  return {
    importCandidateApplyOperationService,
    importCandidateApplyRunStore,
    importCandidateApplyService,
    importCandidateApplySummaryService,
    importCandidateApplyWorker,
    importCandidateFileDecisionService,
    importCandidateExecutionReconciliationService,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionRunStore,
    importCandidateExecutionService,
    importCandidateExecutionSummaryService,
    importCandidateExecutionWorker,
    importCandidateImportPendingSummaryService,
    importCandidateApplyPreviewService,
    importCandidatePreviewService,
    importCandidateSelectionSummaryService,
    importCandidateService,
    routeDependencies: {
      buildImportCandidateApplySummary: importCandidateApplySummaryService.buildImportCandidateApplySummary,
      buildImportCandidateExecutionSummary: importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
      buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
      buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
      getImportCandidate: importCandidateService.getImportCandidate,
      holdImportCandidate: importCandidateService.holdImportCandidate,
      ingestSlskdSearchResponses: importCandidateService.ingestSlskdSearchResponses,
      listImportCandidates: importCandidateService.listImportCandidates,
      clearImportCandidateFileDecision: importCandidateFileDecisionService.clearImportCandidateFileDecision,
      previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
      previewImportCandidate: importCandidatePreviewService.previewImportCandidate,
      reconcileImportCandidateExecutionState: importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionState,
      rejectImportCandidate: importCandidateService.rejectImportCandidate,
      reopenImportCandidate: importCandidateService.reopenImportCandidate,
      setImportCandidateFileSkipDecision: importCandidateFileDecisionService.setImportCandidateFileSkipDecision,
      startImportCandidateApplyRun: importCandidateApplyService.startImportCandidateApplyRun,
      selectImportCandidate: importCandidateService.selectImportCandidate,
      startImportCandidateExecutionRun: importCandidateExecutionService.startImportCandidateExecutionRun,
    },
    slskdService,
  };
}

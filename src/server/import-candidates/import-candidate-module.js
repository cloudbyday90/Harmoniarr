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
import { createImportCandidatePostApplyScanService } from './import-candidate-post-apply-scan-service.js';
import { createImportCandidateBulkReviewService } from './import-candidate-bulk-review-service.js';
import { replaceImportApplyRunItems, updateImportApplyRunItem } from './import-candidate-apply-repository.js';
import { createImportCandidateApplyRunStore } from './import-candidate-apply-run-store.js';
import { createImportCandidateApplyService } from './import-candidate-apply-service.js';
import { createImportCandidateApplySummaryService } from './import-candidate-apply-summary-service.js';
import { createImportCandidateApplyWorker } from './import-candidate-apply-worker.js';
import { createImportCandidateReleaseHintService } from './import-candidate-release-hint-service.js';
import { createImportCandidateMediaInspectionRunStore } from './import-candidate-media-inspection-run-store.js';
import { createImportCandidateMediaInspectionService } from './import-candidate-media-inspection-service.js';
import { createImportCandidateMediaInspectionSummaryService } from './import-candidate-media-inspection-summary-service.js';
import { createImportCandidateMediaInspectionWorker } from './import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeRunStore } from './import-candidate-transcode-run-store.js';
import { createImportCandidateTranscodeService } from './import-candidate-transcode-service.js';
import { createImportCandidateTranscodeWorker } from './import-candidate-transcode-worker.js';
import { createImportCandidateFileDecisionService } from './import-candidate-file-decision-service.js';
import { createImportCandidateExecutionRunStore } from './import-candidate-execution-run-store.js';
import { resolveImportCandidateExecutionHeartbeatConfig } from './import-candidate-execution-heartbeat-config.js';
import { createImportCandidateExecutionHeartbeatState } from './import-candidate-execution-heartbeat-state.js';
import { createImportCandidateExecutionReconciliationService } from './import-candidate-execution-reconciliation-service.js';
import { createImportCandidateRecoveryService } from './import-candidate-recovery-service.js';
import { createImportCandidateExecutionService } from './import-candidate-execution-service.js';
import { createImportCandidateExecutionSummaryService } from './import-candidate-execution-summary-service.js';
import { createImportCandidateExecutionWorker } from './import-candidate-execution-worker.js';
import { createImportCandidateImportPendingSummaryService } from './import-candidate-import-pending-summary-service.js';
import { listImportCandidateFileDecisions } from './import-candidate-file-decision-repository.js';
import { replaceImportExecutionRunItems, updateImportExecutionRunItem, upsertImportExecutionRunItem } from './import-candidate-execution-repository.js';
import { createImportCandidateReputationEnrichmentService } from './import-candidate-reputation-enrichment-service.js';
import { createImportCandidateService, normalizeSlskdResponsesToImportCandidates } from './import-candidate-service.js';
import { createImportCandidatePreviewService } from './import-candidate-preview-service.js';
import { createImportCandidateSelectionSummaryService } from './import-candidate-selection-summary-service.js';
import { createCandidateBrowseEnrichmentService } from '../library/candidate-browse-enrichment-service.js';
import { createSlskdBrowseCacheStore } from '../slskd/slskd-browse-cache-store.js';
import { createMediaInspectionService } from '../media/media-inspection-service.js';
import { createMediaLosslessRetentionPolicyService } from '../media/media-lossless-retention-policy-service.js';
import { createMediaTranscodeExecutionService } from '../media/media-transcode-execution-service.js';
import { createMediaTranscodePlanningService } from '../media/media-transcode-planning-service.js';
import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';
import { createMaintenanceLockService } from '../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../recovery/maintenance-lock-write-guard-service.js';
import { createSlskdTransferSnapshotService } from '../slskd/slskd-transfer-snapshot-service.js';

export function createImportCandidateModule({
  getMediaToolingStatus = async () => ({
    details: {
      ffmpegAvailable: true,
      ffprobeAvailable: true,
    },
    status: 'healthy',
  }),
  getAppUserById = null,
  listSourceUserReputationIndexFn = async () => new Map(),
  onDownloadCompletedFn = null,
  onReleaseAddedFn = null,
  recordActivityEventFn = null,
  recordSourceUserOutcomeEvidenceFn = async () => null,
  scheduleLibraryScan = null,
  queueDeferredLibraryScan = null,
  scheduleDownloadRecoveryRediscovery = null,
  postApplyScanService = createImportCandidatePostApplyScanService({
    queueDeferredLibraryScan,
    startLibraryScan: scheduleLibraryScan,
  }),
  sendFulfillmentNotificationFn = null,
  slskdService,
  mediaInspectionService = createMediaInspectionService({
    getMediaToolingStatus,
  }),
  mediaTranscodeExecutionService = createMediaTranscodeExecutionService({
    getMediaToolingStatus,
  }),
  mediaLosslessRetentionPolicyService = createMediaLosslessRetentionPolicyService(),
  mediaTranscodePlanningService = createMediaTranscodePlanningService(),
  importCandidateReputationEnrichmentService = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn,
  }),
  browseEnrichmentService = typeof slskdService?.browseUserDirectory === 'function'
    ? createCandidateBrowseEnrichmentService({
      browseUserDirectoryFn: slskdService.browseUserDirectory,
      normalizeSlskdResponsesFn: normalizeSlskdResponsesToImportCandidates,
      browseCacheStore: createSlskdBrowseCacheStore(),
    })
    : null,
  importCandidateService = createImportCandidateService({
    listSourceUserReputationIndexFn,
    recordSourceUserOutcomeEvidenceFn,
    slskdService,
    browseEnrichmentService,
  }),
  importCandidatePreviewService = createImportCandidatePreviewService({
    getImportCandidate: importCandidateService.getImportCandidate,
    getAppUserById,
  }),
  importCandidateApplyPreviewService = createImportCandidateApplyPreviewService({
    listImportCandidateFileDecisions,
    mediaInspectionService,
    mediaLosslessRetentionPolicyService,
    mediaTranscodePlanningService,
    previewImportCandidate: importCandidatePreviewService.previewImportCandidate,
  }),
  importCandidateApplyOperationService = createImportCandidateApplyOperationService({
    mediaTranscodeExecutionService,
  }),
  importCandidateReleaseHintService = createImportCandidateReleaseHintService(),
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
  maintenanceLockService = createMaintenanceLockService(),
  maintenanceLockOperationPauseService = null,
  maintenanceLockWriteGuardService = createMaintenanceLockWriteGuardService({
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
  }),
  slskdTransferSnapshotService = createSlskdTransferSnapshotService({
    getDownloads: slskdService.getDownloads,
  }),
  importCandidateMediaInspectionRunStore = createImportCandidateMediaInspectionRunStore(),
  importCandidateTranscodeRunStore = createImportCandidateTranscodeRunStore(),
  importCandidateExecutionRunStore = createImportCandidateExecutionRunStore(),
  importCandidateApplyRunStore = createImportCandidateApplyRunStore(),
  importCandidateRecoveryService = createImportCandidateRecoveryService({
    createRecoveryExecutionRun: importCandidateExecutionRunStore.createOperationRun,
    getImportCandidate: importCandidateService.getImportCandidate,
    markImportCandidateDownloadFailed: importCandidateService.markImportCandidateDownloadFailed,
    retryImportCandidateDownload: importCandidateService.retryImportCandidateDownload,
    scheduleDownloadRecoveryRediscovery,
  }),
  importCandidateFileDecisionService = createImportCandidateFileDecisionService({
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
  }),
  importCandidateExecutionWorker = createImportCandidateExecutionWorker({
    acquireLease: importCandidateExecutionRunStore.acquireLease,
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    enqueueDownloads: slskdService.enqueueDownloads,
    getImportCandidate: importCandidateService.getImportCandidate,
    handleImportCandidateDownloadFailure: importCandidateRecoveryService.handleImportCandidateDownloadFailure,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: importCandidateExecutionRunStore.isCancellationRequested,
        operationLabel: 'Import execution',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : importCandidateExecutionRunStore.isCancellationRequested,
    markImportCandidateDownloadFailed: importCandidateService.markImportCandidateDownloadFailed,
    markImportCandidateDownloading: importCandidateService.markImportCandidateDownloading,
    markRunCancelled: importCandidateExecutionRunStore.markRunCancelled,
    markRunCompleted: importCandidateExecutionRunStore.markRunCompleted,
    markRunFailed: importCandidateExecutionRunStore.markRunFailed,
    markRunPaused: importCandidateExecutionRunStore.markRunPaused,
    markRunStarted: importCandidateExecutionRunStore.markRunStarted,
    releaseLease: importCandidateExecutionRunStore.releaseLease,
    renewLease: importCandidateExecutionRunStore.renewLease,
    replaceImportExecutionRunItems,
    updateImportExecutionRunItem,
    upsertImportExecutionRunItem,
  }),
  importCandidateApplyWorker = createImportCandidateApplyWorker({
    acquireLease: importCandidateApplyRunStore.acquireLease,
    applyImportCandidatePreview: importCandidateApplyOperationService.applyImportCandidatePreview,
    buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
    buildPostApplyReleaseHints: importCandidateReleaseHintService.buildPostApplyReleaseHints,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: importCandidateApplyRunStore.isCancellationRequested,
        operationLabel: 'Import apply',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : importCandidateApplyRunStore.isCancellationRequested,
    markImportCandidateApplied: importCandidateService.markImportCandidateApplied,
    markRunCancelled: importCandidateApplyRunStore.markRunCancelled,
    markRunCompleted: importCandidateApplyRunStore.markRunCompleted,
    markRunFailed: importCandidateApplyRunStore.markRunFailed,
    markRunPaused: importCandidateApplyRunStore.markRunPaused,
    markRunStarted: importCandidateApplyRunStore.markRunStarted,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
    releaseLease: importCandidateApplyRunStore.releaseLease,
    renewLease: importCandidateApplyRunStore.renewLease,
    replaceImportApplyRunItems,
    scheduleLibraryScan: postApplyScanService.schedulePostApplyLibraryScan,
    sendFulfillmentNotificationFn,
    onReleaseAddedFn,
    recordActivityEventFn,
    updateImportApplyRunItem,
  }),
  importCandidateMediaInspectionWorker = createImportCandidateMediaInspectionWorker({
    acquireLease: importCandidateMediaInspectionRunStore.acquireLease,
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: importCandidateMediaInspectionRunStore.isCancellationRequested,
        operationLabel: 'Media inspection',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : importCandidateMediaInspectionRunStore.isCancellationRequested,
    markRunCancelled: importCandidateMediaInspectionRunStore.markRunCancelled,
    markRunCompleted: importCandidateMediaInspectionRunStore.markRunCompleted,
    markRunFailed: importCandidateMediaInspectionRunStore.markRunFailed,
    markRunPaused: importCandidateMediaInspectionRunStore.markRunPaused,
    markRunStarted: importCandidateMediaInspectionRunStore.markRunStarted,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
    releaseLease: importCandidateMediaInspectionRunStore.releaseLease,
    renewLease: importCandidateMediaInspectionRunStore.renewLease,
  }),
  importCandidateTranscodeWorker = createImportCandidateTranscodeWorker({
    acquireLease: importCandidateTranscodeRunStore.acquireLease,
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    executeTranscodeCandidate: mediaTranscodeExecutionService.executeCandidate,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: importCandidateTranscodeRunStore.isCancellationRequested,
        operationLabel: 'Transcode orchestration',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : importCandidateTranscodeRunStore.isCancellationRequested,
    markRunCancelled: importCandidateTranscodeRunStore.markRunCancelled,
    markRunCompleted: importCandidateTranscodeRunStore.markRunCompleted,
    markRunFailed: importCandidateTranscodeRunStore.markRunFailed,
    markRunPaused: importCandidateTranscodeRunStore.markRunPaused,
    markRunStarted: importCandidateTranscodeRunStore.markRunStarted,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
    releaseLease: importCandidateTranscodeRunStore.releaseLease,
    renewLease: importCandidateTranscodeRunStore.renewLease,
  }),
  importCandidateExecutionService = createImportCandidateExecutionService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'import candidate execution planning',
    }),
    createOperationRun: importCandidateExecutionRunStore.createOperationRun,
    getActiveRun: importCandidateExecutionRunStore.getActiveRun,
    listImportCandidates: importCandidateService.listImportCandidates,
  }),
  importCandidateApplyService = createImportCandidateApplyService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'import candidate apply',
    }),
    buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
    createOperationRun: importCandidateApplyRunStore.createOperationRun,
    getActiveRun: importCandidateApplyRunStore.getActiveRun,
  }),
  importCandidateMediaInspectionService = createImportCandidateMediaInspectionService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'import candidate media inspection',
    }),
    createOperationRun: importCandidateMediaInspectionRunStore.createOperationRun,
    getActiveRun: importCandidateMediaInspectionRunStore.getActiveRun,
    listImportCandidates: importCandidateService.listImportCandidates,
  }),
  importCandidateTranscodeService = createImportCandidateTranscodeService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'import candidate transcode orchestration',
    }),
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    createOperationRun: importCandidateTranscodeRunStore.createOperationRun,
    getActiveRun: importCandidateTranscodeRunStore.getActiveRun,
    previewImportCandidateApply: importCandidateApplyPreviewService.previewImportCandidateApply,
  }),
  importCandidateExecutionSummaryService = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: slskdTransferSnapshotService.buildTransferSnapshot,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionRunStore,
  }),
  importCandidateMediaInspectionSummaryService = createImportCandidateMediaInspectionSummaryService({
    importCandidateMediaInspectionRunStore,
  }),
  importCandidateApplySummaryService = createImportCandidateApplySummaryService({
    importCandidateApplyRunStore,
  }),
  importCandidateExecutionReconciliationService = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
    getImportCandidate: importCandidateService.getImportCandidate,
    handleImportCandidateDownloadFailure: importCandidateRecoveryService.handleImportCandidateDownloadFailure,
    handleImportCandidateRejectedTransfer: importCandidateRecoveryService.handleImportCandidateRejectedTransfer,
    markImportCandidateDownloadFailed: importCandidateService.markImportCandidateDownloadFailed,
    markImportCandidateDownloading: importCandidateService.markImportCandidateDownloading,
    markImportCandidateImportPending: importCandidateService.markImportCandidateImportPending,
    onDownloadCompletedFn,
    recordActivityEventFn,
    updateImportExecutionRunItem,
  }),
  importCandidateBulkReviewService = createImportCandidateBulkReviewService({
    holdImportCandidate: importCandidateService.holdImportCandidate,
    rejectImportCandidate: importCandidateService.rejectImportCandidate,
    reopenImportCandidate: importCandidateService.reopenImportCandidate,
    selectImportCandidate: importCandidateService.selectImportCandidate,
  }),
} = {}) {
  return {
    importCandidateApplyOperationService,
    importCandidateMediaInspectionRunStore,
    importCandidateMediaInspectionService,
    importCandidateMediaInspectionSummaryService,
    importCandidateMediaInspectionWorker,
    importCandidateTranscodeRunStore,
    importCandidateTranscodeService,
    importCandidateTranscodeWorker,
    importCandidateApplyRunStore,
    importCandidateApplyService,
    importCandidateApplySummaryService,
    importCandidateApplyWorker,
    importCandidateReleaseHintService,
    importCandidateBulkReviewService,
    importCandidateFileDecisionService,
    importCandidateExecutionReconciliationService,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionRunStore,
    importCandidateExecutionService,
    importCandidateExecutionSummaryService,
    importCandidateExecutionWorker,
    importCandidateRecoveryService,
    importCandidateImportPendingSummaryService,
    importCandidateApplyPreviewService,
    importCandidatePreviewService,
    postApplyScanService,
    importCandidateReputationEnrichmentService,
    importCandidateSelectionSummaryService,
    importCandidateService,
    routeDependencies: {
      buildImportCandidateApplyRunDetail: importCandidateApplySummaryService.buildImportCandidateApplyRunDetail,
      buildImportCandidateApplySummary: importCandidateApplySummaryService.buildImportCandidateApplySummary,
      buildImportCandidateExecutionRunDetail: importCandidateExecutionSummaryService.buildImportCandidateExecutionRunDetail,
      buildImportCandidateExecutionSummary: importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
      buildImportCandidateMediaInspectionRunDetail: importCandidateMediaInspectionSummaryService.buildImportCandidateMediaInspectionRunDetail,
      buildImportCandidateMediaInspectionSummary: importCandidateMediaInspectionSummaryService.buildImportCandidateMediaInspectionSummary,
      buildCandidateReputationSummary: importCandidateReputationEnrichmentService.buildCandidateReputationSummary,
      buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
      buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
      bulkReviewImportCandidates: importCandidateBulkReviewService.bulkReviewImportCandidates,
      enrichCandidatesWithUploaderReputation: importCandidateReputationEnrichmentService.enrichCandidatesWithUploaderReputation,
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
      setImportCandidateFileAllowLossyDerivativeDecision: importCandidateFileDecisionService.setImportCandidateFileAllowLossyDerivativeDecision,
      setImportCandidateFileSkipDecision: importCandidateFileDecisionService.setImportCandidateFileSkipDecision,
      startImportCandidateApplyRun: importCandidateApplyService.startImportCandidateApplyRun,
      startImportCandidateMediaInspectionRun: importCandidateMediaInspectionService.startImportCandidateMediaInspectionRun,
      startImportCandidateTranscodeRun: importCandidateTranscodeService.startImportCandidateTranscodeRun,
      selectImportCandidate: importCandidateService.selectImportCandidate,
      startImportCandidateExecutionRun: importCandidateExecutionService.startImportCandidateExecutionRun,
    },
    slskdService,
  };
}

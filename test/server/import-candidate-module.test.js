import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';

test('createImportCandidateModule exposes shared import candidate route dependencies', () => {
  const slskdService = {
    getDownload: () => {},
    getSearchResponses: () => {},
  };
  const importCandidateApplyOperationService = {
    applyImportCandidatePreview: () => {},
  };
  const importCandidateApplyRunStore = {};
  const importCandidateApplyService = {
    startImportCandidateApplyRun: () => {},
  };
  const importCandidateApplySummaryService = {
    buildImportCandidateApplyRunDetail: () => {},
    buildImportCandidateApplySummary: () => {},
  };
  const importCandidateApplyWorker = {};
  const importCandidateMediaInspectionRunStore = {};
  const importCandidateMediaInspectionService = {
    startImportCandidateMediaInspectionRun: () => {},
  };
  const importCandidateMediaInspectionSummaryService = {
    buildImportCandidateMediaInspectionRunDetail: () => {},
    buildImportCandidateMediaInspectionSummary: () => {},
  };
  const importCandidateMediaInspectionWorker = {};
  const importCandidateTranscodeRunStore = {};
  const importCandidateTranscodeService = {
    startImportCandidateTranscodeRun: () => {},
  };
  const importCandidateTranscodeWorker = {};
  const importCandidateFileDecisionService = {
    clearImportCandidateFileDecision: () => {},
    setImportCandidateFileAllowLossyDerivativeDecision: () => {},
    setImportCandidateFileSkipDecision: () => {},
  };
  const importCandidateExecutionService = {
    startImportCandidateExecutionRun: () => {},
  };
  const importCandidateExecutionHeartbeatConfig = {
    intervalLabel: '1 minute',
    intervalMs: 60000,
    mode: 'automatic',
    source: 'default',
  };
  const importCandidateExecutionHeartbeatState = {
    getHeartbeatState: () => ({}),
  };
  const importCandidateExecutionReconciliationService = {
    reconcileImportCandidateExecutionState: () => {},
  };
  const importCandidateExecutionSummaryService = {
    buildImportCandidateExecutionRunDetail: () => {},
    buildImportCandidateExecutionSummary: () => {},
  };
  const importCandidateApplyPreviewService = {
    previewImportCandidateApply: () => {},
  };
  const importCandidateAutoDownloadRunService = {
    startDownloadRunAfterAutoSelection: () => {},
  };
  const importCandidateAutoSelectionService = {
    selectHighConfidenceCandidate: () => {},
  };
  const importCandidateImportPendingSummaryService = {
    buildImportPendingCandidateSummary: () => {},
  };
  const importCandidateExecutionRunStore = {};
  const importCandidateExecutionWorker = {};
  const importCandidateService = {
    getImportCandidate: () => {},
    holdImportCandidate: () => {},
    ingestSlskdSearchResponses: () => {},
    listImportCandidates: () => {},
    markImportCandidateApplied: () => {},
    rejectImportCandidate: () => {},
    reopenImportCandidate: () => {},
    selectImportCandidate: () => {},
  };
  const importCandidatePreviewService = {
    previewImportCandidate: () => {},
  };
  const importCandidateSelectionSummaryService = {
    buildSelectedImportCandidateSummary: () => {},
  };

  const importCandidateModule = createImportCandidateModule({
    importCandidateApplyOperationService,
    importCandidateApplyRunStore,
    importCandidateApplyService,
    importCandidateApplySummaryService,
    importCandidateApplyWorker,
    importCandidateMediaInspectionRunStore,
    importCandidateMediaInspectionService,
    importCandidateMediaInspectionSummaryService,
    importCandidateMediaInspectionWorker,
    importCandidateTranscodeRunStore,
    importCandidateTranscodeService,
    importCandidateTranscodeWorker,
    importCandidateFileDecisionService,
    importCandidateExecutionRunStore,
    importCandidateExecutionReconciliationService,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionService,
    importCandidateExecutionSummaryService,
    importCandidateExecutionWorker,
    importCandidateApplyPreviewService,
    importCandidateAutoDownloadRunService,
    importCandidateAutoSelectionService,
    importCandidateImportPendingSummaryService,
    importCandidatePreviewService,
    importCandidateSelectionSummaryService,
    importCandidateService,
    slskdService,
  });

  assert.equal(importCandidateModule.importCandidateApplyOperationService, importCandidateApplyOperationService);
  assert.equal(importCandidateModule.importCandidateApplyRunStore, importCandidateApplyRunStore);
  assert.equal(importCandidateModule.importCandidateApplyService, importCandidateApplyService);
  assert.equal(importCandidateModule.importCandidateApplySummaryService, importCandidateApplySummaryService);
  assert.equal(importCandidateModule.importCandidateApplyWorker, importCandidateApplyWorker);
  assert.equal(importCandidateModule.importCandidateMediaInspectionRunStore, importCandidateMediaInspectionRunStore);
  assert.equal(importCandidateModule.importCandidateMediaInspectionService, importCandidateMediaInspectionService);
  assert.equal(importCandidateModule.importCandidateMediaInspectionSummaryService, importCandidateMediaInspectionSummaryService);
  assert.equal(importCandidateModule.importCandidateMediaInspectionWorker, importCandidateMediaInspectionWorker);
  assert.equal(importCandidateModule.importCandidateTranscodeRunStore, importCandidateTranscodeRunStore);
  assert.equal(importCandidateModule.importCandidateTranscodeService, importCandidateTranscodeService);
  assert.equal(importCandidateModule.importCandidateTranscodeWorker, importCandidateTranscodeWorker);
  assert.equal(importCandidateModule.importCandidateFileDecisionService, importCandidateFileDecisionService);
  assert.equal(importCandidateModule.importCandidateExecutionRunStore, importCandidateExecutionRunStore);
  assert.equal(importCandidateModule.importCandidateExecutionReconciliationService, importCandidateExecutionReconciliationService);
  assert.equal(importCandidateModule.importCandidateExecutionHeartbeatConfig, importCandidateExecutionHeartbeatConfig);
  assert.equal(importCandidateModule.importCandidateExecutionHeartbeatState, importCandidateExecutionHeartbeatState);
  assert.equal(importCandidateModule.importCandidateExecutionService, importCandidateExecutionService);
  assert.equal(importCandidateModule.importCandidateExecutionSummaryService, importCandidateExecutionSummaryService);
  assert.equal(importCandidateModule.importCandidateExecutionWorker, importCandidateExecutionWorker);
  assert.equal(importCandidateModule.importCandidateApplyPreviewService, importCandidateApplyPreviewService);
  assert.equal(importCandidateModule.importCandidateAutoDownloadRunService, importCandidateAutoDownloadRunService);
  assert.equal(importCandidateModule.importCandidateAutoSelectionService, importCandidateAutoSelectionService);
  assert.equal(importCandidateModule.importCandidateImportPendingSummaryService, importCandidateImportPendingSummaryService);
  assert.equal(importCandidateModule.importCandidateService, importCandidateService);
  assert.equal(importCandidateModule.importCandidatePreviewService, importCandidatePreviewService);
  assert.equal(importCandidateModule.importCandidateSelectionSummaryService, importCandidateSelectionSummaryService);
  assert.equal(importCandidateModule.slskdService, slskdService);
  assert.deepEqual(importCandidateModule.routeDependencies, {
    buildImportCandidateApplyRunDetail: importCandidateApplySummaryService.buildImportCandidateApplyRunDetail,
    buildImportCandidateApplySummary: importCandidateApplySummaryService.buildImportCandidateApplySummary,
    buildImportCandidateExecutionRunDetail: importCandidateExecutionSummaryService.buildImportCandidateExecutionRunDetail,
    buildImportCandidateExecutionSummary: importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
    buildImportCandidateMediaInspectionRunDetail: importCandidateMediaInspectionSummaryService.buildImportCandidateMediaInspectionRunDetail,
    buildImportCandidateMediaInspectionSummary: importCandidateMediaInspectionSummaryService.buildImportCandidateMediaInspectionSummary,
    buildCandidateReputationSummary: importCandidateModule.importCandidateReputationEnrichmentService.buildCandidateReputationSummary,
    buildImportPendingCandidateSummary: importCandidateImportPendingSummaryService.buildImportPendingCandidateSummary,
    buildSelectedImportCandidateSummary: importCandidateSelectionSummaryService.buildSelectedImportCandidateSummary,
    bulkReviewImportCandidates: importCandidateModule.importCandidateBulkReviewService.bulkReviewImportCandidates,
    enrichCandidatesWithUploaderReputation: importCandidateModule.importCandidateReputationEnrichmentService.enrichCandidatesWithUploaderReputation,
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
  });
});

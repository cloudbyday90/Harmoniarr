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

import { createLibraryScanSummaryService } from '../library-scan-summary-service.js';
import { createSettingsService } from '../settings-service.js';
import { createProviderClientResolverService } from '../integrations/providers/provider-client-resolver-service.js';
import { createLibraryCatalogStore } from './library-catalog-store.js';
import { createLibraryExternalIntakeRunStore } from './library-external-intake-run-store.js';
import { createLibraryExternalIntakeService } from './library-external-intake-service.js';
import { createLibraryExternalIntakeWorker } from './library-external-intake-worker.js';
import { createLibraryProviderIngestExecutionRunStore } from './library-provider-ingest-execution-run-store.js';
import { createLibraryProviderIngestExecutionService } from './library-provider-ingest-execution-service.js';
import { createLibraryProviderIngestExecutionWorker } from './library-provider-ingest-execution-worker.js';
import { createLibraryProviderIngestPlanningService } from './library-provider-ingest-planning-service.js';
import { createLibraryProviderIngestRequestStore } from './library-provider-ingest-request-store.js';
import { createLibraryDiscoveryRequestService } from './library-discovery-request-service.js';
import { createLibraryDiscoveryRequestStore } from './library-discovery-request-store.js';
import { createLibraryDiscoveryDispatchService } from './library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRunService } from './library-discovery-run-service.js';
import { createLibraryDiscoveryRunStore } from './library-discovery-run-store.js';
import { createLibraryDiscoverySummaryService } from './library-discovery-summary-service.js';
import { createLibraryDiscoverySummaryStore } from './library-discovery-summary-store.js';
import { createLibraryDiscoveryHeartbeatState } from './library-discovery-heartbeat-state.js';
import { createLibraryDiscoveryWorker } from './library-discovery-worker.js';
import { createLibraryEmbeddedArtworkService } from './library-embedded-artwork-service.js';
import { createLibraryFileMatcherService } from './library-file-matcher-service.js';
import { createLibraryFileMatchStore } from './library-file-match-store.js';
import { createLibraryMediaRequestFulfillmentService } from './library-media-request-fulfillment-service.js';
import { createLibraryMediaRequestNotificationService } from './library-media-request-notification-service.js';
import { createLibraryMediaRequestService } from './library-media-request-service.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';
import { createLibraryOrganizeApplyRunStore } from './library-organize-apply-run-store.js';
import { createLibraryOrganizeApplyService } from './library-organize-apply-service.js';
import { createLibraryOrganizeApplyWorker } from './library-organize-apply-worker.js';
import { createLibraryOrganizePreviewService } from './library-organize-preview-service.js';
import { createLibraryOrganizePreviewStore } from './library-organize-preview-store.js';
import { createLibraryReleaseAvailabilityStore } from './library-release-availability-store.js';
import { createLibraryReconciliationSummaryService } from './library-reconciliation-summary-service.js';
import { createLibraryReconciliationSummaryStore } from './library-reconciliation-summary-store.js';
import { createLibraryReleaseReconciliationService } from './library-release-reconciliation-service.js';
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';
import { createLibraryScanRunStore } from './library-scan-run-store.js';
import { createLibraryScanService } from './library-scan-service.js';
import { createLibrarySidecarArtworkService } from './library-sidecar-artwork-service.js';
import { createLibraryTagExtractionService } from './library-tag-extraction-service.js';
import { createLibraryTagSnapshotStore } from './library-tag-snapshot-store.js';
import { createLibraryWantedReleaseService } from './library-wanted-release-service.js';
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';
import { createLibraryWantedSummaryService } from './library-wanted-summary-service.js';
import { createLibraryWantedSummaryStore } from './library-wanted-summary-store.js';
import { createLibraryScanWorker } from './library-scan-worker.js';
import { createMediaFilesystemService } from '../media/media-filesystem-service.js';
import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';
import { createMaintenanceLockService } from '../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../recovery/maintenance-lock-write-guard-service.js';

export function createLibraryModule({
  artworkAssignmentService = null,
  artworkIngestionService = null,
  getAppUserById = null,
  importCandidateService = null,
  settingsService = createSettingsService(),
  slskdService = null,
  libraryCatalogStore = createLibraryCatalogStore(),
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
  libraryDiscoveryRequestService = createLibraryDiscoveryRequestService({
    libraryDiscoveryRequestStore,
  }),
  libraryDiscoveryDispatchService = createLibraryDiscoveryDispatchService({
    importCandidateService,
    libraryDiscoveryRequestStore,
    slskdService,
  }),
  libraryReleaseAvailabilityStore = createLibraryReleaseAvailabilityStore(),
  libraryMediaRequestStore = createLibraryMediaRequestStore(),
  libraryMediaRequestFulfillmentService = createLibraryMediaRequestFulfillmentService({
    listImportCandidatesBySourceMediaRequestIds: importCandidateService?.listImportCandidatesBySourceMediaRequestIds,
  }),
  libraryMediaRequestNotificationService = createLibraryMediaRequestNotificationService(),
  providerClientResolverService = createProviderClientResolverService(),
  libraryProviderIngestRequestStore = createLibraryProviderIngestRequestStore(),
  maintenanceLockService = createMaintenanceLockService(),
  maintenanceLockOperationPauseService = null,
  maintenanceLockWriteGuardService = createMaintenanceLockWriteGuardService({
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
  }),
  libraryExternalIntakeRunStore = createLibraryExternalIntakeRunStore(),
  libraryProviderIngestPlanningService = createLibraryProviderIngestPlanningService({
    mediaRequestStore: libraryMediaRequestStore,
    providerIngestRequestStore: libraryProviderIngestRequestStore,
  }),
  libraryExternalIntakeService = createLibraryExternalIntakeService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'library external intake planning',
    }),
    createOperationRun: libraryExternalIntakeRunStore.createOperationRun,
    getActiveRunByMediaRequestId: libraryExternalIntakeRunStore.getActiveRunByMediaRequestId,
    mediaRequestStore: libraryMediaRequestStore,
  }),
  libraryProviderIngestExecutionRunStore = createLibraryProviderIngestExecutionRunStore(),
  libraryProviderIngestExecutionService = createLibraryProviderIngestExecutionService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'library provider ingest execution',
    }),
    executionRunStore: libraryProviderIngestExecutionRunStore,
    mediaRequestStore: libraryMediaRequestStore,
    providerIngestRequestStore: libraryProviderIngestRequestStore,
    resolveProviderClients: providerClientResolverService.resolveProviderClients,
  }),
  libraryProviderIngestExecutionWorker = createLibraryProviderIngestExecutionWorker({
    acquireLease: libraryProviderIngestExecutionRunStore.acquireLease,
    executeProviderIngestRequests: libraryProviderIngestExecutionService.executeProviderIngestRequests,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: libraryProviderIngestExecutionRunStore.isCancellationRequested,
        operationLabel: 'Provider ingest execution',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : libraryProviderIngestExecutionRunStore.isCancellationRequested,
    markRunCancelled: libraryProviderIngestExecutionRunStore.markRunCancelled,
    markRunCompleted: libraryProviderIngestExecutionRunStore.markRunCompleted,
    markRunFailed: libraryProviderIngestExecutionRunStore.markRunFailed,
    markRunPaused: libraryProviderIngestExecutionRunStore.markRunPaused,
    markRunStarted: libraryProviderIngestExecutionRunStore.markRunStarted,
    releaseLease: libraryProviderIngestExecutionRunStore.releaseLease,
    renewLease: libraryProviderIngestExecutionRunStore.renewLease,
  }),
  libraryExternalIntakeWorker = createLibraryExternalIntakeWorker({
    acquireLease: libraryExternalIntakeRunStore.acquireLease,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: libraryExternalIntakeRunStore.isCancellationRequested,
        operationLabel: 'External provider ingest planning',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : libraryExternalIntakeRunStore.isCancellationRequested,
    markRunCancelled: libraryExternalIntakeRunStore.markRunCancelled,
    markRunCompleted: libraryExternalIntakeRunStore.markRunCompleted,
    markRunFailed: libraryExternalIntakeRunStore.markRunFailed,
    markRunPaused: libraryExternalIntakeRunStore.markRunPaused,
    markRunStarted: libraryExternalIntakeRunStore.markRunStarted,
    planExternalMediaRequest: libraryProviderIngestPlanningService.planExternalMediaRequest,
    queueExternalMediaRequestExecution: libraryProviderIngestExecutionService.queueExternalMediaRequestExecution,
    releaseLease: libraryExternalIntakeRunStore.releaseLease,
    renewLease: libraryExternalIntakeRunStore.renewLease,
  }),
  libraryMediaRequestService = createLibraryMediaRequestService({
    externalIntakeService: libraryExternalIntakeService,
    getAppUserById,
    mediaRequestFulfillmentService: libraryMediaRequestFulfillmentService,
    mediaRequestNotificationService: libraryMediaRequestNotificationService,
    mediaRequestStore: libraryMediaRequestStore,
    releaseAvailabilityStore: libraryReleaseAvailabilityStore,
  }),
  mediaFilesystemService = createMediaFilesystemService(),
  libraryOrganizePreviewStore = createLibraryOrganizePreviewStore(),
  libraryOrganizePreviewService = createLibraryOrganizePreviewService({
    libraryOrganizePreviewStore,
  }),
  libraryOrganizeApplyRunStore = createLibraryOrganizeApplyRunStore(),
  libraryOrganizeApplyService = createLibraryOrganizeApplyService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'library organize apply',
    }),
    buildLibraryOrganizePreview: libraryOrganizePreviewService.buildLibraryOrganizePreview,
    createOperationRun: libraryOrganizeApplyRunStore.createOperationRun,
    getActiveRun: libraryOrganizeApplyRunStore.getActiveRun,
  }),
  libraryOrganizeApplyWorker = createLibraryOrganizeApplyWorker({
    acquireLease: libraryOrganizeApplyRunStore.acquireLease,
    applyExclusiveFileMutationPlan: mediaFilesystemService.applyExclusiveFileMutationPlan,
    buildLibraryOrganizePreview: libraryOrganizePreviewService.buildLibraryOrganizePreview,
    createExclusiveFileMutationPlan: mediaFilesystemService.createExclusiveFileMutationPlan,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: libraryOrganizeApplyRunStore.isCancellationRequested,
        operationLabel: 'Library organize apply',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : libraryOrganizeApplyRunStore.isCancellationRequested,
    markRunCancelled: libraryOrganizeApplyRunStore.markRunCancelled,
    markRunCompleted: libraryOrganizeApplyRunStore.markRunCompleted,
    markRunFailed: libraryOrganizeApplyRunStore.markRunFailed,
    markRunPaused: libraryOrganizeApplyRunStore.markRunPaused,
    markRunStarted: libraryOrganizeApplyRunStore.markRunStarted,
    releaseLease: libraryOrganizeApplyRunStore.releaseLease,
    renewLease: libraryOrganizeApplyRunStore.renewLease,
    updateLibraryFileCanonicalPath: libraryCatalogStore.updateLibraryFileCanonicalPath,
  }),
  libraryFileMatchStore = createLibraryFileMatchStore(),
  libraryFileMatcherService = createLibraryFileMatcherService({
    libraryFileMatchStore,
  }),
  libraryReconciliationSummaryStore = createLibraryReconciliationSummaryStore(),
  libraryReconciliationSummaryService = createLibraryReconciliationSummaryService({
    libraryReconciliationSummaryStore,
  }),
  libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore(),
  libraryReleaseReconciliationService = createLibraryReleaseReconciliationService({
    libraryReleaseReconciliationStore,
  }),
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
  libraryWantedReleaseService = createLibraryWantedReleaseService({
    libraryWantedReleaseStore,
  }),
  libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState(),
  libraryDiscoveryRunStore = createLibraryDiscoveryRunStore(),
  libraryDiscoveryWorker = createLibraryDiscoveryWorker({
    acquireLease: libraryDiscoveryRunStore.acquireLease,
    dispatchDiscoveryRequests: libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests,
    isCancellationRequested: createOperationRunInterruptionGate({
      isCancellationRequested: libraryDiscoveryRunStore.isCancellationRequested,
      operationLabel: 'Library discovery',
      operationPauseService: maintenanceLockOperationPauseService,
    }),
    markRunCancelled: libraryDiscoveryRunStore.markRunCancelled,
    markRunCompleted: libraryDiscoveryRunStore.markRunCompleted,
    markRunFailed: libraryDiscoveryRunStore.markRunFailed,
    markRunPaused: libraryDiscoveryRunStore.markRunPaused,
    markRunStarted: libraryDiscoveryRunStore.markRunStarted,
    reconcileDiscoveryRequests: libraryDiscoveryRequestService.reconcileDiscoveryRequests,
    reconcileWantedReleases: libraryWantedReleaseService.reconcileWantedReleases,
    releaseLease: libraryDiscoveryRunStore.releaseLease,
    renewLease: libraryDiscoveryRunStore.renewLease,
  }),
  libraryDiscoveryRunService = createLibraryDiscoveryRunService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'library discovery dispatch',
    }),
    createOperationRun: libraryDiscoveryRunStore.createOperationRun,
    getActiveRun: libraryDiscoveryRunStore.getActiveRun,
  }),
  libraryDiscoverySummaryStore = createLibraryDiscoverySummaryStore(),
  libraryDiscoverySummaryService = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatState,
    libraryDiscoveryRunStore,
    libraryDiscoverySummaryStore,
  }),
  libraryWantedSummaryStore = createLibraryWantedSummaryStore(),
  libraryWantedSummaryService = createLibraryWantedSummaryService({
    libraryWantedSummaryStore,
  }),
  libraryScanRunStore = createLibraryScanRunStore(),
  libraryTagSnapshotStore = createLibraryTagSnapshotStore(),
  libraryEmbeddedArtworkService = createLibraryEmbeddedArtworkService({
    artworkAssignmentService,
    artworkIngestionService,
  }),
  librarySidecarArtworkService = createLibrarySidecarArtworkService({
    artworkAssignmentService,
    artworkIngestionService,
  }),
  libraryTagExtractionService = createLibraryTagExtractionService({
    libraryEmbeddedArtworkService,
    libraryTagSnapshotStore,
  }),
  libraryScanWorker = createLibraryScanWorker({
    acquireLease: libraryScanRunStore.acquireLease,
    captureLibrarySidecarArtwork: librarySidecarArtworkService.captureSidecarArtwork,
    extractLibraryFileTags: libraryTagExtractionService.extractLibraryFileTags,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: libraryScanRunStore.isCancellationRequested,
        operationLabel: 'Library scan',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : libraryScanRunStore.isCancellationRequested,
    markRunCancelled: libraryScanRunStore.markRunCancelled,
    matchLibraryFiles: libraryFileMatcherService.matchLibraryFiles,
    reconcileDiscoveryRequests: libraryDiscoveryRequestService.reconcileDiscoveryRequests,
    reconcileLibraryReleases: libraryReleaseReconciliationService.reconcileLibraryReleases,
    reconcileWantedReleases: libraryWantedReleaseService.reconcileWantedReleases,
    markRunCompleted: libraryScanRunStore.markRunCompleted,
    markRunFailed: libraryScanRunStore.markRunFailed,
    markRunPaused: libraryScanRunStore.markRunPaused,
    markRunStarted: libraryScanRunStore.markRunStarted,
    recordLibraryFiles: libraryCatalogStore.recordLibraryFiles,
    releaseLease: libraryScanRunStore.releaseLease,
    renewLease: libraryScanRunStore.renewLease,
  }),
  libraryScanService = createLibraryScanService({
    assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
      operationLabel: 'library scan',
    }),
    createOperationRun: libraryScanRunStore.createOperationRun,
    getActiveRun: libraryScanRunStore.getActiveRun,
    settingsService,
  }),
  libraryScanSummaryService = createLibraryScanSummaryService({
    libraryScanRunStore,
    settingsService,
  }),
} = {}) {
  return {
    libraryCatalogStore,
    libraryDiscoveryDispatchService,
    libraryDiscoveryHeartbeatState,
    libraryDiscoveryRunService,
    libraryDiscoveryRunStore,
    libraryDiscoveryRequestService,
    libraryDiscoveryRequestStore,
    libraryDiscoverySummaryService,
    libraryDiscoverySummaryStore,
    libraryDiscoveryWorker,
    libraryEmbeddedArtworkService,
    libraryFileMatcherService,
    libraryFileMatchStore,
    libraryExternalIntakeRunStore,
    libraryExternalIntakeService,
    libraryExternalIntakeWorker,
    libraryMediaRequestService,
    libraryMediaRequestStore,
    libraryOrganizeApplyRunStore,
    libraryOrganizeApplyService,
    libraryOrganizeApplyWorker,
    libraryOrganizePreviewService,
    libraryOrganizePreviewStore,
    providerClientResolverService,
    libraryProviderIngestExecutionRunStore,
    libraryProviderIngestExecutionService,
    libraryProviderIngestExecutionWorker,
    libraryProviderIngestPlanningService,
    libraryProviderIngestRequestStore,
    libraryReleaseAvailabilityStore,
    libraryReconciliationSummaryService,
    libraryReconciliationSummaryStore,
    libraryReleaseReconciliationService,
    libraryReleaseReconciliationStore,
    libraryScanRunStore,
    libraryScanService,
    libraryScanSummaryService,
    librarySidecarArtworkService,
    libraryTagExtractionService,
    libraryTagSnapshotStore,
    libraryWantedReleaseService,
    libraryWantedReleaseStore,
    libraryWantedSummaryService,
    libraryWantedSummaryStore,
    libraryScanWorker,
    routeDependencies: {
      buildLibraryDiscoveryRunDetail: libraryDiscoverySummaryService.buildLibraryDiscoveryRunDetail,
      buildLibraryDiscoverySummary: libraryDiscoverySummaryService.buildLibraryDiscoverySummary,
      buildLibraryOrganizePreview: libraryOrganizePreviewService.buildLibraryOrganizePreview,
      buildMediaRequestSummary: libraryMediaRequestService.buildMediaRequestSummary,
      buildLibraryReconciliationSummary: libraryReconciliationSummaryService.buildLibraryReconciliationSummary,
      buildLibraryScanRunDetail: libraryScanSummaryService.buildLibraryScanRunDetail,
      buildLibraryWantedSummary: libraryWantedSummaryService.buildLibraryWantedSummary,
      createMediaRequest: libraryMediaRequestService.createMediaRequest,
      listMediaRequests: libraryMediaRequestService.listMediaRequests,
      startLibraryOrganizeApplyRun: libraryOrganizeApplyService.startLibraryOrganizeApplyRun,
      startLibraryDiscoveryRun: libraryDiscoveryRunService.startLibraryDiscoveryRun,
      startLibraryScan: libraryScanService.startLibraryScan,
    },
  };
}

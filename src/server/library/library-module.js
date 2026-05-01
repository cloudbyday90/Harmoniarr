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
import { createLibraryCatalogStore } from './library-catalog-store.js';
import { createLibraryDiscoveryRequestService } from './library-discovery-request-service.js';
import { createLibraryDiscoveryRequestStore } from './library-discovery-request-store.js';
import { createLibraryDiscoveryDispatchService } from './library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRunService } from './library-discovery-run-service.js';
import { createLibraryDiscoveryRunStore } from './library-discovery-run-store.js';
import { createLibraryDiscoverySummaryService } from './library-discovery-summary-service.js';
import { createLibraryDiscoverySummaryStore } from './library-discovery-summary-store.js';
import { createLibraryDiscoveryHeartbeatState } from './library-discovery-heartbeat-state.js';
import { createLibraryDiscoveryWorker } from './library-discovery-worker.js';
import { createLibraryFileMatcherService } from './library-file-matcher-service.js';
import { createLibraryFileMatchStore } from './library-file-match-store.js';
import { createLibraryReconciliationSummaryService } from './library-reconciliation-summary-service.js';
import { createLibraryReconciliationSummaryStore } from './library-reconciliation-summary-store.js';
import { createLibraryReleaseReconciliationService } from './library-release-reconciliation-service.js';
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';
import { createLibraryScanRunStore } from './library-scan-run-store.js';
import { createLibraryScanService } from './library-scan-service.js';
import { createLibraryTagExtractionService } from './library-tag-extraction-service.js';
import { createLibraryTagSnapshotStore } from './library-tag-snapshot-store.js';
import { createLibraryWantedReleaseService } from './library-wanted-release-service.js';
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';
import { createLibraryWantedSummaryService } from './library-wanted-summary-service.js';
import { createLibraryWantedSummaryStore } from './library-wanted-summary-store.js';
import { createLibraryScanWorker } from './library-scan-worker.js';

export function createLibraryModule({
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
    markRunCompleted: libraryDiscoveryRunStore.markRunCompleted,
    markRunFailed: libraryDiscoveryRunStore.markRunFailed,
    markRunStarted: libraryDiscoveryRunStore.markRunStarted,
    reconcileDiscoveryRequests: libraryDiscoveryRequestService.reconcileDiscoveryRequests,
    reconcileWantedReleases: libraryWantedReleaseService.reconcileWantedReleases,
    releaseLease: libraryDiscoveryRunStore.releaseLease,
  }),
  libraryDiscoveryRunService = createLibraryDiscoveryRunService({
    createOperationRun: libraryDiscoveryRunStore.createOperationRun,
    getActiveRun: libraryDiscoveryRunStore.getActiveRun,
    startWorkerRun: libraryDiscoveryWorker.startWorkerRun,
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
  libraryTagExtractionService = createLibraryTagExtractionService({
    libraryTagSnapshotStore,
  }),
  libraryScanWorker = createLibraryScanWorker({
    acquireLease: libraryScanRunStore.acquireLease,
    extractLibraryFileTags: libraryTagExtractionService.extractLibraryFileTags,
    matchLibraryFiles: libraryFileMatcherService.matchLibraryFiles,
    reconcileDiscoveryRequests: libraryDiscoveryRequestService.reconcileDiscoveryRequests,
    reconcileLibraryReleases: libraryReleaseReconciliationService.reconcileLibraryReleases,
    reconcileWantedReleases: libraryWantedReleaseService.reconcileWantedReleases,
    markRunCompleted: libraryScanRunStore.markRunCompleted,
    markRunFailed: libraryScanRunStore.markRunFailed,
    markRunStarted: libraryScanRunStore.markRunStarted,
    recordLibraryFiles: libraryCatalogStore.recordLibraryFiles,
    releaseLease: libraryScanRunStore.releaseLease,
  }),
  libraryScanService = createLibraryScanService({
    createOperationRun: libraryScanRunStore.createOperationRun,
    getActiveRun: libraryScanRunStore.getActiveRun,
    settingsService,
    startWorkerRun: libraryScanWorker.startWorkerRun,
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
    libraryFileMatcherService,
    libraryFileMatchStore,
    libraryReconciliationSummaryService,
    libraryReconciliationSummaryStore,
    libraryReleaseReconciliationService,
    libraryReleaseReconciliationStore,
    libraryScanRunStore,
    libraryScanService,
    libraryScanSummaryService,
    libraryTagExtractionService,
    libraryTagSnapshotStore,
    libraryWantedReleaseService,
    libraryWantedReleaseStore,
    libraryWantedSummaryService,
    libraryWantedSummaryStore,
    libraryScanWorker,
    routeDependencies: {
      buildLibraryDiscoverySummary: libraryDiscoverySummaryService.buildLibraryDiscoverySummary,
      buildLibraryReconciliationSummary: libraryReconciliationSummaryService.buildLibraryReconciliationSummary,
      buildLibraryWantedSummary: libraryWantedSummaryService.buildLibraryWantedSummary,
      startLibraryDiscoveryRun: libraryDiscoveryRunService.startLibraryDiscoveryRun,
      startLibraryScan: libraryScanService.startLibraryScan,
    },
  };
}
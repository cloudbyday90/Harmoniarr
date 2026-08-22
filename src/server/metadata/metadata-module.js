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

import { createMetadataArtistRefreshRunStore } from './metadata-artist-refresh-run-store.js';
import { createMetadataRefreshDispatchPolicyService } from './metadata-refresh-dispatch-policy-service.js';
import { createMetadataReleaseDetectionService } from './metadata-release-detection-service.js';
import { createMetadataArtistRefreshService } from './metadata-artist-refresh-service.js';
import { createMetadataArtistRefreshWorker } from './metadata-artist-refresh-worker.js';
import { createMetadataRefreshHeartbeatState } from './metadata-refresh-heartbeat-state.js';
import { resolveMetadataRefreshHeartbeatConfig } from './metadata-refresh-heartbeat-config.js';
import { createMetadataMonitoredArtistStore } from './metadata-monitored-artist-store.js';
import { createMetadataArtistRefreshStateStore } from './metadata-artist-refresh-state-store.js';
import { createOperatorArtistMonitoringService } from './operator-artist-monitoring-service.js';
import { createOperatorMonitoredArtistProjectionService } from './operator-monitored-artist-projection-service.js';
import { createOperatorArtistProjectionService } from './operator-artist-projection-service.js';
import { createOperatorArtistSaveService } from './operator-artist-save-service.js';
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationExecutionService } from './operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from './operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationRecoveryService } from './operator-artist-reconciliation-recovery-service.js';
import { createOperatorArtistReconciliationService } from './operator-artist-reconciliation-service.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';
import { createOperatorArtistReconciliationSnapshotStore } from './operator-artist-reconciliation-snapshot-store.js';
import { createOperatorArtistReconciliationWorker } from './operator-artist-reconciliation-worker.js';
import { createOperatorReleaseGroupSelectionService } from './operator-release-group-selection-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideService } from './operator-track-override-service.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';
import { createMetadataRefreshSchedulerService } from './metadata-refresh-scheduler-service.js';
import { createMetadataRefreshSchedulingPolicyService } from './metadata-refresh-scheduling-policy-service.js';
import { createMetadataReadService } from './metadata-read-service.js';
import { createMetadataRefreshService } from './metadata-refresh-service.js';
import { createMetadataReleaseMaterializationService } from './metadata-release-materialization-service.js';
import { createMetadataSearchService } from './metadata-search-service.js';
import { createMusicBrainzCatalogService } from './musicbrainz-catalog-service.js';
import { createMusicBrainzImportService } from './musicbrainz-import-service.js';
import { createMusicBrainzSearchService } from './musicbrainz-search-service.js';
import { createSimilarArtistsService } from './similar-artists-service.js';
import { createReleaseGroupTracklistService } from './release-group-tracklist-service.js';
import { createMetadataProviderCacheService } from './metadata-provider-cache-service.js';
import { createMetadataProviderCacheObservabilityService } from './metadata-provider-cache-observability-service.js';
import { createMetadataProviderResponseCacheStore } from './metadata-provider-response-cache-store.js';
import { forceCanonicalRelease } from './canonical-release-service.js';
import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';

export function createMetadataModule({
  maintenanceLockOperationPauseService = null,
  onArtistMonitoredFn = null,
  libraryMediaRequestStore = null,
  reconcileDiscoveryRequests = null,
  reconcileWantedReleases = null,
  metadataArtistRefreshRunStore = null,
  metadataArtistRefreshService = null,
  metadataArtistRefreshWorker = null,
  metadataReleaseDetectionService = null,
  metadataRefreshDispatchPolicyService = null,
  metadataRefreshHeartbeatConfig = null,
  metadataRefreshHeartbeatState = null,
  metadataRefreshSchedulerService = null,
  metadataRefreshSchedulingPolicyService = null,
  metadataArtistRefreshStateStore = null,
  metadataMonitoredArtistStore = null,
  operatorArtistMonitoringStore = null,
  operatorArtistMonitoringService = null,
  operatorMonitoredArtistProjectionService = null,
  operatorArtistProjectionService = null,
  operatorArtistSaveService = null,
  operatorArtistReconciliationRunStore = null,
  operatorArtistReconciliationExecutionService = null,
  operatorArtistReconciliationRequestService = null,
  operatorArtistReconciliationService = null,
  operatorArtistReconciliationSnapshotStore = null,
  operatorArtistReconciliationSnapshotService = null,
  operatorArtistReconciliationWorker = null,
  operatorReleaseGroupSelectionStore = null,
  operatorReleaseGroupSelectionService = null,
  operatorTrackOverrideStore = null,
  operatorTrackOverrideService = null,
  metadataReadService = null,
  metadataRefreshService = null,
  metadataReleaseMaterializationService = null,
  metadataProviderCacheService = null,
  metadataProviderCacheObservabilityService = null,
  metadataProviderResponseCacheStore = null,
  metadataSearchService = null,
  providerHealthRecorder = null,
  recordActivityEventFn = null,
  recordAuditEventFn = undefined,
  musicBrainzCatalogService = null,
  musicBrainzImportService = null,
  musicBrainzSearchService = null,
  similarArtistsService = null,
  releaseGroupTracklistService = null,
} = {}) {
  const resolvedMetadataMonitoredArtistStore = metadataMonitoredArtistStore
    ?? createMetadataMonitoredArtistStore();
  const resolvedMetadataArtistRefreshStateStore = metadataArtistRefreshStateStore
    ?? createMetadataArtistRefreshStateStore();
  const resolvedMetadataReleaseDetectionService = metadataReleaseDetectionService ?? createMetadataReleaseDetectionService();
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService({
    metadataMonitoredArtistStore: resolvedMetadataMonitoredArtistStore,
    metadataReleaseDetectionService: resolvedMetadataReleaseDetectionService,
  });
  const resolvedMetadataRefreshSchedulingPolicyService = metadataRefreshSchedulingPolicyService ?? createMetadataRefreshSchedulingPolicyService();
  const resolvedMetadataRefreshSchedulerService = metadataRefreshSchedulerService ?? createMetadataRefreshSchedulerService({
    getMetadataArtist: resolvedMetadataReadService.getArtist,
    metadataArtistRefreshStateStore: resolvedMetadataArtistRefreshStateStore,
    metadataRefreshSchedulingPolicyService: resolvedMetadataRefreshSchedulingPolicyService,
  });
  const resolvedOperatorArtistMonitoringStore = operatorArtistMonitoringStore ?? createOperatorArtistMonitoringStore();
  const resolvedOperatorArtistMonitoringService = operatorArtistMonitoringService ?? createOperatorArtistMonitoringService({
    operatorArtistMonitoringStore: resolvedOperatorArtistMonitoringStore,
  });
  const resolvedOperatorArtistReconciliationRunStore = operatorArtistReconciliationRunStore
    ?? createOperatorArtistReconciliationRunStore();
  const resolvedOperatorArtistReconciliationSnapshotStore = operatorArtistReconciliationSnapshotStore
    ?? createOperatorArtistReconciliationSnapshotStore();
  const resolvedOperatorArtistReconciliationSnapshotService = operatorArtistReconciliationSnapshotService
    ?? createOperatorArtistReconciliationSnapshotService({
      operatorArtistReconciliationSnapshotStore: resolvedOperatorArtistReconciliationSnapshotStore,
    });
  const resolvedOperatorReleaseGroupSelectionStore = operatorReleaseGroupSelectionStore
    ?? createOperatorReleaseGroupSelectionStore();
  const resolvedOperatorReleaseGroupSelectionService = operatorReleaseGroupSelectionService
    ?? createOperatorReleaseGroupSelectionService({
      operatorReleaseGroupSelectionStore: resolvedOperatorReleaseGroupSelectionStore,
    });
  const resolvedOperatorTrackOverrideStore = operatorTrackOverrideStore
    ?? createOperatorTrackOverrideStore();
  const resolvedOperatorTrackOverrideService = operatorTrackOverrideService
    ?? createOperatorTrackOverrideService({
      operatorTrackOverrideStore: resolvedOperatorTrackOverrideStore,
    });
  const resolvedOperatorArtistReconciliationService = operatorArtistReconciliationService
    ?? createOperatorArtistReconciliationService({
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getLatestOperatorArtistReconciliationSnapshot: resolvedOperatorArtistReconciliationSnapshotService.getLatestOperatorArtistReconciliationSnapshot,
      queueLatestSnapshotRun: resolvedOperatorArtistReconciliationRunStore.queueLatestSnapshotRun,
      recordAuditEventFn,
    });
  const resolvedOperatorArtistReconciliationRecoveryService = createOperatorArtistReconciliationRecoveryService({
    queueOperatorArtistReconciliation: resolvedOperatorArtistReconciliationService.queueOperatorArtistReconciliation,
  });
  const resolvedOperatorArtistProjectionService = operatorArtistProjectionService
    ?? createOperatorArtistProjectionService({
      getLatestOperatorArtistReconciliationSnapshot: resolvedOperatorArtistReconciliationSnapshotService.getLatestOperatorArtistReconciliationSnapshot,
      getLatestRunByOperatorArtist: resolvedOperatorArtistReconciliationRunStore.getLatestRunByOperatorArtist,
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getOperatorArtistMonitoring: resolvedOperatorArtistMonitoringService.getOperatorArtistMonitoring,
      getPendingRunByOperatorArtist: resolvedOperatorArtistReconciliationRunStore.getPendingRunByOperatorArtist,
      getRunningRunByOperatorArtist: resolvedOperatorArtistReconciliationRunStore.getRunningRunByOperatorArtist,
      listOperatorReleaseGroupSelections: resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections,
      listOperatorTrackOverrides: resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides,
      operatorArtistReconciliationRecoveryService: resolvedOperatorArtistReconciliationRecoveryService,
    });
  const resolvedOperatorMonitoredArtistProjectionService = operatorMonitoredArtistProjectionService
    ?? createOperatorMonitoredArtistProjectionService({
      getOperatorArtistProjection: resolvedOperatorArtistProjectionService.getOperatorArtistProjection,
      listOperatorMonitoredArtists: resolvedOperatorArtistMonitoringStore.listOperatorMonitoredArtists,
    });
  const resolvedOperatorArtistSaveService = operatorArtistSaveService
    ?? createOperatorArtistSaveService({
      getOperatorArtistProjection: resolvedOperatorArtistProjectionService.getOperatorArtistProjection,
      onArtistMonitoredFn,
      operatorArtistMonitoringStore: resolvedOperatorArtistMonitoringStore,
      operatorArtistReconciliationRunStore: resolvedOperatorArtistReconciliationRunStore,
      operatorArtistReconciliationSnapshotStore: resolvedOperatorArtistReconciliationSnapshotStore,
      operatorReleaseGroupSelectionStore: resolvedOperatorReleaseGroupSelectionStore,
      operatorTrackOverrideStore: resolvedOperatorTrackOverrideStore,
      recordActivityEventFn,
      // Late-bound: the metadata artist refresh service is resolved further
      // below. Adding/monitoring an artist queues a per-artist discography
      // refresh so their releases populate without waiting on the heartbeat.
      startMetadataArtistRefresh: (input) => resolvedMetadataArtistRefreshService.startMetadataArtistRefresh(input),
    });
  const resolvedOperatorArtistReconciliationRequestService = operatorArtistReconciliationRequestService
    ?? createOperatorArtistReconciliationRequestService({
      libraryMediaRequestStore,
      reconcileDiscoveryRequests,
    });
  const resolvedOperatorArtistReconciliationExecutionService = operatorArtistReconciliationExecutionService
    ?? createOperatorArtistReconciliationExecutionService({
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getOperatorArtistMonitoring: resolvedOperatorArtistMonitoringService.getOperatorArtistMonitoring,
      getOperatorArtistReconciliationSnapshotById: resolvedOperatorArtistReconciliationSnapshotService.getOperatorArtistReconciliationSnapshotById,
      listOperatorReleaseGroupSelections: resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections,
      listOperatorTrackOverrides: resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides,
      operatorArtistReconciliationRequestService: resolvedOperatorArtistReconciliationRequestService,
    });
  const resolvedMetadataProviderResponseCacheStore = metadataProviderResponseCacheStore
    ?? createMetadataProviderResponseCacheStore();
  const resolvedMetadataProviderCacheObservabilityService = metadataProviderCacheObservabilityService
    ?? createMetadataProviderCacheObservabilityService();
  const resolvedMetadataProviderCacheService = metadataProviderCacheService
    ?? createMetadataProviderCacheService({
      cacheStore: resolvedMetadataProviderResponseCacheStore,
      onCacheError: resolvedMetadataProviderCacheObservabilityService.recordCacheStoreError,
      onCacheLookup: resolvedMetadataProviderCacheObservabilityService.recordCacheLookup,
      onRefreshFailure: resolvedMetadataProviderCacheObservabilityService.recordRefreshFailure,
      onRefreshStart: resolvedMetadataProviderCacheObservabilityService.recordRefreshStart,
      onRefreshSuccess: resolvedMetadataProviderCacheObservabilityService.recordRefreshSuccess,
    });
  const resolvedMusicBrainzCatalogService = musicBrainzCatalogService ?? createMusicBrainzCatalogService({
    metadataProviderCacheService: resolvedMetadataProviderCacheService,
    providerHealthRecorder,
  });
  const resolvedMusicBrainzImportService = musicBrainzImportService ?? createMusicBrainzImportService({ providerHealthRecorder });
  const resolvedMetadataReleaseMaterializationService = metadataReleaseMaterializationService
    ?? createMetadataReleaseMaterializationService({
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      importMusicBrainzRelease: resolvedMusicBrainzImportService.importReleaseById,
      musicBrainzCatalogService: resolvedMusicBrainzCatalogService,
    });
  const resolvedOperatorArtistReconciliationWorker = operatorArtistReconciliationWorker
    ?? createOperatorArtistReconciliationWorker({
      acquireLease: resolvedOperatorArtistReconciliationRunStore.acquireLease,
      executeOperatorArtistReconciliation: resolvedOperatorArtistReconciliationExecutionService.executeOperatorArtistReconciliation,
      isCancellationRequested: maintenanceLockOperationPauseService
        ? createOperationRunInterruptionGate({
          isCancellationRequested: resolvedOperatorArtistReconciliationRunStore.isCancellationRequested,
          operationLabel: 'Artist reconciliation',
          operationPauseService: maintenanceLockOperationPauseService,
        })
        : resolvedOperatorArtistReconciliationRunStore.isCancellationRequested,
      markRunCancelled: resolvedOperatorArtistReconciliationRunStore.markRunCancelled,
      markRunCompleted: resolvedOperatorArtistReconciliationRunStore.markRunCompleted,
      markRunFailed: resolvedOperatorArtistReconciliationRunStore.markRunFailed,
      markRunPaused: resolvedOperatorArtistReconciliationRunStore.markRunPaused,
      markRunStarted: resolvedOperatorArtistReconciliationRunStore.markRunStarted,
      releaseLease: resolvedOperatorArtistReconciliationRunStore.releaseLease,
      renewLease: resolvedOperatorArtistReconciliationRunStore.renewLease,
    });
  const resolvedMetadataRefreshService = metadataRefreshService ?? createMetadataRefreshService({
    getArtistRefreshMonitoring: resolvedMetadataArtistRefreshStateStore.getArtistRefreshMonitoring,
    getMetadataArtistByMusicBrainzId: resolvedMetadataReadService.getArtistByMusicBrainzId,
    listOperatorArtistMonitoringByMetadataArtist: resolvedOperatorArtistMonitoringStore.listOperatorArtistMonitoringByMetadataArtist,
    materializeMonitoredReleaseGroups: resolvedMetadataReleaseMaterializationService.materializeMonitoredReleaseGroups,
    providerHealthRecorder,
    metadataReleaseDetectionService: resolvedMetadataReleaseDetectionService,
    queueOperatorArtistReconciliation: resolvedOperatorArtistReconciliationService.queueOperatorArtistReconciliation,
    reconcileWantedReleases,
  });
  const resolvedMetadataArtistRefreshRunStore = metadataArtistRefreshRunStore ?? createMetadataArtistRefreshRunStore();
  const resolvedMetadataArtistRefreshService = metadataArtistRefreshService ?? createMetadataArtistRefreshService({
    createOperationRun: resolvedMetadataArtistRefreshRunStore.createOperationRun,
    getActiveRunByMetadataArtistId: resolvedMetadataArtistRefreshRunStore.getActiveRunByMetadataArtistId,
    getMetadataArtist: resolvedMetadataReadService.getArtist,
  });
  const resolvedMetadataArtistRefreshWorker = metadataArtistRefreshWorker ?? createMetadataArtistRefreshWorker({
    acquireLease: resolvedMetadataArtistRefreshRunStore.acquireLease,
    isCancellationRequested: maintenanceLockOperationPauseService
      ? createOperationRunInterruptionGate({
        isCancellationRequested: resolvedMetadataArtistRefreshRunStore.isCancellationRequested,
        operationLabel: 'Metadata artist refresh',
        operationPauseService: maintenanceLockOperationPauseService,
      })
      : resolvedMetadataArtistRefreshRunStore.isCancellationRequested,
    markRunCancelled: resolvedMetadataArtistRefreshRunStore.markRunCancelled,
    markRunCompleted: resolvedMetadataArtistRefreshRunStore.markRunCompleted,
    markRunFailed: resolvedMetadataArtistRefreshRunStore.markRunFailed,
    markRunPaused: resolvedMetadataArtistRefreshRunStore.markRunPaused,
    markRunStarted: resolvedMetadataArtistRefreshRunStore.markRunStarted,
    recordArtistRefreshCompleted: resolvedMetadataRefreshSchedulerService.recordArtistRefreshCompleted,
    refreshMetadataArtist: resolvedMetadataRefreshService.refreshArtistCatalogById,
    releaseLease: resolvedMetadataArtistRefreshRunStore.releaseLease,
    renewLease: resolvedMetadataArtistRefreshRunStore.renewLease,
  });
  const resolvedMetadataRefreshDispatchPolicyService = metadataRefreshDispatchPolicyService ?? createMetadataRefreshDispatchPolicyService();
  const resolvedMetadataRefreshHeartbeatConfig = metadataRefreshHeartbeatConfig ?? resolveMetadataRefreshHeartbeatConfig();
  const resolvedMetadataRefreshHeartbeatState = metadataRefreshHeartbeatState ?? createMetadataRefreshHeartbeatState();
  const resolvedMetadataSearchService = metadataSearchService ?? createMetadataSearchService();
  const resolvedMusicBrainzSearchService = musicBrainzSearchService ?? createMusicBrainzSearchService({ providerHealthRecorder });
  const resolvedSimilarArtistsService = similarArtistsService ?? createSimilarArtistsService({
    metadataProviderCacheService: resolvedMetadataProviderCacheService,
  });
  const resolvedReleaseGroupTracklistService = releaseGroupTracklistService ?? createReleaseGroupTracklistService({
    musicBrainzCatalogService: resolvedMusicBrainzCatalogService,
    importMusicBrainzReleaseGroup: resolvedMusicBrainzImportService.importReleaseGroupById,
  });

  return {
    metadataArtistRefreshRunStore: resolvedMetadataArtistRefreshRunStore,
    metadataArtistRefreshService: resolvedMetadataArtistRefreshService,
    metadataArtistRefreshWorker: resolvedMetadataArtistRefreshWorker,
    metadataReleaseDetectionService: resolvedMetadataReleaseDetectionService,
    metadataRefreshDispatchPolicyService: resolvedMetadataRefreshDispatchPolicyService,
    metadataRefreshHeartbeatConfig: resolvedMetadataRefreshHeartbeatConfig,
    metadataRefreshHeartbeatState: resolvedMetadataRefreshHeartbeatState,
    metadataRefreshSchedulerService: resolvedMetadataRefreshSchedulerService,
    metadataRefreshSchedulingPolicyService: resolvedMetadataRefreshSchedulingPolicyService,
    metadataReadService: resolvedMetadataReadService,
    metadataMonitoredArtistStore: resolvedMetadataMonitoredArtistStore,
    metadataProviderCacheService: resolvedMetadataProviderCacheService,
    metadataProviderCacheObservabilityService: resolvedMetadataProviderCacheObservabilityService,
    metadataProviderResponseCacheStore: resolvedMetadataProviderResponseCacheStore,
    operatorArtistMonitoringService: resolvedOperatorArtistMonitoringService,
    operatorArtistMonitoringStore: resolvedOperatorArtistMonitoringStore,
    operatorMonitoredArtistProjectionService: resolvedOperatorMonitoredArtistProjectionService,
    operatorArtistProjectionService: resolvedOperatorArtistProjectionService,
    operatorArtistSaveService: resolvedOperatorArtistSaveService,
    operatorArtistReconciliationExecutionService: resolvedOperatorArtistReconciliationExecutionService,
    operatorArtistReconciliationRequestService: resolvedOperatorArtistReconciliationRequestService,
    operatorArtistReconciliationRunStore: resolvedOperatorArtistReconciliationRunStore,
    operatorArtistReconciliationService: resolvedOperatorArtistReconciliationService,
    operatorArtistReconciliationSnapshotService: resolvedOperatorArtistReconciliationSnapshotService,
    operatorArtistReconciliationSnapshotStore: resolvedOperatorArtistReconciliationSnapshotStore,
    operatorArtistReconciliationWorker: resolvedOperatorArtistReconciliationWorker,
    operatorReleaseGroupSelectionService: resolvedOperatorReleaseGroupSelectionService,
    operatorReleaseGroupSelectionStore: resolvedOperatorReleaseGroupSelectionStore,
    operatorTrackOverrideService: resolvedOperatorTrackOverrideService,
    operatorTrackOverrideStore: resolvedOperatorTrackOverrideStore,
    metadataRefreshService: resolvedMetadataRefreshService,
    metadataReleaseMaterializationService: resolvedMetadataReleaseMaterializationService,
    metadataArtistRefreshStateStore: resolvedMetadataArtistRefreshStateStore,
    metadataSearchService: resolvedMetadataSearchService,
    providerHealthRecorder,
    musicBrainzCatalogService: resolvedMusicBrainzCatalogService,
    musicBrainzImportService: resolvedMusicBrainzImportService,
    musicBrainzSearchService: resolvedMusicBrainzSearchService,
    similarArtistsService: resolvedSimilarArtistsService,
    routeDependencies: {
      browseMusicBrainzArtistReleaseGroups: resolvedMusicBrainzCatalogService.browseArtistReleaseGroups,
      getMetadataArtistDetectionEvents: resolvedMetadataReadService.getArtistDetectionEvents,
      getMetadataProviderCacheObservability: resolvedMetadataProviderCacheObservabilityService.getSummary,
      listOperatorMonitoredArtistProjections: resolvedOperatorMonitoredArtistProjectionService.listOperatorMonitoredArtistProjections,
      getOperatorArtistProjection: resolvedOperatorArtistProjectionService.getOperatorArtistProjection,
      getMusicBrainzReleaseGroupReleases: resolvedMusicBrainzCatalogService.getReleaseGroupReleases,
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getMetadataArtistByMusicBrainzId: resolvedMetadataReadService.getArtistByMusicBrainzId,
      getMetadataRelease: resolvedMetadataReadService.getRelease,
      getMetadataReleaseByMusicBrainzId: resolvedMetadataReadService.getReleaseByMusicBrainzId,
      getMetadataReleaseGroup: resolvedMetadataReadService.getReleaseGroup,
      getMetadataReleaseGroupByMusicBrainzId: resolvedMetadataReadService.getReleaseGroupByMusicBrainzId,
      saveOperatorArtist: resolvedOperatorArtistSaveService.saveOperatorArtist,
      startMetadataArtistRefresh: resolvedMetadataArtistRefreshService.startMetadataArtistRefresh,
      importMusicBrainzArtist: resolvedMusicBrainzImportService.importArtistById,
      importMusicBrainzReleaseGroup: resolvedMusicBrainzImportService.importReleaseGroupById,
      importMusicBrainzRelease: resolvedMusicBrainzImportService.importReleaseById,
      searchAllLocalMetadata: resolvedMetadataSearchService.searchAll,
      searchLocalMetadataArtists: resolvedMetadataSearchService.searchArtists,
      searchLocalMetadataReleaseGroups: resolvedMetadataSearchService.searchReleaseGroups,
      searchLocalMetadataReleases: resolvedMetadataSearchService.searchReleases,
      listAllMonitoredArtists: resolvedMetadataSearchService.listAllMonitoredArtists,
      searchMusicBrainzArtists: resolvedMusicBrainzSearchService.searchArtists,
      searchMusicBrainzReleases: resolvedMusicBrainzSearchService.searchReleases,
      getSimilarArtists: resolvedSimilarArtistsService.getSimilarArtists,
      getReleaseGroupTracklist: resolvedReleaseGroupTracklistService.getReleaseGroupTracklist,
      markCanonicalRelease: forceCanonicalRelease,
      queueOperatorArtistReconciliation: resolvedOperatorArtistReconciliationService.queueOperatorArtistReconciliation,
    },
  };
}

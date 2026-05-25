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
import { createMetadataMonitoringService } from './metadata-monitoring-service.js';
import { createMetadataMonitoringStore } from './metadata-monitoring-store.js';
import { createOperatorArtistMonitoringService } from './operator-artist-monitoring-service.js';
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationService } from './operator-artist-reconciliation-service.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';
import { createOperatorArtistReconciliationSnapshotStore } from './operator-artist-reconciliation-snapshot-store.js';
import { createOperatorReleaseGroupSelectionService } from './operator-release-group-selection-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideService } from './operator-track-override-service.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';
import { createMetadataRefreshSchedulerService } from './metadata-refresh-scheduler-service.js';
import { createMetadataRefreshSchedulingPolicyService } from './metadata-refresh-scheduling-policy-service.js';
import { createMetadataReadService } from './metadata-read-service.js';
import { createMetadataRefreshService } from './metadata-refresh-service.js';
import { createMetadataSearchService } from './metadata-search-service.js';
import { createMusicBrainzCatalogService } from './musicbrainz-catalog-service.js';
import { createMusicBrainzImportService } from './musicbrainz-import-service.js';
import { createMusicBrainzSearchService } from './musicbrainz-search-service.js';
import { createSimilarArtistsService } from './similar-artists-service.js';
import { createReleaseGroupTracklistService } from './release-group-tracklist-service.js';
import { forceCanonicalRelease } from './canonical-release-service.js';
import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';

export function createMetadataModule({
  maintenanceLockOperationPauseService = null,
  onArtistMonitoredFn = null,
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
  metadataMonitoringStore = null,
  metadataMonitoringService = null,
  operatorArtistMonitoringStore = null,
  operatorArtistMonitoringService = null,
  operatorArtistReconciliationRunStore = null,
  operatorArtistReconciliationService = null,
  operatorArtistReconciliationSnapshotStore = null,
  operatorArtistReconciliationSnapshotService = null,
  operatorReleaseGroupSelectionStore = null,
  operatorReleaseGroupSelectionService = null,
  operatorTrackOverrideStore = null,
  operatorTrackOverrideService = null,
  metadataReadService = null,
  metadataRefreshService = null,
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
  const resolvedMetadataMonitoringStore = metadataMonitoringStore ?? createMetadataMonitoringStore();
  const resolvedMetadataReleaseDetectionService = metadataReleaseDetectionService ?? createMetadataReleaseDetectionService();
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService({
    metadataMonitoringStore: resolvedMetadataMonitoringStore,
    metadataReleaseDetectionService: resolvedMetadataReleaseDetectionService,
  });
  const resolvedMetadataRefreshSchedulingPolicyService = metadataRefreshSchedulingPolicyService ?? createMetadataRefreshSchedulingPolicyService();
  const resolvedMetadataRefreshSchedulerService = metadataRefreshSchedulerService ?? createMetadataRefreshSchedulerService({
    getMetadataArtist: resolvedMetadataReadService.getArtist,
    metadataMonitoringStore: resolvedMetadataMonitoringStore,
    metadataRefreshSchedulingPolicyService: resolvedMetadataRefreshSchedulingPolicyService,
  });
  const resolvedMetadataMonitoringService = metadataMonitoringService ?? createMetadataMonitoringService({
    metadataMonitoringStore: resolvedMetadataMonitoringStore,
    metadataRefreshSchedulerService: resolvedMetadataRefreshSchedulerService,
    recordActivityEventFn,
    onArtistMonitoredFn,
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
  const resolvedOperatorArtistReconciliationService = operatorArtistReconciliationService
    ?? createOperatorArtistReconciliationService({
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getLatestOperatorArtistReconciliationSnapshot: resolvedOperatorArtistReconciliationSnapshotService.getLatestOperatorArtistReconciliationSnapshot,
      queueLatestSnapshotRun: resolvedOperatorArtistReconciliationRunStore.queueLatestSnapshotRun,
      recordAuditEventFn,
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
  const resolvedMetadataRefreshService = metadataRefreshService ?? createMetadataRefreshService({
    getMetadataArtistByMusicBrainzId: resolvedMetadataReadService.getArtistByMusicBrainzId,
    providerHealthRecorder,
    metadataReleaseDetectionService: resolvedMetadataReleaseDetectionService,
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
  const resolvedMusicBrainzCatalogService = musicBrainzCatalogService ?? createMusicBrainzCatalogService({ providerHealthRecorder });
  const resolvedMusicBrainzImportService = musicBrainzImportService ?? createMusicBrainzImportService({ providerHealthRecorder });
  const resolvedMusicBrainzSearchService = musicBrainzSearchService ?? createMusicBrainzSearchService({ providerHealthRecorder });
  const resolvedSimilarArtistsService = similarArtistsService ?? createSimilarArtistsService();
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
    metadataMonitoringService: resolvedMetadataMonitoringService,
    metadataMonitoringStore: resolvedMetadataMonitoringStore,
    operatorArtistMonitoringService: resolvedOperatorArtistMonitoringService,
    operatorArtistMonitoringStore: resolvedOperatorArtistMonitoringStore,
    operatorArtistReconciliationRunStore: resolvedOperatorArtistReconciliationRunStore,
    operatorArtistReconciliationService: resolvedOperatorArtistReconciliationService,
    operatorArtistReconciliationSnapshotService: resolvedOperatorArtistReconciliationSnapshotService,
    operatorArtistReconciliationSnapshotStore: resolvedOperatorArtistReconciliationSnapshotStore,
    operatorReleaseGroupSelectionService: resolvedOperatorReleaseGroupSelectionService,
    operatorReleaseGroupSelectionStore: resolvedOperatorReleaseGroupSelectionStore,
    operatorTrackOverrideService: resolvedOperatorTrackOverrideService,
    operatorTrackOverrideStore: resolvedOperatorTrackOverrideStore,
    metadataRefreshService: resolvedMetadataRefreshService,
    metadataSearchService: resolvedMetadataSearchService,
    providerHealthRecorder,
    musicBrainzCatalogService: resolvedMusicBrainzCatalogService,
    musicBrainzImportService: resolvedMusicBrainzImportService,
    musicBrainzSearchService: resolvedMusicBrainzSearchService,
    similarArtistsService: resolvedSimilarArtistsService,
    routeDependencies: {
      browseMusicBrainzArtistReleaseGroups: resolvedMusicBrainzCatalogService.browseArtistReleaseGroups,
      getMetadataArtistDetectionEvents: resolvedMetadataReadService.getArtistDetectionEvents,
      getMusicBrainzReleaseGroupReleases: resolvedMusicBrainzCatalogService.getReleaseGroupReleases,
      getMetadataArtist: resolvedMetadataReadService.getArtist,
      getMetadataArtistByMusicBrainzId: resolvedMetadataReadService.getArtistByMusicBrainzId,
      getMetadataRelease: resolvedMetadataReadService.getRelease,
      getMetadataReleaseByMusicBrainzId: resolvedMetadataReadService.getReleaseByMusicBrainzId,
      getMetadataReleaseGroup: resolvedMetadataReadService.getReleaseGroup,
      getMetadataReleaseGroupByMusicBrainzId: resolvedMetadataReadService.getReleaseGroupByMusicBrainzId,
      startMetadataArtistRefresh: resolvedMetadataArtistRefreshService.startMetadataArtistRefresh,
      updateMetadataArtistMonitoring: resolvedMetadataMonitoringService.updateArtistMonitoring,
      importMusicBrainzArtist: resolvedMusicBrainzImportService.importArtistById,
      importMusicBrainzReleaseGroup: resolvedMusicBrainzImportService.importReleaseGroupById,
      importMusicBrainzRelease: resolvedMusicBrainzImportService.importReleaseById,
      searchAllLocalMetadata: resolvedMetadataSearchService.searchAll,
      searchLocalMetadataArtists: resolvedMetadataSearchService.searchArtists,
      searchLocalMetadataReleaseGroups: resolvedMetadataSearchService.searchReleaseGroups,
      searchLocalMetadataReleases: resolvedMetadataSearchService.searchReleases,
      listMonitoredArtists: resolvedMetadataSearchService.listMonitoredArtists,
      listAllMonitoredArtists: resolvedMetadataSearchService.listAllMonitoredArtists,
      searchMusicBrainzArtists: resolvedMusicBrainzSearchService.searchArtists,
      searchMusicBrainzReleases: resolvedMusicBrainzSearchService.searchReleases,
      getSimilarArtists: resolvedSimilarArtistsService.getSimilarArtists,
      getReleaseGroupTracklist: resolvedReleaseGroupTracklistService.getReleaseGroupTracklist,
      markCanonicalRelease: forceCanonicalRelease,
    },
  };
}

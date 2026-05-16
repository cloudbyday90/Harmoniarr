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

import { createArtworkAssignmentService } from './artwork-assignment-service.js';
import { createArtworkCleanupDetailService } from './artwork-cleanup-detail-service.js';
import { createArtworkCleanupService } from './artwork-cleanup-service.js';
import { createArtworkCleanupHistoryService } from './artwork-cleanup-history-service.js';
import { createArtworkCleanupRunService } from './artwork-cleanup-run-service.js';
import { createArtworkCleanupRunStore } from './artwork-cleanup-run-store.js';
import { createArtworkCleanupWorker } from './artwork-cleanup-worker.js';
import { createArtworkDominantColorService } from './artwork-dominant-color-service.js';
import { createArtworkFetchBackoffService } from './artwork-fetch-backoff-service.js';
import { createArtworkFetchService } from './artwork-fetch-service.js';
import { createArtworkIngestionService } from './artwork-ingestion-service.js';
import { createArtworkMonitoredArtistPrefetchService } from './artwork-monitored-artist-prefetch-service.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { createArtworkQuotaService } from './artwork-quota-service.js';
import { createArtworkServeService } from './artwork-serve-service.js';
import { createArtworkSummaryService } from './artwork-summary-service.js';
import { createCoverArtArchiveClient } from '../integrations/cover-art-archive/cover-art-archive-client.js';
import { createFanartTvClient } from '../integrations/fanart-tv/fanart-client.js';
import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';
import { createMaintenanceLockService } from '../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../recovery/maintenance-lock-write-guard-service.js';
import * as artworkRepository from './artwork-repository.js';

export function createArtworkModule({
  settingsService,
  maintenanceLockService = createMaintenanceLockService(),
  maintenanceLockOperationPauseService = null,
  maintenanceLockWriteGuardService = createMaintenanceLockWriteGuardService({
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
  }),
  artworkCleanupDetailService,
  artworkCleanupService,
  artworkCleanupHistoryService,
  artworkCleanupRunService,
  artworkCleanupRunStore = createArtworkCleanupRunStore(),
  artworkCleanupWorker,
  artworkPolicyService = createArtworkPolicyService({ settingsService }),
  artworkIngestionService = createArtworkIngestionService({ artworkPolicyService }),
  artworkServeService = createArtworkServeService({ artworkPolicyService }),
  artworkAssignmentService = createArtworkAssignmentService(),
  artworkDominantColorService = createArtworkDominantColorService(),
  artworkFetchBackoffService,
  artworkQuotaService,
  coverArtArchiveClient,
  fanartTvClient,
  artworkFetchService,
  artworkMonitoredArtistPrefetchService,
  artworkSummaryService,
} = {}) {
  const resolvedArtworkCleanupService = artworkCleanupService
    ?? createArtworkCleanupService({ artworkPolicyService });
  const artworkCleanupInterruptionGate = maintenanceLockOperationPauseService
    ? createOperationRunInterruptionGate({
      isCancellationRequested: artworkCleanupRunStore.isCancellationRequested,
      operationLabel: 'Artwork cleanup',
      operationPauseService: maintenanceLockOperationPauseService,
    })
    : artworkCleanupRunStore.isCancellationRequested;
  const resolvedArtworkCleanupWorker = artworkCleanupWorker
    ?? createArtworkCleanupWorker({
      acquireLease: artworkCleanupRunStore.acquireLease,
      artworkCleanupService: resolvedArtworkCleanupService,
      isCancellationRequested: artworkCleanupInterruptionGate,
      markRunCancelled: artworkCleanupRunStore.markRunCancelled,
      markRunCompleted: artworkCleanupRunStore.markRunCompleted,
      markRunFailed: artworkCleanupRunStore.markRunFailed,
      markRunPaused: artworkCleanupRunStore.markRunPaused,
      markRunStarted: artworkCleanupRunStore.markRunStarted,
      releaseLease: artworkCleanupRunStore.releaseLease,
      renewLease: artworkCleanupRunStore.renewLease,
    });
  const resolvedArtworkCleanupRunService = artworkCleanupRunService
    ?? createArtworkCleanupRunService({
      assertMaintenanceWriteAllowed: () => maintenanceLockWriteGuardService.assertNoActiveWriteLocks({
        operationLabel: 'artwork cleanup',
      }),
      artworkPolicyService,
      createOperationRun: artworkCleanupRunStore.createOperationRun,
      getActiveRun: artworkCleanupRunStore.getActiveRun,
    });
  const resolvedArtworkCleanupHistoryService = artworkCleanupHistoryService
    ?? createArtworkCleanupHistoryService({
      artworkCleanupRunStore,
    });
  const resolvedArtworkCleanupDetailService = artworkCleanupDetailService
    ?? createArtworkCleanupDetailService({
      artworkCleanupRunStore,
    });
  const resolvedArtworkSummaryService = artworkSummaryService
    ?? createArtworkSummaryService({
      artworkCleanupRunStore,
      artworkPolicyService,
    });
  const resolvedCoverArtArchiveClient = coverArtArchiveClient
    ?? (() => { try { return createCoverArtArchiveClient(); } catch { return null; } })();
  const resolvedFanartTvClient = fanartTvClient
    ?? (() => { try { return createFanartTvClient(); } catch { return null; } })();
  const resolvedArtworkQuotaService = artworkQuotaService
    ?? createArtworkQuotaService({
      getDailyLimit: async () => {
        const policy = await artworkPolicyService.getArtworkRuntimePolicy();
        return policy.fetch.dailyQuotaLimit ?? 1000;
      },
    });
  const resolvedArtworkFetchBackoffService = artworkFetchBackoffService
    ?? createArtworkFetchBackoffService();
  const resolvedArtworkFetchService = artworkFetchService
    ?? createArtworkFetchService({
      artworkAssignmentService,
      artworkFetchBackoffService: resolvedArtworkFetchBackoffService,
      artworkIngestionService,
      artworkPolicyService,
      artworkQuotaService: resolvedArtworkQuotaService,
      coverArtArchiveClient: resolvedCoverArtArchiveClient,
      fanartTvClient: resolvedFanartTvClient,
    });
  const resolvedArtworkMonitoredArtistPrefetchService = artworkMonitoredArtistPrefetchService
    ?? createArtworkMonitoredArtistPrefetchService({
      artworkFetchService: resolvedArtworkFetchService,
    });

  return {
    artworkAssignmentService,
    artworkCleanupDetailService: resolvedArtworkCleanupDetailService,
    artworkCleanupService: resolvedArtworkCleanupService,
    artworkCleanupHistoryService: resolvedArtworkCleanupHistoryService,
    artworkCleanupRunService: resolvedArtworkCleanupRunService,
    artworkCleanupRunStore,
    artworkCleanupWorker: resolvedArtworkCleanupWorker,
    artworkFetchBackoffService: resolvedArtworkFetchBackoffService,
    artworkFetchService: resolvedArtworkFetchService,
    artworkIngestionService,
    artworkMonitoredArtistPrefetchService: resolvedArtworkMonitoredArtistPrefetchService,
    artworkPolicyService,
    artworkQuotaService: resolvedArtworkQuotaService,
    artworkRepository,
    artworkServeService,
    artworkSummaryService: resolvedArtworkSummaryService,
    routeDependencies: {
      buildArtworkCleanupRunDetail: resolvedArtworkCleanupDetailService.buildArtworkCleanupRunDetail,
      buildArtworkCleanupHistory: resolvedArtworkCleanupHistoryService.buildArtworkCleanupHistory,
      buildArtworkSummary: resolvedArtworkSummaryService.buildArtworkSummary,
      getQuotaHistory: resolvedArtworkQuotaService.getQuotaHistory,
      getQuotaStatus: resolvedArtworkQuotaService.getQuotaStatus,
      resolveArtwork: resolvedArtworkFetchService.resolveArtwork,
      resolveArtworkBatch: resolvedArtworkFetchService.resolveArtworkBatch,
      serveArtworkFile: artworkServeService.serveArtworkFile,
      startArtworkCleanupRun: resolvedArtworkCleanupRunService.startArtworkCleanupRun,
      writeDominantColor: artworkDominantColorService.writeDominantColor,
    },
  };
}

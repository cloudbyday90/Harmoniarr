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
import { createArtworkIngestionService } from './artwork-ingestion-service.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { createArtworkSummaryService } from './artwork-summary-service.js';
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
  artworkAssignmentService = createArtworkAssignmentService(),
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

  return {
    artworkAssignmentService,
    artworkCleanupDetailService: resolvedArtworkCleanupDetailService,
    artworkCleanupService: resolvedArtworkCleanupService,
    artworkCleanupHistoryService: resolvedArtworkCleanupHistoryService,
    artworkCleanupRunService: resolvedArtworkCleanupRunService,
    artworkCleanupRunStore,
    artworkCleanupWorker: resolvedArtworkCleanupWorker,
    artworkIngestionService,
    artworkPolicyService,
    artworkRepository,
    artworkSummaryService: resolvedArtworkSummaryService,
    routeDependencies: {
      buildArtworkCleanupRunDetail: resolvedArtworkCleanupDetailService.buildArtworkCleanupRunDetail,
      buildArtworkCleanupHistory: resolvedArtworkCleanupHistoryService.buildArtworkCleanupHistory,
      buildArtworkSummary: resolvedArtworkSummaryService.buildArtworkSummary,
      startArtworkCleanupRun: resolvedArtworkCleanupRunService.startArtworkCleanupRun,
    },
  };
}
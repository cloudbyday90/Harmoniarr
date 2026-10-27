/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { drainWorkerOwners } from './worker-owner-drain.js';

/** Capture producers before consumers; metadata refresh can queue artist reconciliation. */
export function drainApplicationWorkerOwners({ importCandidateModule, libraryModule, metadataModule,systemModule,plexHttpClient,providerHttpService }) {
  return drainWorkerOwners([
    systemModule?.schemaMaintenanceService,
    systemModule?.plexCallbackMaintenanceService,
    systemModule?.backupRecoveryWorker,
    systemModule?.healthReadinessService,
    metadataModule?.metadataArtistRefreshWorker,
    metadataModule?.operatorArtistReconciliationWorker,
    libraryModule?.libraryQualityReviewSearchWorker,
    libraryModule?.libraryExternalIntakeWorker,
    libraryModule?.libraryProviderIngestExecutionWorker,
    libraryModule?.libraryExternalRequestDiscoveryWorker,
    libraryModule?.libraryDiscoveryWorker,
    importCandidateModule?.importCandidateExecutionWorker,
    importCandidateModule?.importCandidateMediaInspectionWorker,
    importCandidateModule?.importCandidateTranscodeWorker,
    importCandidateModule?.importCandidateApplyWorker,
    libraryModule?.libraryOrganizeApplyWorker,
    libraryModule?.libraryScanWorker,
    plexHttpClient,
    providerHttpService,
  ]);
}

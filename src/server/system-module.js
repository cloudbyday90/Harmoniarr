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

import { createLibraryScanSummaryService } from './library-scan-summary-service.js';
import { createOnboardingSummaryService } from './onboarding-summary-service.js';
import { createActivityFeedService } from './activity-feed-service.js';
import { createAuditReadService } from './audit-read-service.js';
import { createSettingsService } from './settings-service.js';
import { createDependencyHealthService } from './dependency-health-service.js';
import { createOperatorNotificationService } from './operator-notification-service.js';
import { createOperatorNotificationFanoutRunStore } from './operator-notification-fanout-run-store.js';
import { createOperatorNotificationFanoutService } from './operator-notification-fanout-service.js';
import { createOperatorNotificationFanoutWorker } from './operator-notification-fanout-worker.js';
import { createBackupArtifactRepository } from './recovery/backup-artifact-repository.js';
import { createBackupExportService } from './recovery/backup-export-service.js';
import { createBackupRestoreApplyService } from './recovery/backup-restore-apply-service.js';
import { createBackupRestorePreviewService } from './recovery/backup-restore-preview-service.js';
import { createMaintenanceLockService } from './recovery/maintenance-lock-service.js';
import { createSystemService } from './system-service.js';

export function createSystemModule({
  activityFeedService = null,
  appleMusicStatusService = null,
  appPort,
  artworkPolicyService = null,
  artworkSummaryService = null,
  auditReadService = null,
  dependencyHealthService = createDependencyHealthService(),
  importCandidateExecutionHeartbeatConfig = null,
  importCandidateExecutionHeartbeatState = null,
  libraryDiscoveryHeartbeatState = null,
  metadataRefreshHeartbeatConfig = null,
  metadataRefreshHeartbeatState = null,
  musicBrainzSearchService,
  backupArtifactRepository = createBackupArtifactRepository(),
  backupExportService = null,
  backupRestoreApplyService = null,
  backupRestorePreviewService = null,
  maintenanceLockService = createMaintenanceLockService(),
  operatorNotificationService = null,
  operatorNotificationFanoutRunStore = createOperatorNotificationFanoutRunStore(),
  operatorNotificationFanoutService = null,
  operatorNotificationFanoutWorker = null,
  operationHistoryService = null,
  packageJsonPath,
  settingsService = createSettingsService(),
  spotifyOAuthService = null,
  youtubeOAuthService = null,
  libraryScanSummaryService = createLibraryScanSummaryService({
    settingsService,
  }),
  slskdService,
  startedAt,
  onboardingSummaryService = createOnboardingSummaryService({
    libraryScanSummaryService,
    musicBrainzSearchService,
    settingsService,
    slskdService,
  }),
  systemActivityFeedService = activityFeedService ?? createActivityFeedService({
    auditReadService: auditReadService ?? createAuditReadService(),
    operationHistoryService,
  }),
  systemOperatorNotificationService = operatorNotificationService ?? createOperatorNotificationService(),
  systemBackupExportService = backupExportService ?? createBackupExportService({
    createBackupArtifact: backupArtifactRepository.createBackupArtifact,
    getBackupArtifactById: backupArtifactRepository.getBackupArtifactById,
    listBackupArtifacts: backupArtifactRepository.listBackupArtifacts,
    packageJsonPath,
  }),
  systemBackupRestorePreviewService = backupRestorePreviewService ?? createBackupRestorePreviewService({
    getBackupArtifactById: backupArtifactRepository.getBackupArtifactById,
    listRestoreApplyBlockingLocks: maintenanceLockService.listRestoreApplyBlockingLocks,
  }),
  systemBackupRestoreApplyService = backupRestoreApplyService ?? createBackupRestoreApplyService({
    acquireMaintenanceLock: maintenanceLockService.acquireMaintenanceLock,
    getBackupArtifactById: backupArtifactRepository.getBackupArtifactById,
    getBackupRestorePreview: systemBackupRestorePreviewService.getBackupRestorePreview,
    releaseMaintenanceLock: maintenanceLockService.releaseMaintenanceLock,
    updateSettingsFn: settingsService.updateSettings,
  }),
  systemService = createSystemService({
    activityFeedService: systemActivityFeedService,
    appleMusicStatusService,
    artworkPolicyService,
    artworkSummaryService,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    libraryDiscoveryHeartbeatState,
    metadataRefreshHeartbeatConfig,
    metadataRefreshHeartbeatState,
    operatorNotificationService: systemOperatorNotificationService,
    operationHistoryService,
    spotifyOAuthService,
    startedAt,
    packageJsonPath,
    youtubeOAuthService,
    dependencyHealthService,
    settingsService,
  }),
} = {}) {
  const resolvedOperatorNotificationFanoutService = operatorNotificationFanoutService
    ?? createOperatorNotificationFanoutService({
      createOperationRun: operatorNotificationFanoutRunStore.createOperationRun,
      getActiveRun: operatorNotificationFanoutRunStore.getActiveRun,
      getOperatorNotifications: systemService.getOperatorNotifications,
    });
  const resolvedOperatorNotificationFanoutWorker = operatorNotificationFanoutWorker
    ?? createOperatorNotificationFanoutWorker({
      acquireLease: operatorNotificationFanoutRunStore.acquireLease,
      fanOutOperatorNotifications: resolvedOperatorNotificationFanoutService.fanOutOperatorNotifications,
      isCancellationRequested: operatorNotificationFanoutRunStore.isCancellationRequested,
      markRunCancelled: operatorNotificationFanoutRunStore.markRunCancelled,
      markRunCompleted: operatorNotificationFanoutRunStore.markRunCompleted,
      markRunFailed: operatorNotificationFanoutRunStore.markRunFailed,
      markRunStarted: operatorNotificationFanoutRunStore.markRunStarted,
      releaseLease: operatorNotificationFanoutRunStore.releaseLease,
      renewLease: operatorNotificationFanoutRunStore.renewLease,
    });

  return {
    activityFeedService: systemActivityFeedService,
    operatorNotificationService: systemOperatorNotificationService,
    backupArtifactRepository,
    backupExportService: systemBackupExportService,
    backupRestoreApplyService: systemBackupRestoreApplyService,
    backupRestorePreviewService: systemBackupRestorePreviewService,
    artworkPolicyService,
    artworkSummaryService,
    dependencyHealthService,
    operatorNotificationFanoutRunStore,
    operatorNotificationFanoutService: resolvedOperatorNotificationFanoutService,
    operatorNotificationFanoutWorker: resolvedOperatorNotificationFanoutWorker,
    libraryScanSummaryService,
    onboardingSummaryService,
    settingsService,
    systemService,
    routeDependencies: {
      appPort,
      getActivityFeed: systemService.getActivityFeed,
      getOperatorNotifications: systemService.getOperatorNotifications,
      createBackupExport: systemBackupExportService.createBackupExport,
      getBackupExportById: systemBackupExportService.getBackupExportById,
      getBackupRestorePreview: systemBackupRestorePreviewService.getBackupRestorePreview,
      startBackupRestoreApply: systemBackupRestoreApplyService.startBackupRestoreApply,
      listBackupExports: systemBackupExportService.listBackupExports,
      startOperatorNotificationFanoutRun: resolvedOperatorNotificationFanoutService.startOperatorNotificationFanoutRun,
      buildLibraryScanSummary: libraryScanSummaryService.buildLibraryScanSummary,
      buildOnboardingSummary: onboardingSummaryService.buildOnboardingSummary,
      getOverview: systemService.getOverview,
      buildSettingsPayload: settingsService.buildSettingsPayload,
      updateSettings: settingsService.updateSettings,
    },
  };
}

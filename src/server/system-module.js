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
import { createDiagnosticsExportService } from './diagnostics-export-service.js';
import { createSettingsService } from './settings-service.js';
import { createDependencyHealthService } from './dependency-health-service.js';
import { createOperationRunInterruptionGate } from './operation-run-cancellation.js';
import { createOperatorNotificationService } from './operator-notification-service.js';
import { createOperatorNotificationFanoutRunStore } from './operator-notification-fanout-run-store.js';
import { createOperatorNotificationFanoutService } from './operator-notification-fanout-service.js';
import { createOperatorNotificationFanoutWorker } from './operator-notification-fanout-worker.js';
import { createBackupArtifactRepository } from './recovery/backup-artifact-repository.js';
import { createBackupExportService } from './recovery/backup-export-service.js';
import { createBackupRestoreApplyService } from './recovery/backup-restore-apply-service.js';
import { createBackupRestorePreviewService } from './recovery/backup-restore-preview-service.js';
import { createAdminRecoveryService } from './recovery/admin-recovery-service.js';
import { createAdminRecoveryStore } from './recovery/admin-recovery-store.js';
import { createControlPlaneIdempotencyService } from './recovery/control-plane-idempotency-service.js';
import { createControlPlaneIdempotencyStore } from './recovery/control-plane-idempotency-store.js';
import { createIdempotencyRecordCleanupHeartbeat } from './recovery/idempotency-record-cleanup-heartbeat.js';
import { createMaintenanceLockControlService } from './recovery/maintenance-lock-control-service.js';
import { createMaintenanceLockOperationPauseService } from './recovery/maintenance-lock-operation-pause-service.js';
import { createMaintenanceLockService } from './recovery/maintenance-lock-service.js';
import { createRecoveryDiagnosticsService } from './recovery/recovery-diagnostics-service.js';
import { createRestoreScopeRuntimeSnapshotStore } from './recovery/restore-scope-runtime-snapshot-store.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library/library-discovery-heartbeat-config.js';
import { createRuntimeResourceMonitor } from './runtime-resource-monitor.js';
import { createRuntimeResourceService } from './runtime-resource-service.js';
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
  libraryDiscoveryHeartbeatConfig = resolveLibraryDiscoveryHeartbeatConfig(),
  libraryDiscoveryHeartbeatState = null,
  metadataRefreshHeartbeatConfig = null,
  metadataRefreshHeartbeatState = null,
  musicBrainzSearchService,
  backupArtifactRepository = createBackupArtifactRepository(),
  backupExportService = null,
  backupRestoreApplyService = null,
  backupRestorePreviewService = null,
  adminRecoveryService = null,
  adminRecoveryStore = createAdminRecoveryStore(),
  controlPlaneIdempotencyService = createControlPlaneIdempotencyService(),
  controlPlaneIdempotencyStore = createControlPlaneIdempotencyStore(),
  idempotencyRecordCleanupHeartbeat = null,
  maintenanceLockControlService = null,
  maintenanceLockService = createMaintenanceLockService(),
  maintenanceLockOperationPauseService = null,
  metadataMonitoringStore = null,
  recoveryDiagnosticsService = null,
  restoreScopeRuntimeSnapshotStore = createRestoreScopeRuntimeSnapshotStore(),
  libraryWantedReleaseStore = null,
  operatorNotificationService = null,
  operatorNotificationFanoutRunStore = createOperatorNotificationFanoutRunStore(),
  operatorNotificationFanoutService = null,
  operatorNotificationFanoutWorker = null,
  operationHistoryService = null,
  packageJsonPath,
  runtimeResourceMonitor = null,
  runtimeResourceService = createRuntimeResourceService(),
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
  resolvedAuditReadService = auditReadService ?? createAuditReadService(),
  systemActivityFeedService = activityFeedService ?? createActivityFeedService({
    auditReadService: resolvedAuditReadService,
    operationHistoryService,
  }),
  systemOperatorNotificationService = operatorNotificationService ?? createOperatorNotificationService(),
  systemBackupExportService = backupExportService ?? createBackupExportService({
    createBackupArtifact: backupArtifactRepository.createBackupArtifact,
    deleteBackupArtifactById: backupArtifactRepository.deleteBackupArtifactById,
    getBackupArtifactById: backupArtifactRepository.getBackupArtifactById,
    listArtistMonitoringForBackup: metadataMonitoringStore?.listArtistMonitoringSnapshot,
    listBackupArtifacts: backupArtifactRepository.listBackupArtifacts,
    listOverridesSnapshotForBackup: restoreScopeRuntimeSnapshotStore.listOverridesSnapshot,
    listTrustSnapshotForBackup: restoreScopeRuntimeSnapshotStore.listTrustSnapshot,
    listWantedReleasesForBackup: libraryWantedReleaseStore?.listLibraryWantedReleases,
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
    replaceOverridesSnapshot: restoreScopeRuntimeSnapshotStore.replaceOverridesSnapshot,
    replaceLibraryWantedReleases: libraryWantedReleaseStore?.replaceLibraryWantedReleases,
    replaceMetadataArtistMonitoring: metadataMonitoringStore?.replaceArtistMonitoringSnapshot,
    replaceTrustSnapshot: restoreScopeRuntimeSnapshotStore.replaceTrustSnapshot,
    releaseMaintenanceLock: maintenanceLockService.releaseMaintenanceLock,
    updateSettingsFn: settingsService.updateSettings,
  }),
  systemMaintenanceLockControlService = maintenanceLockControlService ?? createMaintenanceLockControlService({
    acquireMaintenanceLock: maintenanceLockService.acquireMaintenanceLock,
    getMaintenanceLockById: maintenanceLockService.getMaintenanceLockById,
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
    releaseMaintenanceLock: maintenanceLockService.releaseMaintenanceLock,
  }),
  systemAdminRecoveryService = adminRecoveryService ?? createAdminRecoveryService({
    adminRecoveryStore,
    maintenanceLockService,
  }),
  diagnosticsExportService = null,
  systemRuntimeResourceMonitor = runtimeResourceMonitor ?? createRuntimeResourceMonitor({
    heartbeatDefinitions: [
      {
        intervalMs: libraryDiscoveryHeartbeatConfig?.intervalMs ?? null,
        heartbeatState: libraryDiscoveryHeartbeatState,
        key: 'libraryDiscovery',
        label: 'Discovery dispatch',
      },
      {
        heartbeatState: importCandidateExecutionHeartbeatState,
        intervalMs: importCandidateExecutionHeartbeatConfig?.intervalMs ?? null,
        key: 'importExecution',
        label: 'Import reconciliation',
      },
      {
        heartbeatState: metadataRefreshHeartbeatState,
        intervalMs: metadataRefreshHeartbeatConfig?.intervalMs ?? null,
        key: 'metadataRefresh',
        label: 'Metadata refresh',
      },
    ],
    runtimeResourceService,
  }),
  systemService = createSystemService({
    activityFeedService: systemActivityFeedService,
    appleMusicStatusService,
    artworkPolicyService,
    artworkSummaryService,
    importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState,
    libraryDiscoveryHeartbeatConfig,
    libraryDiscoveryHeartbeatState,
    metadataRefreshHeartbeatConfig,
    metadataRefreshHeartbeatState,
    operatorNotificationService: systemOperatorNotificationService,
    operationHistoryService,
    spotifyOAuthService,
    startedAt,
    packageJsonPath,
    runtimeResourceMonitor: systemRuntimeResourceMonitor,
    runtimeResourceService,
    youtubeOAuthService,
    dependencyHealthService,
    settingsService,
  }),
} = {}) {
  const resolvedMaintenanceLockOperationPauseService = maintenanceLockOperationPauseService
    ?? createMaintenanceLockOperationPauseService({
      listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
    });
  const resolvedSystemRecoveryDiagnosticsService = recoveryDiagnosticsService
    ?? createRecoveryDiagnosticsService({
      listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
      listRecentAuditEvents: resolvedAuditReadService.listRecentAuditEvents,
      listRecentOperationRuns: operationHistoryService?.listRecentOperationRuns,
      resolveQueueDispatchReadiness: resolvedMaintenanceLockOperationPauseService.resolveDispatchReadiness,
    });
  const resolvedSystemDiagnosticsExportService = diagnosticsExportService
    ?? createDiagnosticsExportService({
      getOperatorNotifications: systemService.getOperatorNotifications,
      getOverview: systemService.getOverview,
      getQueueDiagnostics: resolvedSystemRecoveryDiagnosticsService.getQueueDiagnostics,
      getRecoveryDiagnostics: resolvedSystemRecoveryDiagnosticsService.getRecoveryDiagnostics,
    });
  const resolvedOperatorNotificationFanoutService = operatorNotificationFanoutService
    ?? createOperatorNotificationFanoutService({
      createOperationRun: operatorNotificationFanoutRunStore.createOperationRun,
      getActiveRun: operatorNotificationFanoutRunStore.getActiveRun,
      getOperatorNotifications: systemService.getOperatorNotifications,
    });
  const operatorNotificationFanoutInterruptionGate = resolvedMaintenanceLockOperationPauseService
    ? createOperationRunInterruptionGate({
      isCancellationRequested: operatorNotificationFanoutRunStore.isCancellationRequested,
      operationLabel: 'Operator notification fan-out',
      operationPauseService: resolvedMaintenanceLockOperationPauseService,
    })
    : operatorNotificationFanoutRunStore.isCancellationRequested;
  const resolvedOperatorNotificationFanoutWorker = operatorNotificationFanoutWorker
    ?? createOperatorNotificationFanoutWorker({
      acquireLease: operatorNotificationFanoutRunStore.acquireLease,
      fanOutOperatorNotifications: resolvedOperatorNotificationFanoutService.fanOutOperatorNotifications,
      isCancellationRequested: operatorNotificationFanoutInterruptionGate,
      markRunCancelled: operatorNotificationFanoutRunStore.markRunCancelled,
      markRunCompleted: operatorNotificationFanoutRunStore.markRunCompleted,
      markRunFailed: operatorNotificationFanoutRunStore.markRunFailed,
      markRunPaused: operatorNotificationFanoutRunStore.markRunPaused,
      markRunStarted: operatorNotificationFanoutRunStore.markRunStarted,
      releaseLease: operatorNotificationFanoutRunStore.releaseLease,
      renewLease: operatorNotificationFanoutRunStore.renewLease,
    });

  const resolvedIdempotencyRecordCleanupHeartbeat = idempotencyRecordCleanupHeartbeat
    ?? createIdempotencyRecordCleanupHeartbeat({
      deleteExpiredRecords: controlPlaneIdempotencyStore.deleteExpiredRecords,
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
    diagnosticsExportService: resolvedSystemDiagnosticsExportService,
    idempotencyRecordCleanupHeartbeat: resolvedIdempotencyRecordCleanupHeartbeat,
    operatorNotificationFanoutRunStore,
    operatorNotificationFanoutService: resolvedOperatorNotificationFanoutService,
    operatorNotificationFanoutWorker: resolvedOperatorNotificationFanoutWorker,
    adminRecoveryService: systemAdminRecoveryService,
    adminRecoveryStore,
    libraryScanSummaryService,
    onboardingSummaryService,
    runtimeResourceMonitor: systemRuntimeResourceMonitor,
    runtimeResourceService,
    settingsService,
    systemService,
    routeDependencies: {
      appPort,
      getActivityFeed: systemService.getActivityFeed,
      getOperatorNotifications: systemService.getOperatorNotifications,
      createBackupExport: systemBackupExportService.createBackupExport,
      deleteBackupExportById: systemBackupExportService.deleteBackupExportById,
      getBackupExportById: systemBackupExportService.getBackupExportById,
      getBackupExportDownloadById: systemBackupExportService.getBackupExportDownloadById,
      getBackupRestorePreview: systemBackupRestorePreviewService.getBackupRestorePreview,
      getMaintenanceLockStatus: systemMaintenanceLockControlService.getMaintenanceLockStatus,
      enterMaintenanceLock: systemMaintenanceLockControlService.enterMaintenanceLock,
      releaseMaintenanceLockById: systemMaintenanceLockControlService.releaseMaintenanceLockById,
      getQueueDiagnostics: resolvedSystemRecoveryDiagnosticsService.getQueueDiagnostics,
      getRecoveryDiagnostics: resolvedSystemRecoveryDiagnosticsService.getRecoveryDiagnostics,
      getDiagnosticsExportDownload: resolvedSystemDiagnosticsExportService.getDiagnosticsExportDownload,
      startBackupRestoreApply: systemBackupRestoreApplyService.startBackupRestoreApply,
      executeIdempotentMutation: controlPlaneIdempotencyService.executeIdempotentMutation,
      listBackupExports: systemBackupExportService.listBackupExports,
      startOperatorNotificationFanoutRun: resolvedOperatorNotificationFanoutService.startOperatorNotificationFanoutRun,
      buildLibraryScanSummary: libraryScanSummaryService.buildLibraryScanSummary,
      buildOnboardingSummary: onboardingSummaryService.buildOnboardingSummary,
      getOverview: systemService.getOverview,
      buildSettingsPayload: settingsService.buildSettingsPayload,
      updateSettings: settingsService.updateSettings,
      getBootstrapAdminRecoveryStatus: systemAdminRecoveryService.getBootstrapAdminRecoveryStatus,
      completeBootstrapAdminRecovery: systemAdminRecoveryService.completeBootstrapAdminRecovery,
    },
  };
}

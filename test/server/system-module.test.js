import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaintenanceLockOperationPauseService } from '../../src/server/recovery/maintenance-lock-operation-pause-service.js';
import { createSystemModule } from '../../src/server/system-module.js';

test('createSystemModule exposes shared route dependencies from injected services', () => {
  const artworkPolicyService = {
    buildArtworkOverview: () => {},
  };
  const artworkSummaryService = {
    buildArtworkSummary: () => {},
  };
  const buildLibraryScanSummary = () => {};
  const buildOnboardingSummary = () => {};
  const buildSettingsPayload = () => {};
  const updateSettings = () => {};
  const getOverview = () => {};
  const getActivityFeed = () => {};
  const createBackupExport = () => {};
  const deleteBackupExportById = () => {};
  const getBackupExportById = () => {};
  const getBackupExportDownloadById = () => {};
  const getBackupRestorePreview = () => {};
  const getMaintenanceLockStatus = () => {};
  const getQueueDiagnostics = () => {};
  const getRecoveryDiagnostics = () => {};
  const getDiagnosticsExportDownload = () => {};
  const listBackupExports = () => {};
  const enterMaintenanceLock = () => {};
  const startBackupRestoreApply = () => {};
  const releaseMaintenanceLockById = () => {};
  const executeIdempotentMutation = () => {};
  const getOperatorNotifications = () => {};
  const startOperatorNotificationFanoutRun = () => {};
  const dependencyHealthService = {
    getDependencyHealth: () => [],
  };
  const libraryScanSummaryService = {
    buildLibraryScanSummary,
  };
  const onboardingSummaryService = {
    buildOnboardingSummary,
  };
  const settingsService = {
    buildSettingsPayload,
    updateSettings,
  };
  const systemService = {
    getActivityFeed,
    getOperatorNotifications,
    getOverview,
  };
  const operatorNotificationFanoutRunStore = {};
  const operatorNotificationFanoutService = {
    startOperatorNotificationFanoutRunIfNeeded: () => {},
    startOperatorNotificationFanoutRun,
  };
  const operatorNotificationFanoutHeartbeat = {};
  const operatorNotificationFanoutWorker = {};
  const backupArtifactRepository = {};
  const backupExportService = {
    createBackupExport,
    deleteBackupExportById,
    getBackupExportById,
    getBackupExportDownloadById,
    listBackupExports,
  };
  const backupRestorePreviewService = {
    getBackupRestorePreview,
  };
  const backupRestoreApplyService = {
    startBackupRestoreApply,
  };
  const maintenanceLockControlService = {
    enterMaintenanceLock,
    getMaintenanceLockStatus,
    releaseMaintenanceLockById,
  };
  const recoveryDiagnosticsService = {
    getQueueDiagnostics,
    getRecoveryDiagnostics,
  };
  const diagnosticsExportService = {
    getDiagnosticsExportDownload,
  };

  const systemModule = createSystemModule({
    appPort: 4312,
    artworkPolicyService,
    artworkSummaryService,
    backupArtifactRepository,
    backupExportService,
    backupRestoreApplyService,
    backupRestorePreviewService,
    maintenanceLockControlService,
    controlPlaneIdempotencyService: {
      executeIdempotentMutation,
    },
    diagnosticsExportService,
    recoveryDiagnosticsService,
    dependencyHealthService,
    libraryScanSummaryService,
    onboardingSummaryService,
    operatorNotificationFanoutRunStore,
    operatorNotificationFanoutService,
    operatorNotificationFanoutHeartbeat,
    operatorNotificationFanoutWorker,
    packageJsonPath: 'ignored-for-test',
    startedAt: new Date('2026-04-28T00:00:00.000Z'),
    settingsService,
    systemService,
  });

  assert.equal(systemModule.artworkPolicyService, artworkPolicyService);
  assert.equal(systemModule.artworkSummaryService, artworkSummaryService);
  assert.equal(systemModule.dependencyHealthService, dependencyHealthService);
  assert.equal(systemModule.backupArtifactRepository, backupArtifactRepository);
  assert.equal(systemModule.backupExportService, backupExportService);
  assert.equal(systemModule.operatorNotificationFanoutRunStore, operatorNotificationFanoutRunStore);
  assert.equal(systemModule.operatorNotificationFanoutService, operatorNotificationFanoutService);
  assert.equal(systemModule.operatorNotificationFanoutHeartbeat, operatorNotificationFanoutHeartbeat);
  assert.equal(systemModule.operatorNotificationFanoutWorker, operatorNotificationFanoutWorker);
  assert.equal(systemModule.libraryScanSummaryService, libraryScanSummaryService);
  assert.equal(systemModule.onboardingSummaryService, onboardingSummaryService);
  assert.equal(systemModule.settingsService, settingsService);
  assert.equal(systemModule.systemService, systemService);
  assert.deepEqual(systemModule.routeDependencies, {
    appPort: 4312,
    buildLibraryScanSummary,
    buildOnboardingSummary,
    getActivityFeed,
    createBackupExport,
    deleteBackupExportById,
    getBackupExportById,
    getBackupExportDownloadById,
    getBackupRestorePreview,
    getMaintenanceLockStatus,
    enterMaintenanceLock,
    releaseMaintenanceLockById,
    getQueueDiagnostics,
    getRecoveryDiagnostics,
    getDiagnosticsExportDownload,
    startBackupRestoreApply,
    executeIdempotentMutation,
    listBackupExports,
    getOperatorNotifications,
    startOperatorNotificationFanoutRun,
    getOverview,
    buildSettingsPayload,
    updateSettings,
    getBootstrapAdminRecoveryStatus: systemModule.adminRecoveryService.getBootstrapAdminRecoveryStatus,
    completeBootstrapAdminRecovery: systemModule.adminRecoveryService.completeBootstrapAdminRecovery,
  });
});

test('createSystemModule builds recovery diagnostics after pause service initialization', () => {
  const maintenanceLockOperationPauseService = createMaintenanceLockOperationPauseService({
    listActiveMaintenanceLocks: async () => [],
  });

  const systemModule = createSystemModule({
    activityFeedService: {
      getActivityFeed: () => [],
    },
    appPort: 4312,
    artworkPolicyService: {
      buildArtworkOverview: () => {},
    },
    artworkSummaryService: {
      buildArtworkSummary: () => {},
    },
    auditReadService: {
      listRecentAuditEvents: async () => [],
    },
    backupExportService: {
      createBackupExport: () => {},
      deleteBackupExportById: () => {},
      getBackupExportById: () => {},
      getBackupExportDownloadById: () => {},
      listBackupExports: () => [],
    },
    backupRestoreApplyService: {
      startBackupRestoreApply: () => {},
    },
    backupRestorePreviewService: {
      getBackupRestorePreview: () => {},
    },
    controlPlaneIdempotencyService: {
      executeIdempotentMutation: () => {},
    },
    dependencyHealthService: {
      getDependencyHealth: () => [],
    },
    diagnosticsExportService: {
      getDiagnosticsExportDownload: () => {},
    },
    libraryScanSummaryService: {
      buildLibraryScanSummary: () => {},
    },
    maintenanceLockControlService: {
      enterMaintenanceLock: () => {},
      getMaintenanceLockStatus: () => {},
      releaseMaintenanceLockById: () => {},
    },
    maintenanceLockOperationPauseService,
    maintenanceLockService: {
      acquireMaintenanceLock: () => {},
      getMaintenanceLockById: () => {},
      listActiveMaintenanceLocks: async () => [],
      listRestoreApplyBlockingLocks: async () => [],
      releaseMaintenanceLock: () => {},
    },
    onboardingSummaryService: {
      buildOnboardingSummary: () => {},
    },
    operationHistoryService: {
      listRecentOperationRuns: async () => [],
    },
    operatorNotificationFanoutRunStore: {},
    operatorNotificationFanoutService: {
      startOperatorNotificationFanoutRunIfNeeded: () => {},
      startOperatorNotificationFanoutRun: () => {},
    },
    operatorNotificationFanoutHeartbeat: {},
    operatorNotificationFanoutWorker: {},
    packageJsonPath: 'ignored-for-test',
    settingsService: {
      buildSettingsPayload: () => ({}),
      updateSettings: () => {},
    },
    startedAt: new Date('2026-04-28T00:00:00.000Z'),
    systemService: {
      getActivityFeed: () => [],
      getOperatorNotifications: () => [],
      getOverview: () => ({}),
    },
  });

  assert.equal(typeof systemModule.routeDependencies.getQueueDiagnostics, 'function');
  assert.equal(typeof systemModule.routeDependencies.getRecoveryDiagnostics, 'function');
});

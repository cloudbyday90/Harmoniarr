import assert from 'node:assert/strict';
import test from 'node:test';
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
  const getBackupExportById = () => {};
  const getBackupRestorePreview = () => {};
  const listBackupExports = () => {};
  const startBackupRestoreApply = () => {};
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
    startOperatorNotificationFanoutRun,
  };
  const operatorNotificationFanoutWorker = {};
  const backupArtifactRepository = {};
  const backupExportService = {
    createBackupExport,
    getBackupExportById,
    listBackupExports,
  };
  const backupRestorePreviewService = {
    getBackupRestorePreview,
  };
  const backupRestoreApplyService = {
    startBackupRestoreApply,
  };

  const systemModule = createSystemModule({
    appPort: 4312,
    artworkPolicyService,
    artworkSummaryService,
    backupArtifactRepository,
    backupExportService,
    backupRestoreApplyService,
    backupRestorePreviewService,
    dependencyHealthService,
    libraryScanSummaryService,
    onboardingSummaryService,
    operatorNotificationFanoutRunStore,
    operatorNotificationFanoutService,
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
    getBackupExportById,
    getBackupRestorePreview,
    startBackupRestoreApply,
    listBackupExports,
    getOperatorNotifications,
    startOperatorNotificationFanoutRun,
    getOverview,
    buildSettingsPayload,
    updateSettings,
  });
});

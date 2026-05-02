import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createBackupRestoreApplyService } from '../../src/server/recovery/backup-restore-apply-service.js';

test('startBackupRestoreApply acquires and releases restore lock, persists run state, and applies settings scope', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({ id: 'run-restore-1' }));
  const markRunStarted = t.mock.fn(async () => {});
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const getRunById = t.mock.fn(async () => ({
    id: 'run-restore-1',
    status: 'completed',
    summary: {
      currentStep: 'Restore apply completed',
    },
  }));
  const acquireMaintenanceLock = t.mock.fn(async () => ({ id: 'lock-1', lockType: 'restore', status: 'active' }));
  const releaseMaintenanceLock = t.mock.fn(async () => ({ id: 'lock-1', lockType: 'restore', status: 'released' }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const updateSettingsFn = t.mock.fn(async () => ({}));

  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock,
    createOperationRun,
    getBackupArtifactById: async () => ({
      id: 'backup-1',
      payloadSha256: 'sha-1',
      storagePath: '/backups/backup-1.json',
      backupType: 'logical',
      formatVersion: '1',
      migrationLevel: 'applied:10',
      scope: ['settings'],
      createdAt: '2026-05-02T12:00:00.000Z',
      createdByUserId: 'user-1',
      encrypted: false,
      appVersion: '0.1.0-beta',
      fileSizeBytes: 256,
      filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
    }),
    getBackupRestorePreview: async () => ({
      canApplyRestore: true,
      restoreReadiness: {
        blockedByLock: false,
      },
    }),
    getOperationRunById: getRunById,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    readBackupPayloadFn: async () => JSON.stringify({
      data: {
        settings: {
          system: {
            logLevel: 'debug',
          },
        },
      },
    }),
    recordAuditEventFn,
    releaseMaintenanceLock,
    updateSettingsFn,
  });

  const result = await service.startBackupRestoreApply({
    backupArtifactId: 'backup-1',
    expectedPayloadSha256: 'sha-1',
    requestMetadata: {
      ipAddress: '198.51.100.4',
      userAgent: 'HarmoniarrRestoreApplyTest/1.0',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(createOperationRun.mock.callCount(), 1);
  assert.equal(markRunStarted.mock.callCount(), 1);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(acquireMaintenanceLock.mock.callCount(), 1);
  assert.equal(releaseMaintenanceLock.mock.callCount(), 1);
  assert.equal(updateSettingsFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 2);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.restoreResult, {
    appliedScopes: ['settings'],
    settingsUpdated: true,
  });
});

test('startBackupRestoreApply rejects stale checksum expectations before run creation', async () => {
  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock: async () => ({ id: 'lock-1' }),
    createOperationRun: async () => ({ id: 'run-restore-2' }),
    getBackupArtifactById: async () => ({
      id: 'backup-2',
      payloadSha256: 'sha-live',
      storagePath: '/backups/backup-2.json',
    }),
    getBackupRestorePreview: async () => ({ canApplyRestore: true }),
    getOperationRunById: async () => ({ id: 'run-restore-2' }),
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    releaseMaintenanceLock: async () => {},
    updateSettingsFn: async () => ({}),
  });

  await assert.rejects(
    () => service.startBackupRestoreApply({
      backupArtifactId: 'backup-2',
      expectedPayloadSha256: 'sha-stale',
    }),
    (error) => error.code === 'backup_restore_stale_manifest',
  );
});

test('startBackupRestoreApply returns lock conflict when preview readiness reports blocking locks', async () => {
  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock: async () => ({ id: 'lock-1' }),
    createOperationRun: async () => ({ id: 'run-restore-3' }),
    getBackupArtifactById: async () => ({
      id: 'backup-3',
      payloadSha256: 'sha-3',
      storagePath: '/backups/backup-3.json',
    }),
    getBackupRestorePreview: async () => ({
      canApplyRestore: false,
      restoreReadiness: {
        blockedByLock: true,
      },
    }),
    getOperationRunById: async () => ({ id: 'run-restore-3' }),
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunStarted: async () => {},
    releaseMaintenanceLock: async () => {},
    updateSettingsFn: async () => ({}),
  });

  await assert.rejects(
    () => service.startBackupRestoreApply({ backupArtifactId: 'backup-3' }),
    (error) => error.code === 'recovery_lock_conflict',
  );
});

test('startBackupRestoreApply marks run failed and releases lock when restore apply throws', async (t) => {
  const markRunFailed = t.mock.fn(async () => {});
  const releaseMaintenanceLock = t.mock.fn(async () => {});

  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock: async () => ({ id: 'lock-2' }),
    createOperationRun: async () => ({ id: 'run-restore-4' }),
    getBackupArtifactById: async () => ({
      id: 'backup-4',
      payloadSha256: 'sha-4',
      storagePath: '/backups/backup-4.json',
    }),
    getBackupRestorePreview: async () => ({
      canApplyRestore: true,
      restoreReadiness: {
        blockedByLock: false,
      },
    }),
    getOperationRunById: async () => ({ id: 'run-restore-4' }),
    markRunCompleted: async () => {},
    markRunFailed,
    markRunStarted: async () => {},
    readBackupPayloadFn: async () => JSON.stringify({
      data: {
        settings: {
          system: {
            logLevel: 'debug',
          },
        },
      },
    }),
    recordAuditEventFn: async () => {},
    releaseMaintenanceLock,
    updateSettingsFn: async () => {
      throw createApiError(500, 'settings_update_failed', 'Could not persist settings');
    },
  });

  await assert.rejects(
    () => service.startBackupRestoreApply({
      backupArtifactId: 'backup-4',
      triggeredByUserId: 'user-7',
    }),
    (error) => error.code === 'settings_update_failed',
  );

  assert.equal(markRunFailed.mock.callCount(), 1);
  assert.equal(releaseMaintenanceLock.mock.callCount(), 1);
});

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
  const replaceOverridesSnapshot = t.mock.fn(async () => {});
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const replaceMetadataArtistMonitoring = t.mock.fn(async () => {});
  const replaceTrustSnapshot = t.mock.fn(async () => {});
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
      scope: ['providers', 'pathMappings', 'monitoring', 'wanted', 'trust', 'overrides', 'settings'],
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
        scopeSettings: {
          pathMappings: {
            paths: {
              downloadMappings: [{ localPathPrefix: '/downloads', remotePathPrefix: '/downloads' }],
            },
          },
          providers: {
            providers: {
              spotifyEnabled: true,
            },
            slskd: {
              baseUrl: 'http://slskd:5030',
            },
          },
          monitoring: {
            artistMonitoring: [
              {
                metadataArtistId: 'artist-1',
                isMonitored: true,
                monitoredReleaseGroupTypes: ['album', 'ep'],
              },
            ],
          },
          wanted: {
            wantedReleases: [
              {
                metadataArtistId: 'artist-1',
                metadataReleaseGroupId: 'rg-1',
                metadataReleaseId: 'release-1',
                wantedStatus: 'missing',
                expectedTrackCount: 10,
                matchedTrackCount: 0,
                missingTrackCount: 10,
                releaseDate: '2026-01-01',
                releaseStatus: 'Official',
                evidence: {
                  strategy: 'restore_snapshot',
                },
              },
            ],
          },
          trust: {
            sourceUsers: [
              {
                username: 'trusted-uploader',
                trustState: 'trusted',
              },
            ],
          },
          overrides: {
            manualOverrides: [
              {
                scope: 'release',
                targetId: 'release-1',
                decision: 'prefer',
              },
            ],
          },
        },
        settings: {
          system: {
            logLevel: 'debug',
          },
        },
      },
    }),
    replaceOverridesSnapshot,
    recordAuditEventFn,
    replaceLibraryWantedReleases,
    replaceMetadataArtistMonitoring,
    replaceTrustSnapshot,
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
  assert.equal(replaceOverridesSnapshot.mock.callCount(), 1);
  assert.equal(replaceLibraryWantedReleases.mock.callCount(), 1);
  assert.equal(replaceMetadataArtistMonitoring.mock.callCount(), 1);
  assert.equal(replaceTrustSnapshot.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 2);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.restoreResult, {
    appliedScopes: ['monitoring', 'wanted', 'trust', 'overrides', 'providers', 'pathMappings', 'settings'],
    monitoringUpdated: true,
    overridesUpdated: true,
    requestedScopes: ['providers', 'pathMappings', 'monitoring', 'wanted', 'trust', 'overrides', 'settings'],
    skippedScopes: [],
    settingsUpdated: true,
    trustUpdated: true,
    wantedUpdated: true,
  });
  assert.deepEqual(updateSettingsFn.mock.calls[0].arguments[0].patch, {
    paths: {
      downloadMappings: [{ localPathPrefix: '/downloads', remotePathPrefix: '/downloads' }],
    },
    providers: {
      spotifyEnabled: true,
    },
    slskd: {
      baseUrl: 'http://slskd:5030',
    },
    system: {
      logLevel: 'debug',
    },
  });
});

test('startBackupRestoreApply preserves a completed restore result when lock release cleanup fails', async (t) => {
  const markRunCompleted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const onReleaseMaintenanceLockError = t.mock.fn(async () => {});
  const releaseMaintenanceLock = t.mock.fn(async () => {
    throw new Error('lock release unavailable');
  });

  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock: async () => ({ id: 'lock-cleanup-1', lockType: 'restore', status: 'active' }),
    createOperationRun: async () => ({ id: 'run-restore-cleanup-1' }),
    getBackupArtifactById: async () => ({
      id: 'backup-cleanup-1',
      payloadSha256: 'sha-cleanup-1',
      storagePath: '/backups/backup-cleanup-1.json',
      scope: ['settings'],
    }),
    getBackupRestorePreview: async () => ({
      canApplyRestore: true,
      restoreReadiness: {
        blockedByLock: false,
      },
    }),
    getOperationRunById: async () => ({
      id: 'run-restore-cleanup-1',
      status: 'completed',
      summary: {
        currentStep: 'Restore apply completed',
      },
    }),
    markRunCompleted,
    markRunFailed,
    markRunStarted: async () => {},
    onReleaseMaintenanceLockError,
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
    updateSettingsFn: async () => ({}),
  });

  const result = await service.startBackupRestoreApply({
    backupArtifactId: 'backup-cleanup-1',
    triggeredByUserId: 'user-cleanup-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(markRunCompleted.mock.callCount(), 1);
  assert.equal(markRunFailed.mock.callCount(), 0);
  assert.equal(releaseMaintenanceLock.mock.callCount(), 1);
  assert.equal(onReleaseMaintenanceLockError.mock.callCount(), 1);
  assert.deepEqual(onReleaseMaintenanceLockError.mock.calls[0].arguments[1], {
    backupArtifactId: 'backup-cleanup-1',
    lockId: 'lock-cleanup-1',
    restoreCompleted: true,
    runId: 'run-restore-cleanup-1',
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

test('startBackupRestoreApply rejects artifacts when no supported scope payload exists', async (t) => {
  const markRunFailed = t.mock.fn(async () => {});

  const service = createBackupRestoreApplyService({
    acquireMaintenanceLock: async () => ({ id: 'lock-9' }),
    createOperationRun: async () => ({ id: 'run-restore-9' }),
    getBackupArtifactById: async () => ({
      id: 'backup-9',
      payloadSha256: 'sha-9',
      storagePath: '/backups/backup-9.json',
      scope: ['monitoring', 'wanted'],
    }),
    getBackupRestorePreview: async () => ({
      canApplyRestore: true,
      restoreReadiness: {
        blockedByLock: false,
      },
    }),
    getOperationRunById: async () => ({ id: 'run-restore-9' }),
    markRunCompleted: async () => {},
    markRunFailed,
    markRunStarted: async () => {},
    readBackupPayloadFn: async () => JSON.stringify({
      data: {
        scopeSettings: {},
      },
    }),
    recordAuditEventFn: async () => {},
    releaseMaintenanceLock: async () => {},
    updateSettingsFn: async () => ({}),
  });

  await assert.rejects(
    () => service.startBackupRestoreApply({ backupArtifactId: 'backup-9' }),
    (error) => error.code === 'backup_restore_scope_payload_missing',
  );

  assert.equal(markRunFailed.mock.callCount(), 1);
});

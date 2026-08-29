import assert from 'node:assert/strict';
import test from 'node:test';
import { useRecoveryBackups } from '../../src/client/composables/useRecoveryBackups.js';

function createBackupPreview(id, { canApplyRestore = true } = {}) {
  return {
    backupArtifact: { id },
    canApplyRestore,
    checkedAt: '2026-05-03T12:00:00.000Z',
    compatibility: {
      checks: [{
        code: 'payload_checksum_match',
        message: 'Payload checksum matches persisted metadata.',
        status: 'passed',
      }],
      compatible: canApplyRestore,
      currentMigrationLevel: 'applied:12',
    },
    integrity: {
      actualPayloadSha256: `${id}-sha`,
      expectedPayloadSha256: `${id}-sha`,
      status: 'passed',
    },
    restoreReadiness: {
      blockedByLock: false,
      blockingLocks: [],
    },
  };
}

test('useRecoveryBackups loads backup inventory and selects the latest backup by default', async () => {
  const workflow = useRecoveryBackups({
    fetchBackupExports: async () => ({
      backupArtifacts: [{
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: 'harmoniarr_backup_1.json',
        id: 'backup-1',
      }],
    }),
    fetchBackupExportById: async (backupArtifactId) => ({
      backupArtifact: {
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: 'harmoniarr_backup_1.json',
        id: backupArtifactId,
      },
    }),
    fetchBackupRestorePreview: async (backupArtifactId) => createBackupPreview(backupArtifactId),
  });

  await workflow.loadBackups();

  assert.equal(workflow.backupArtifacts.value.length, 1);
  assert.equal(workflow.selectedBackupId.value, 'backup-1');
  assert.equal(workflow.selectedBackupArtifact.value.filename, 'harmoniarr_backup_1.json');
  assert.equal(workflow.selectedBackupPreview.value.canApplyRestore, true);
});

test('useRecoveryBackups preserves a preferred backup id outside the current inventory page', async (t) => {
  const fetchBackupExportById = t.mock.fn(async (backupArtifactId) => ({
    backupArtifact: {
      createdAt: '2026-05-03T10:00:00.000Z',
      filename: `${backupArtifactId}.json`,
      id: backupArtifactId,
    },
  }));
  const fetchBackupRestorePreview = t.mock.fn(async (backupArtifactId) => createBackupPreview(backupArtifactId));
  const workflow = useRecoveryBackups({
    fetchBackupExports: async () => ({
      backupArtifacts: [{
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: 'latest.json',
        id: 'backup-latest',
      }],
    }),
    fetchBackupExportById,
    fetchBackupRestorePreview,
  });

  await workflow.loadBackups({ preferredBackupArtifactId: 'backup-older-7' });

  assert.equal(fetchBackupExportById.mock.calls[0].arguments[0], 'backup-older-7');
  assert.equal(fetchBackupRestorePreview.mock.calls[0].arguments[0], 'backup-older-7');
  assert.equal(workflow.selectedBackupId.value, 'backup-older-7');
});

test('useRecoveryBackups creates a backup and reloads the selected backup detail', async (t) => {
  let listCallCount = 0;
  const workflow = useRecoveryBackups({
    fetchBackupExports: async () => {
      listCallCount += 1;
      return listCallCount === 1
        ? { backupArtifacts: [] }
        : {
            backupArtifacts: [{
              createdAt: '2026-05-03T12:10:00.000Z',
              filename: 'new-backup.json',
              id: 'backup-new',
            }],
          };
    },
    fetchBackupExportById: async (backupArtifactId) => ({
      backupArtifact: {
        createdAt: '2026-05-03T12:10:00.000Z',
        filename: 'new-backup.json',
        id: backupArtifactId,
      },
    }),
    fetchBackupRestorePreview: async (backupArtifactId) => createBackupPreview(backupArtifactId),
    startBackupExport: t.mock.fn(async () => ({
      accepted: true,
      backupArtifact: {
        id: 'backup-new',
      },
    })),
  });

  await workflow.loadBackups();
  const result = await workflow.createBackup();

  assert.equal(result.accepted, true);
  assert.equal(workflow.lastCreatedBackupArtifact.value.id, 'backup-new');
  assert.equal(workflow.selectedBackupId.value, 'backup-new');
  assert.equal(workflow.selectedBackupArtifact.value.filename, 'new-backup.json');
});

test('useRecoveryBackups clears the prior created backup when the next creation fails', async () => {
  let createAttempt = 0;
  const workflow = useRecoveryBackups({
    fetchBackupExports: async () => ({ backupArtifacts: [] }),
    startBackupExport: async () => {
      createAttempt += 1;
      if (createAttempt === 1) {
        return {
          accepted: true,
          backupArtifact: { id: 'backup-new' },
        };
      }

      throw new Error('Backup storage is unavailable');
    },
  });

  await workflow.createBackup();
  assert.equal(workflow.lastCreatedBackupArtifact.value.id, 'backup-new');

  const result = await workflow.createBackup();

  assert.equal(result, null);
  assert.equal(workflow.lastCreatedBackupArtifact.value, null);
  assert.equal(workflow.actionErrorMessage.value, 'Backup storage is unavailable');
});

test('useRecoveryBackups deletes the selected backup and selects the next available artifact', async () => {
  let listCallCount = 0;
  const workflow = useRecoveryBackups({
    deleteBackupExport: async () => ({
      accepted: true,
      backupArtifact: { id: 'backup-1' },
    }),
    fetchBackupExports: async () => {
      listCallCount += 1;
      return listCallCount === 1
        ? {
            backupArtifacts: [
              { createdAt: '2026-05-03T11:00:00.000Z', filename: 'backup-1.json', id: 'backup-1' },
              { createdAt: '2026-05-03T10:00:00.000Z', filename: 'backup-2.json', id: 'backup-2' },
            ],
          }
        : {
            backupArtifacts: [
              { createdAt: '2026-05-03T10:00:00.000Z', filename: 'backup-2.json', id: 'backup-2' },
            ],
          };
    },
    fetchBackupExportById: async (backupArtifactId) => ({
      backupArtifact: {
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: `${backupArtifactId}.json`,
        id: backupArtifactId,
      },
    }),
    fetchBackupRestorePreview: async (backupArtifactId) => createBackupPreview(backupArtifactId),
  });

  await workflow.loadBackups();
  const result = await workflow.deleteSelectedBackup();

  assert.equal(result.accepted, true);
  assert.equal(workflow.selectedBackupId.value, 'backup-2');
  assert.equal(workflow.backupArtifacts.value.length, 1);
});

test('useRecoveryBackups records the latest restore run summary after apply', async () => {
  const workflow = useRecoveryBackups({
    fetchBackupExports: async () => ({
      backupArtifacts: [{
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: 'backup-1.json',
        id: 'backup-1',
      }],
    }),
    fetchBackupExportById: async (backupArtifactId) => ({
      backupArtifact: {
        createdAt: '2026-05-03T11:00:00.000Z',
        filename: 'backup-1.json',
        id: backupArtifactId,
      },
    }),
    fetchBackupRestorePreview: async (backupArtifactId) => createBackupPreview(backupArtifactId),
    startBackupRestoreApply: async () => ({
      accepted: true,
      restoreResult: {
        appliedScopes: ['settings'],
        requestedScopes: ['settings'],
        skippedScopes: [],
      },
      run: {
        id: 'restore-run-1',
        operationType: 'backup_restore_apply',
      },
    }),
  });

  await workflow.loadBackups();
  const result = await workflow.applyRestore({ expectedPayloadSha256: 'backup-1-sha' });

  assert.equal(result.accepted, true);
  assert.equal(workflow.lastRestoreRun.value.id, 'restore-run-1');
  assert.deepEqual(workflow.lastRestoreResult.value.appliedScopes, ['settings']);
});

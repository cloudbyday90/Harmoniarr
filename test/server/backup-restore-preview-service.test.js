import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { createBackupEncryptionService } from '../../src/server/recovery/backup-encryption-service.js';
import { createBackupRestorePreviewService } from '../../src/server/recovery/backup-restore-preview-service.js';

test('getBackupRestorePreview returns compatible preview when checks pass and no lock blocks apply', async () => {
  const serializedBackup = JSON.stringify({
    formatVersion: '1',
    backup: {
      type: 'logical',
    },
  });

  const service = createBackupRestorePreviewService({
    getBackupArtifactById: async () => ({
      id: 'backup-1',
      filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
      backupType: 'logical',
      formatVersion: '1',
      migrationLevel: 'applied:42',
      scope: ['settings'],
      createdAt: '2026-05-02T12:00:00.000Z',
      createdByUserId: 'user-1',
      encrypted: false,
      appVersion: '0.1.0-beta',
      fileSizeBytes: serializedBackup.length,
      payloadSha256: 'sha-1',
      storagePath: '/backups/backup-1.json',
    }),
    getMigrationStatusFn: async () => ({
      applied: 42,
      pending: [],
    }),
    listRestoreApplyBlockingLocks: async () => [],
    nowFn: () => new Date('2026-05-02T12:30:00.000Z'),
    readBackupPayloadFn: async () => serializedBackup,
    sha256Fn: () => 'sha-1',
  });

  const preview = await service.getBackupRestorePreview({ backupArtifactId: 'backup-1' });

  assert.equal(preview.integrity.status, 'passed');
  assert.equal(preview.compatibility.compatible, true);
  assert.equal(preview.restoreReadiness.blockedByLock, false);
  assert.equal(preview.canApplyRestore, true);
  assert.equal(preview.compatibility.currentMigrationLevel, 'applied:42');
});

test('getBackupRestorePreview reports lock conflict and compatibility failure when schema is newer', async () => {
  const serializedBackup = JSON.stringify({
    formatVersion: '1',
    backup: {
      type: 'logical',
    },
  });

  const service = createBackupRestorePreviewService({
    getBackupArtifactById: async () => ({
      id: 'backup-2',
      filename: 'harmoniarr_backup_2026-05-03T12-00-00-000Z.json',
      backupType: 'logical',
      formatVersion: '1',
      migrationLevel: 'applied:99',
      scope: ['settings'],
      createdAt: '2026-05-03T12:00:00.000Z',
      createdByUserId: 'user-2',
      encrypted: false,
      appVersion: '0.1.0-beta',
      fileSizeBytes: serializedBackup.length,
      payloadSha256: 'sha-2',
      storagePath: '/backups/backup-2.json',
    }),
    getMigrationStatusFn: async () => ({
      applied: 42,
      pending: [],
    }),
    listRestoreApplyBlockingLocks: async () => ([{
      id: 'lock-1',
      lockType: 'upgrade',
      status: 'active',
      reason: 'upgrade in progress',
      acquiredAt: '2026-05-03T12:05:00.000Z',
      expiresAt: null,
      acquiredByUserId: 'user-admin',
    }]),
    nowFn: () => new Date('2026-05-03T12:30:00.000Z'),
    readBackupPayloadFn: async () => serializedBackup,
    sha256Fn: () => 'sha-2',
  });

  const preview = await service.getBackupRestorePreview({ backupArtifactId: 'backup-2' });

  assert.equal(preview.integrity.status, 'passed');
  assert.equal(preview.compatibility.compatible, false);
  assert.equal(preview.restoreReadiness.blockedByLock, true);
  assert.equal(preview.restoreReadiness.blockingLocks.length, 1);
  assert.equal(preview.restoreReadiness.blockingLocks[0].reason, 'upgrade in progress');
  assert.equal(preview.canApplyRestore, false);
  assert.equal(
    preview.compatibility.checks.some((check) => check.code === 'backup_requires_newer_schema'),
    true,
  );
});

test('getBackupRestorePreview redacts blocking lock reason details before returning preview payload', async () => {
  const serializedBackup = JSON.stringify({
    formatVersion: '1',
    backup: {
      type: 'logical',
    },
  });

  const service = createBackupRestorePreviewService({
    getBackupArtifactById: async () => ({
      id: 'backup-3',
      filename: 'harmoniarr_backup_2026-05-03T12-00-00-000Z.json',
      backupType: 'logical',
      formatVersion: '1',
      migrationLevel: 'applied:42',
      scope: ['settings'],
      createdAt: '2026-05-03T12:00:00.000Z',
      createdByUserId: 'user-2',
      encrypted: false,
      appVersion: '0.1.0-beta',
      fileSizeBytes: serializedBackup.length,
      payloadSha256: 'sha-3',
      storagePath: '/backups/backup-3.json',
    }),
    getMigrationStatusFn: async () => ({
      applied: 42,
      pending: [],
    }),
    listRestoreApplyBlockingLocks: async () => ([{
      id: 'lock-2',
      lockType: 'restore',
      status: 'active',
      reason: 'Inspect /app/data/backups/backup-3.json with ops@example.com',
      acquiredAt: '2026-05-03T12:05:00.000Z',
      expiresAt: null,
      acquiredByUserId: 'user-admin',
    }]),
    readBackupPayloadFn: async () => serializedBackup,
    sha256Fn: () => 'sha-3',
  });

  const preview = await service.getBackupRestorePreview({ backupArtifactId: 'backup-3' });

  assert.equal(
    preview.restoreReadiness.blockingLocks[0].reason,
    'Inspect [REDACTED_PATH] with [REDACTED_EMAIL]',
  );
});

test('getBackupRestorePreview throws when artifact is missing', async () => {
  const service = createBackupRestorePreviewService({
    getBackupArtifactById: async () => null,
  });

  await assert.rejects(
    () => service.getBackupRestorePreview({ backupArtifactId: 'missing' }),
    (error) => error.code === 'backup_artifact_not_found',
  );
});

test('getBackupRestorePreview reports an encrypted backup without its configured key without treating it as plaintext', async () => {
  const encryptingService = createBackupEncryptionService({ encryptionKey: randomBytes(32) });
  const serializedBackup = encryptingService.encryptBackupPayload(JSON.stringify({
    backup: {
      encrypted: true,
      scope: ['settings'],
      type: 'logical',
    },
    formatVersion: '1',
  }));
  const service = createBackupRestorePreviewService({
    backupEncryptionService: createBackupEncryptionService({ encryptionKey: null }),
    getBackupArtifactById: async () => ({
      backupType: 'logical',
      encrypted: true,
      fileSizeBytes: Buffer.byteLength(serializedBackup),
      filename: 'encrypted-backup.enc.json',
      formatVersion: '1',
      id: 'backup-encrypted-no-key',
      migrationLevel: 'applied:42',
      payloadSha256: 'a'.repeat(64),
      scope: ['settings'],
      storagePath: '/backups/encrypted-backup.enc.json',
    }),
    listRestoreApplyBlockingLocks: async () => [],
    readBackupPayloadFn: async () => serializedBackup,
  });

  const preview = await service.getBackupRestorePreview({ backupArtifactId: 'backup-encrypted-no-key' });

  assert.equal(preview.integrity.status, 'failed');
  assert.equal(preview.canApplyRestore, false);
  assert.equal(
    preview.compatibility.checks.some((check) => check.code === 'payload_encrypted_no_key'),
    true,
  );
});

test('getBackupRestorePreview reports decryption failure for an encrypted backup with the wrong key', async () => {
  const encryptingService = createBackupEncryptionService({ encryptionKey: randomBytes(32) });
  const serializedBackup = encryptingService.encryptBackupPayload(JSON.stringify({
    backup: {
      encrypted: true,
      scope: ['settings'],
      type: 'logical',
    },
    formatVersion: '1',
  }));
  const service = createBackupRestorePreviewService({
    backupEncryptionService: createBackupEncryptionService({ encryptionKey: randomBytes(32) }),
    getBackupArtifactById: async () => ({
      backupType: 'logical',
      encrypted: true,
      fileSizeBytes: Buffer.byteLength(serializedBackup),
      filename: 'encrypted-backup.enc.json',
      formatVersion: '1',
      id: 'backup-encrypted-wrong-key',
      migrationLevel: 'applied:42',
      payloadSha256: 'a'.repeat(64),
      scope: ['settings'],
      storagePath: '/backups/encrypted-backup.enc.json',
    }),
    listRestoreApplyBlockingLocks: async () => [],
    readBackupPayloadFn: async () => serializedBackup,
  });

  const preview = await service.getBackupRestorePreview({ backupArtifactId: 'backup-encrypted-wrong-key' });

  assert.equal(preview.integrity.status, 'failed');
  assert.equal(
    preview.compatibility.checks.some((check) => check.code === 'payload_decryption_failed'),
    true,
  );
});

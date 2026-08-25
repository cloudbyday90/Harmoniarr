import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBackupArtifactFileVerificationService } from '../../src/server/recovery/backup-artifact-file-verification-service.js';
import { createBackupEncryptionService } from '../../src/server/recovery/backup-encryption-service.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createBackupDocument() {
  return {
    application: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
    },
    backup: {
      encrypted: false,
      scope: ['settings'],
      type: 'logical',
    },
    data: {
      settings: {},
    },
    exportedAt: '2026-08-25T12:00:00.000Z',
    formatVersion: '1',
    schema: {
      migrationLevel: 'applied:99',
    },
  };
}

function createArtifact({ document, serialized, storagePath, encrypted = false }) {
  return {
    backupType: 'logical',
    encrypted,
    fileSizeBytes: Buffer.byteLength(serialized),
    filename: 'harmoniarr_backup_2026-08-25T12-00-00-000Z.json',
    formatVersion: '1',
    manifest: {
      application: document.application,
      backup: document.backup,
      exportedAt: document.exportedAt,
      formatVersion: document.formatVersion,
      schema: document.schema,
    },
    payloadSha256: sha256(JSON.stringify(document, null, 2)),
    scope: ['settings'],
    storagePath,
  };
}

test('verifyBackupArtifactFile confirms exact file, payload, and manifest identity', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-verification-'));
  const storagePath = join(directory, 'backup.json');
  const document = createBackupDocument();
  const serialized = JSON.stringify(document, null, 2);
  const artifact = createArtifact({ document, serialized, storagePath });
  await writeFile(storagePath, serialized, 'utf8');
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const result = await createBackupArtifactFileVerificationService().verifyBackupArtifactFile({
    artifact,
    expectedFileSha256: sha256(serialized),
    expectedFileSizeBytes: Buffer.byteLength(serialized),
  });

  assert.equal(result.status, 'verified');
  assert.equal(result.fileSha256, sha256(serialized));
  assert.equal(result.payloadSha256, artifact.payloadSha256);
});

test('verifyBackupArtifactFile refuses a manifest that no longer matches the artifact snapshot', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-manifest-mismatch-'));
  const storagePath = join(directory, 'backup.json');
  const document = createBackupDocument();
  const serialized = JSON.stringify(document, null, 2);
  const artifact = createArtifact({ document, serialized, storagePath });
  artifact.manifest.application.version = '0.1.0-other';
  await writeFile(storagePath, serialized, 'utf8');
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const result = await createBackupArtifactFileVerificationService().verifyBackupArtifactFile({ artifact });

  assert.deepEqual(result, {
    code: 'manifest_application_mismatch',
    status: 'unverified',
  });
});

test('verifyBackupArtifactFile refuses automatic verification of encrypted data without its key', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-encrypted-key-'));
  const storagePath = join(directory, 'backup.enc.json');
  const document = createBackupDocument();
  document.backup.encrypted = true;
  const plaintext = JSON.stringify(document, null, 2);
  const encryptionService = createBackupEncryptionService({ encryptionKey: randomBytes(32) });
  const serialized = encryptionService.encryptBackupPayload(plaintext);
  const artifact = createArtifact({
    document,
    encrypted: true,
    serialized,
    storagePath,
  });
  artifact.payloadSha256 = sha256(plaintext);
  await writeFile(storagePath, serialized, 'utf8');
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const result = await createBackupArtifactFileVerificationService({
    backupEncryptionService: createBackupEncryptionService({ encryptionKey: null }),
  }).verifyBackupArtifactFile({ artifact });

  assert.deepEqual(result, {
    code: 'artifact_encryption_key_unavailable',
    status: 'unverified',
  });
});

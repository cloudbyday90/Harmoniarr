import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBackupArtifactFileOperationService } from '../../src/server/recovery/backup-artifact-file-operation-service.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createBackupArtifactFileVerificationService } from '../../src/server/recovery/backup-artifact-file-verification-service.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createArtifactDraft({ storagePath }) {
  const manifest = {
    application: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
    },
    backup: {
      encrypted: false,
      scope: ['settings'],
      type: 'logical',
    },
    exportedAt: '2026-08-25T12:00:00.000Z',
    formatVersion: '1',
    schema: {
      migrationLevel: 'applied:99',
    },
  };
  const content = JSON.stringify({
    ...manifest,
    data: {
      settings: {},
    },
  }, null, 2);

  return {
    artifact: {
      ...manifest,
      backupType: manifest.backup.type,
      encrypted: false,
      fileSizeBytes: Buffer.byteLength(content),
      filename: 'harmoniarr_backup_2026-08-25T12-00-00-000Z_operation-1.json',
      manifest,
      payloadSha256: sha256(content),
      scope: manifest.backup.scope,
      storagePath,
    },
    content,
  };
}

function createLifecycleHarness({ fileService = createBackupArtifactFileService() } = {}) {
  const artifacts = [];
  const operations = [];
  let nextArtifactId = 1;
  let nextOperationId = 1;
  const createFileOperation = async (input) => {
    const operation = {
      ...input,
      id: `operation-${nextOperationId++}`,
      status: 'prepared',
    };
    operations.push(operation);
    return operation;
  };
  const updateFileOperation = async ({ backupArtifactId = undefined, fileOperationId, ...patch }) => {
    const operation = operations.find((entry) => entry.id === fileOperationId);
    Object.assign(operation, patch);
    if (backupArtifactId !== undefined) {
      operation.backupArtifactId = backupArtifactId;
    }
    return operation;
  };
  const createBackupArtifact = async (artifact) => {
    const created = {
      ...artifact,
      id: `artifact-${nextArtifactId++}`,
    };
    artifacts.push(created);
    return created;
  };
  const getBackupArtifactByFilename = async ({ filename }) => artifacts.find((artifact) => artifact.filename === filename) ?? null;
  const getBackupArtifactById = async ({ backupArtifactId }) => artifacts.find((artifact) => artifact.id === backupArtifactId) ?? null;
  const deleteBackupArtifactById = async ({ backupArtifactId }) => {
    const index = artifacts.findIndex((artifact) => artifact.id === backupArtifactId);
    return index >= 0 ? artifacts.splice(index, 1)[0] : null;
  };
  const service = createBackupArtifactFileOperationService({
    backupArtifactFileService: fileService,
    backupArtifactFileVerificationService: createBackupArtifactFileVerificationService(),
    createBackupArtifact,
    createFileOperation,
    deleteBackupArtifactById,
    getBackupArtifactByFilename,
    getBackupArtifactById,
    listIncompleteFileOperations: async () => operations.filter((operation) => !['completed', 'abandoned'].includes(operation.status)),
    randomUuidFn: () => 'temporary-1',
    updateFileOperation,
  });

  return {
    artifacts,
    createBackupArtifact,
    createFileOperation,
    deleteBackupArtifactById,
    operations,
    service,
  };
}

test('publishBackupArtifact records durable intent before writing and verifies before inventory publication', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-operation-publish-'));
  const storagePath = join(directory, 'backup.json');
  const { artifact, content } = createArtifactDraft({ storagePath });
  const baseFileService = createBackupArtifactFileService();
  let harness;
  const fileService = {
    ...baseFileService,
    async writePrivateTemporaryFile(input) {
      assert.equal(harness.operations.length, 1);
      await baseFileService.writePrivateTemporaryFile(input);
    },
  };
  harness = createLifecycleHarness({ fileService });
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const published = await harness.service.publishBackupArtifact({ artifact, content, triggeredByUserId: 'user-1' });

  assert.equal(published.id, 'artifact-1');
  assert.equal(await readFile(storagePath, 'utf8'), content);
  assert.equal(harness.operations[0].status, 'completed');
  assert.equal(harness.operations[0].backupArtifactId, 'artifact-1');
});

test('recoverIncompleteFileOperations promotes only a verified durable temporary artifact', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-operation-recover-'));
  const storagePath = join(directory, 'backup.json');
  const { artifact, content } = createArtifactDraft({ storagePath });
  const harness = createLifecycleHarness();
  const operation = await harness.createFileOperation({
    artifactSnapshot: artifact,
    expectedFileSha256: sha256(content),
    expectedFileSizeBytes: Buffer.byteLength(content),
    filename: artifact.filename,
    operationType: 'publish',
    storagePath,
    temporaryPath: join(directory, '.backup.json.interrupted.partial'),
  });
  await createBackupArtifactFileService().writePrivateTemporaryFile({
    content,
    temporaryPath: operation.temporaryPath,
  });
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const recovery = await harness.service.recoverIncompleteFileOperations();

  assert.deepEqual(recovery, {
    abandonedCount: 0,
    awaitingConfirmationCount: 0,
    completedCount: 1,
    deferredCount: 0,
  });
  assert.equal(harness.operations[0].status, 'completed');
  assert.equal(harness.artifacts.length, 1);
  assert.equal(await readFile(storagePath, 'utf8'), content);
  await assert.rejects(() => access(operation.temporaryPath), { code: 'ENOENT' });
});

test('publishBackupArtifact holds mismatched content without creating a final artifact', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-operation-held-'));
  const storagePath = join(directory, 'backup.json');
  const { artifact, content } = createArtifactDraft({ storagePath });
  const harness = createLifecycleHarness();
  t.after(async () => rm(directory, { force: true, recursive: true }));

  await assert.rejects(
    () => harness.service.publishBackupArtifact({ artifact, content: `${content}\nchanged` }),
    (error) => error.code === 'backup_artifact_filesystem_confirmation_required',
  );

  assert.equal(harness.operations[0].status, 'awaiting_confirmation');
  assert.equal(harness.artifacts.length, 0);
  await assert.rejects(() => access(storagePath), { code: 'ENOENT' });
});

test('recoverIncompleteFileOperations completes interrupted deletion only after the file is absent or verified', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-operation-delete-'));
  const storagePath = join(directory, 'backup.json');
  const { artifact, content } = createArtifactDraft({ storagePath });
  const harness = createLifecycleHarness();
  const persistedArtifact = await harness.createBackupArtifact({ ...artifact, id: undefined });
  await harness.createFileOperation({
    artifactSnapshot: persistedArtifact,
    backupArtifactId: persistedArtifact.id,
    expectedFileSha256: sha256(content),
    expectedFileSizeBytes: Buffer.byteLength(content),
    filename: persistedArtifact.filename,
    operationType: 'delete',
    storagePath,
  });
  await createBackupArtifactFileService().writePrivateTemporaryFile({
    content,
    temporaryPath: storagePath,
  });
  t.after(async () => rm(directory, { force: true, recursive: true }));

  const recovery = await harness.service.recoverIncompleteFileOperations();

  assert.equal(recovery.completedCount, 1);
  assert.equal(harness.operations[0].status, 'completed');
  assert.equal(harness.artifacts.length, 0);
  await assert.rejects(() => access(storagePath), { code: 'ENOENT' });
});

import assert from 'node:assert/strict';
import { createBackupArtifactFixture as createArtifactDraft } from '../../testing/server/backup-artifact-fixture.js';
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

function createLifecycleHarness({ fileService = createBackupArtifactFileService(), readinessService,
  directoryCreationService = { prepareArtifactDirectories: async () => {} },
  directorySyncService = { syncParentDirectory: async () => {} } } = {}) {
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
    backupArtifactFileReadinessService: readinessService,
    // Windows unit fixtures control this platform boundary; native Linux tests use real directory sync.
    backupArtifactDirectorySyncService: directorySyncService,
    backupArtifactDirectoryCreationService: directoryCreationService,
    createBackupArtifact,
    createFileOperation,
    deleteBackupArtifactById,
    getBackupArtifactByFilename,
    getBackupArtifactById,
    listIncompleteFileOperations: async () => operations.filter((operation) => !['completed', 'abandoned'].includes(operation.status)),
    recordFileOperationFailure: updateFileOperation,
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


test('async publication promotion failure is recorded safely without regressing the temporary-ready phase', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-journal-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const draft = createArtifactDraft({ storagePath: join(directory, 'backup.json') });
  const raw = Object.assign(new Error('private-native-message /retired/音乐 Room token=secret'), { code: 'EIO' });
  const files = createBackupArtifactFileService();
  const harness = createLifecycleHarness({ fileService: { ...files, promoteTemporaryFile: async () => { throw raw; } } });
  await assert.rejects(harness.service.publishBackupArtifact(draft), error => error === raw);
  const [operation] = harness.operations;
  assert.equal(operation.status, 'temporary_ready'); assert.equal(operation.lastErrorCode, 'EIO');
  assert.doesNotMatch(operation.lastErrorMessage, /private-native-message|retired|secret/u);
  assert.equal(await readFile(operation.temporaryPath, 'utf8'), draft.content); assert.equal(harness.artifacts.length, 0);
});

test('delete failure retains inventory and records safe text without changing the thrown error', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-journal-delete-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const draft = createArtifactDraft({ storagePath: join(directory, 'backup.json') });
  const files = createBackupArtifactFileService(); let fail = true;
  const raw = Object.assign(new Error('private-native-message token=secret'), { code: 'EACCES' });
  const harness = createLifecycleHarness({ fileService: { ...files, removeFileIfPresent: async input => {
    if (fail) throw raw; return files.removeFileIfPresent(input);
  } } });
  const artifact = await harness.service.publishBackupArtifact(draft);
  await assert.rejects(harness.service.deleteBackupArtifact({ artifact }), error => error === raw);
  const operation = harness.operations.find(entry => entry.operationType === 'delete');
  assert.equal(operation.status, 'prepared'); assert.equal(operation.lastErrorCode, 'EACCES');
  assert.doesNotMatch(operation.lastErrorMessage, /private-native-message|secret/u);
  assert.equal(harness.artifacts.length, 1); assert.equal(await readFile(artifact.storagePath, 'utf8'), draft.content);
  fail = false; assert.equal((await harness.service.recoverIncompleteFileOperations()).completedCount, 1);
  assert.equal(harness.artifacts.length, 0);
});

test('restart recovery records a fixed unknown failure and remains deferred without losing verified temporary bytes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-journal-recover-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const draft = createArtifactDraft({ storagePath: join(directory, 'backup.json') }); const files = createBackupArtifactFileService();
  const harness = createLifecycleHarness({ fileService: { ...files, promoteTemporaryFile: async () => {
    throw Object.assign(new Error('private-native-message token=secret'), { code: '/unsafe-code' });
  } } });
  const operation = await harness.createFileOperation({ artifactSnapshot: draft.artifact, storagePath: draft.artifact.storagePath,
    filename: draft.artifact.filename, operationType: 'publish', expectedFileSha256: sha256(draft.content),
    expectedFileSizeBytes: Buffer.byteLength(draft.content), temporaryPath: join(directory, '.interrupted.partial') });
  await files.writePrivateTemporaryFile({ content: draft.content, temporaryPath: operation.temporaryPath });
  const result = await harness.service.recoverIncompleteFileOperations();
  assert.equal(result.deferredCount, 1); assert.equal(operation.status, 'prepared');
  assert.equal(operation.lastErrorCode, 'backup_artifact_file_operation_failed');
  assert.doesNotMatch(operation.lastErrorMessage, /private-native-message|secret|unsafe-code/u);
  assert.equal(await readFile(operation.temporaryPath, 'utf8'), draft.content);
});

test('recovery cannot advance temporary or final publication while readiness fails', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-readiness-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const finalExists of [false, true]) for (const failure of [new Error('readiness failed'), null]) {
    let attempts = 0;
    const draft = createArtifactDraft({ storagePath: join(directory, `${finalExists}-${attempts}-${failure === null}.json`) });
    const harness = createLifecycleHarness({ readinessService: { prepareBackupArtifactFile: async ({ storagePath }) => {
      attempts++;
      if (!finalExists && storagePath === draft.artifact.storagePath) return { status: 'missing' };
      throw failure;
    } } });
    const operation = await harness.createFileOperation({ artifactSnapshot: draft.artifact, storagePath: draft.artifact.storagePath,
      filename: draft.artifact.filename, operationType: 'publish', expectedFileSha256: sha256(draft.content),
      expectedFileSizeBytes: Buffer.byteLength(draft.content), temporaryPath: draft.artifact.storagePath+'.partial' });
    const path = finalExists ? operation.storagePath : operation.temporaryPath;
    await createBackupArtifactFileService().writePrivateTemporaryFile({ content: draft.content, temporaryPath: path });
    const result = await harness.service.recoverIncompleteFileOperations();
    assert.equal(result.deferredCount, 1); assert.equal(result.completedCount, 0);
    assert.equal(operation.status, 'prepared'); assert.equal(harness.artifacts.length, 0);
    assert.equal(await readFile(path, 'utf8'), draft.content); assert.equal(attempts, finalExists ? 1 : 2);
  }
});

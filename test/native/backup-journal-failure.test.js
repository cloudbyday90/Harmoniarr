/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createSystemModule } from '../../src/server/system-module.js';
import { createBackupArtifactRepository } from '../../src/server/recovery/backup-artifact-repository.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactFileOperationService } from '../../src/server/recovery/backup-artifact-file-operation-service.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';
import { getPool, closePool } from '../../src/server/database.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

test('backup journal records safe failures without phase regression and fresh composed recovery verifies actual file/catalog state', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-journal-');
  process.env.HARMONIARR_BACKUPS = directory;
  const files = createBackupArtifactFileService(), repository = createBackupArtifactRepository(), store = createBackupArtifactFileOperationStore();
  const producer = overrides => createBackupArtifactFileOperationService({ ...repository, ...store, ...overrides });
  const storeErrors = [];
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createSystemModule: options => createSystemModule({ ...options, backupArtifactFileOperationStore: {
      ...store, updateFileOperation: async (input, queryable) => {
        try { return await store.updateFileOperation(input, queryable); }
        catch (error) { storeErrors.push({ code: error.code, phase: input.status }); throw error; }
      },
    } }),
  });
  const recover = application.systemModule.backupArtifactFileOperationService.recoverIncompleteFileOperations;
  const draft = async name => {
    const parent = join(directory, name); await mkdir(parent);
    return createBackupArtifactFixture({ storagePath: join(parent, `${name}.json`), filename: `${name}.json` });
  };
  const row = async (name, type) => (await getPool().query(`SELECT * FROM backup_artifact_file_operations
    WHERE filename=$1 AND operation_type=$2 ORDER BY created_at DESC LIMIT 1`, [`${name}.json`, type])).rows[0];
  const artifactCount = async name => (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [`${name}.json`])).rows[0].count;
  const safe = operation => { assert.doesNotMatch(operation.last_error_message, /backup-journal-|private-message|secret|\.json|unsafe-code/u); };
  try {
    const promotion = await draft('promotion'); let nativeError;
    const deniedPromotion = producer({ backupArtifactFileService: { ...files, promoteTemporaryFile: async input => {
      const parent = join(directory, 'promotion'); await chmod(parent, 0o500);
      try { return await files.promoteTemporaryFile(input); } catch (error) { nativeError = error; throw error; }
      finally { await chmod(parent, 0o700); }
    } } });
    await assert.rejects(deniedPromotion.publishBackupArtifact(promotion), error => error === nativeError && error.code === 'EACCES');
    let operation = await row('promotion', 'publish'); safe(operation);
    assert.equal(operation.status, 'temporary_ready'); assert.equal(operation.last_error_code, 'EACCES');
    assert.equal(await readFile(operation.temporary_path, 'utf8'), promotion.content); assert.equal(await artifactCount('promotion'), 0);
    await chmod(join(directory, 'promotion'), 0o500);
    try { assert.equal((await recover()).deferredCount, 1); } finally { await chmod(join(directory, 'promotion'), 0o700); }
    operation = await row('promotion', 'publish'); assert.equal(operation.status, 'temporary_ready'); safe(operation);
    const projected = createControlPlaneRedactionService({ settings: { paths: { music: '/replacement' } } }).redactValue((await store.listIncompleteFileOperations())[0]);
    assert.equal(projected.storagePath, '[REDACTED_PATH]'); assert.equal(projected.temporaryPath, '[REDACTED_PATH]');
    assert.equal((await recover()).completedCount, 1);
    assert.equal(await readFile(promotion.artifact.storagePath, 'utf8'), promotion.content); assert.equal(await artifactCount('promotion'), 1);
    await assert.rejects(access(operation.temporary_path), { code: 'ENOENT' });

    const publication = await draft('catalog-publish');
    const catalogError = Object.assign(new Error('private-message token=secret'), { code: '23505' });
    await assert.rejects(producer({ createBackupArtifact: async () => { throw catalogError; } }).publishBackupArtifact(publication), error => error === catalogError);
    operation = await row('catalog-publish', 'publish'); safe(operation);
    assert.equal(operation.status, 'finalized'); assert.equal(operation.last_error_code, 'backup_artifact_file_operation_failed');
    assert.equal(await readFile(publication.artifact.storagePath, 'utf8'), publication.content); assert.equal(await artifactCount('catalog-publish'), 0);
    assert.equal((await recover()).completedCount, 1); assert.equal(await artifactCount('catalog-publish'), 1);

    const deletion = await draft('deletion'); const artifact = await producer().publishBackupArtifact(deletion);
    const deniedDelete = producer({ backupArtifactFileService: { ...files, removeFileIfPresent: async input => {
      const parent = join(directory, 'deletion'); await chmod(parent, 0o500);
      try { return await files.removeFileIfPresent(input); } catch (error) { nativeError = error; throw error; }
      finally { await chmod(parent, 0o700); }
    } } });
    await assert.rejects(deniedDelete.deleteBackupArtifact({ artifact }), error => error === nativeError && error.code === 'EACCES');
    operation = await row('deletion', 'delete'); safe(operation); assert.equal(operation.status, 'prepared');
    assert.equal(await artifactCount('deletion'), 1); assert.equal(await readFile(artifact.storagePath, 'utf8'), deletion.content);
    const deletionRecovery = await recover();
    assert.equal(deletionRecovery.completedCount, 1, JSON.stringify({ recovery: deletionRecovery, storeErrors,
      phase: (await row('deletion', 'delete')).status, inventoryCount: await artifactCount('deletion') }));
    assert.equal(await artifactCount('deletion'), 0);
    await assert.rejects(access(artifact.storagePath), { code: 'ENOENT' });
    operation = await row('deletion', 'delete'); assert.equal(operation.status, 'completed'); assert.equal(operation.backup_artifact_id, null);

    const lateDelete = await draft('catalog-delete'); const lateArtifact = await producer().publishBackupArtifact(lateDelete);
    const deleteError = Object.assign(new Error('private-message token=secret'), { code: '/unsafe-code' });
    await assert.rejects(producer({ deleteBackupArtifactById: async () => { throw deleteError; } }).deleteBackupArtifact({ artifact: lateArtifact }), error => error === deleteError);
    operation = await row('catalog-delete', 'delete'); safe(operation); assert.equal(operation.status, 'finalized');
    await assert.rejects(access(lateArtifact.storagePath), { code: 'ENOENT' }); assert.equal(await artifactCount('catalog-delete'), 1);
    assert.equal((await recover()).completedCount, 1); assert.equal(await artifactCount('catalog-delete'), 0);

    const held = await draft('held');
    await assert.rejects(producer().publishBackupArtifact({ ...held, content: held.content + 'changed' }), { code: 'backup_artifact_filesystem_confirmation_required' });
    operation = await row('held', 'publish'); assert.equal(operation.status, 'awaiting_confirmation');
    const heldBytes = await readFile(operation.temporary_path, 'utf8'); assert.equal((await recover()).awaitingConfirmationCount, 1);
    assert.equal(await readFile(operation.temporary_path, 'utf8'), heldBytes); assert.equal(await artifactCount('held'), 0);

    const promotedMismatch = await draft('promoted-mismatch');
    const changedAfterPromotion = producer({ backupArtifactFileService: { ...files, promoteTemporaryFile: async input => {
      await files.promoteTemporaryFile(input); await writeFile(input.storagePath, 'changed-after-promotion');
    } } });
    await assert.rejects(changedAfterPromotion.publishBackupArtifact(promotedMismatch), error => {
      assert.equal(error.code, 'backup_artifact_filesystem_confirmation_required');
      assert.doesNotMatch(error.message, /No file was changed/u); assert.match(error.message, /Inspect the file state/u); return true;
    });
    operation = await row('promoted-mismatch', 'publish'); assert.equal(operation.status, 'awaiting_confirmation');
    assert.equal(await readFile(operation.temporary_path, 'utf8'), 'changed-after-promotion');
    assert.equal((await recover()).awaitingConfirmationCount, 2); assert.equal(await artifactCount('promoted-mismatch'), 0);
    assert.equal(await readFile(promotedMismatch.artifact.storagePath, 'utf8'), 'changed-after-promotion');

    const mismatch = await draft('delete-mismatch'); const mismatchArtifact = await producer().publishBackupArtifact(mismatch);
    await writeFile(mismatchArtifact.storagePath, 'changed-content');
    await assert.rejects(producer().deleteBackupArtifact({ artifact: mismatchArtifact }), { code: 'backup_artifact_filesystem_confirmation_required' });
    assert.equal(await readFile(mismatchArtifact.storagePath, 'utf8'), 'changed-content'); assert.equal(await artifactCount('delete-mismatch'), 1);
    assert.equal(await row('delete-mismatch', 'delete'), undefined);

    const completed = await row('catalog-publish', 'publish');
    const recorded = await store.recordFileOperationFailure({ fileOperationId: completed.id, lastErrorCode: 'EIO', lastErrorMessage: 'Safe fixture error' });
    assert.equal(recorded.status, 'completed'); assert.equal(recorded.backupArtifactId, completed.backup_artifact_id);
    assert.equal(recorded.completedAt, completed.completed_at.toISOString());
    assert.deepEqual(storeErrors, []);
    t.diagnostic(JSON.stringify({ nativePromotionAndDeleteFailures: true, safeJournalText: true, phasePreserved: true,
      catalogFailureAfterMutation: true, freshComposedRecovery: true, heldMismatchPreserved: true,
      inventoryAndBytesVerified: true, completedStatePreserved: true, postPromotionMessageTruthful: true }));
  } finally {
    await application.systemModule.runtimeResourceMonitor.stop(); await rm(directory, { recursive: true, force: true });
  }
});

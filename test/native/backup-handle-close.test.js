/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('private backup handle cleanup preserves work failure, owns delayed close and leaves verified recovery in control', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-handle-close-');
  process.env.HARMONIARR_BACKUPS = directory;
  const app = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const recovery = app.systemModule.backupArtifactFileOperationService;
  const tasks = [], releases = [], cases = [];
  try {
    for (const stage of ['write', 'sync-null', 'close-only', 'partial-write']) {
      const parent = join(directory, stage); await mkdir(parent);
      const draft = createBackupArtifactFixture({ storagePath: join(parent, 'backup.json'), filename: stage+'.json' });
      const primary = stage === 'sync-null' ? null : Object.freeze(Object.assign(new Error('private work error'), { code: 'EIO' }));
      const secondary = Object.assign(new Error('private close error'), { code: 'EIO' });
      const ready = Promise.withResolvers(), finish = Promise.withResolvers();
      releases.push(() => finish.resolve());
      let handle, closeCalls = 0, syncCalls = 0;
      const owner = createOwnedBackupArtifactService({ createFileService: options => createBackupArtifactFileService({ ...options,
        openFn: async (...args) => {
          handle = await open(...args);
          return {
            writeFile: async content => {
              await handle.writeFile(stage === 'partial-write' ? content.slice(0, 32) : content);
              if (stage === 'write' || stage === 'partial-write') throw primary;
            },
            sync: async () => { syncCalls++; await handle.sync(); if (stage === 'sync-null') throw primary; },
            close: async () => {
              closeCalls++; await handle.close(); ready.resolve(); await finish.promise; throw secondary;
            },
          };
        },
      }) });
      const task = owner.publishBackupArtifact(draft).then(value => ({ fulfilled: true, value }), error => ({ fulfilled: false, error }));
      tasks.push(task);
      await Promise.race([ready.promise, task.then(() => { throw new Error('writer settled before close checkpoint'); })]);
      await assert.rejects(handle.stat(), { code: 'EBADF' });
      const operation = (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1', [draft.artifact.filename])).rows[0];
      assert.equal(operation.status, 'prepared'); assert.equal(operation.last_error_code, null);
      assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy, true);
      await assert.rejects(recovery.publishBackupArtifact(draft), { code: 'backup_artifact_operation_busy' });
      assert.equal(closeCalls, 1); assert.equal(syncCalls, stage === 'write' || stage === 'partial-write' ? 0 : 1);
      finish.resolve();
      const result = await task; assert.equal(result.fulfilled, false);
      assert.equal(result.error, stage === 'close-only' ? secondary : primary);
      const failed = (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE id=$1', [operation.id])).rows[0];
      assert.equal(failed.status, 'prepared'); assert.equal(failed.completed_at, null);
      assert.equal(failed.last_error_code, stage === 'sync-null' ? 'backup_artifact_file_operation_failed' : 'EIO');
      assert.doesNotMatch(failed.last_error_message, /private|backup\.json/u);
      await assert.rejects(readFile(draft.artifact.storagePath), { code: 'ENOENT' });
      const recovered = await recovery.recoverIncompleteFileOperations();
      const inventory = (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [draft.artifact.filename])).rows[0].count;
      if (stage === 'partial-write') {
        assert.equal(recovered.awaitingConfirmationCount, 1); assert.equal(recovered.completedCount, 0); assert.equal(inventory, 0);
        assert.equal(await readFile(operation.temporary_path, 'utf8'), draft.content.slice(0, 32));
      } else {
        assert.equal(recovered.completedCount, 1); assert.equal(inventory, 1);
        assert.equal(await readFile(draft.artifact.storagePath, 'utf8'), draft.content);
      }
      assert.equal(closeCalls, 1);
      cases.push({ stage, realHandleClosed: true, closeAttempts: closeCalls, syncAttempts: syncCalls, originalOutcomePreserved: true,
        cleanupAdmissionHeld: true, journalPhasePreserved: true, verificationControlsRecovery: true });
    }
    t.diagnostic(JSON.stringify({ cases, controlledFailuresAfterRealIo: true, partialBytesNotPublished: true }));
  } finally {
    for (const release of releases) release();
    await Promise.allSettled(tasks);
    await app.systemModule.runtimeResourceMonitor.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

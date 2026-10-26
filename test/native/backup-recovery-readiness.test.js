/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactFileReadinessService } from '../../src/server/recovery/backup-artifact-file-readiness-service.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('recovery requires owned same-file sync and close before adopting temporary or final backup bytes', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-readiness-');
  const app = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const recovery = app.systemModule.backupArtifactFileOperationService;
  const store = createBackupArtifactFileOperationStore();
  const tasks = [], releases = [], cases = [];
  async function prepare(name, { final = false, phase = 'prepared' } = {}) {
    const parent = join(directory, name); await mkdir(parent);
    const draft = createBackupArtifactFixture({ storagePath: join(parent, 'backup.json'), filename: name+'.json' });
    const operation = await store.createFileOperation({ artifactSnapshot: draft.artifact, filename: draft.artifact.filename,
      operationType: 'publish', storagePath: draft.artifact.storagePath, temporaryPath: join(parent, '.interrupted.partial'),
      expectedFileSha256: createHash('sha256').update(draft.content).digest('hex'), expectedFileSizeBytes: Buffer.byteLength(draft.content) });
    if (phase !== 'prepared') await store.updateFileOperation({ fileOperationId: operation.id, status: phase });
    const path = final ? operation.storagePath : operation.temporaryPath;
    await writeFile(path, draft.content, { flag: 'wx', mode: 0o600 });
    return { draft, operation, path, phase };
  }
  const row = async input => (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE id=$1', [input.operation.id])).rows[0];
  const count = async input => (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [input.draft.artifact.filename])).rows[0].count;
  try {
    for (const stage of ['sync-null', 'final-close', 'owner-loss', 'path-replaced']) {
      const input = await prepare(stage, { final: stage === 'final-close', phase: stage === 'final-close' ? 'finalized' : 'prepared' });
      const ready = Promise.withResolvers(), finish = Promise.withResolvers();
      releases.push(() => finish.resolve());
      let handle, syncs = 0, closes = 0, pid;
      const secondary = Object.assign(new Error('private close detail'), { code: 'EIO' });
      const reports = [];
      const owner = createOwnedBackupArtifactService({
        onJournalFailure: event => { reports.push(event); },
        ownershipStore: createBackupArtifactOwnershipStore({ getPoolFn: () => ({ connect: async () => {
          const client = await getPool().connect(); pid = client.processID; return client;
        } }) }),
        createReadinessService: options => createBackupArtifactFileReadinessService({ ...options, openFn: async (...args) => {
          handle = await open(...args);
          return {
            stat: (...values) => handle.stat(...values), readFile: (...values) => handle.readFile(...values),
            sync: async () => { syncs++; await handle.sync(); if (stage === 'sync-null') throw null; },
            close: async () => {
              closes++; await handle.close(); ready.resolve(); await finish.promise;
              if (stage === 'sync-null' || stage === 'final-close') throw secondary;
            },
          };
        } }),
      });
      const task = owner.recoverIncompleteFileOperations().then(value => ({ value }), error => ({ error }));
      tasks.push(task);
      await Promise.race([ready.promise, task.then(() => { throw new Error('recovery settled before close checkpoint'); })]);
      await assert.rejects(handle.stat(), { code: 'EBADF' });
      const before = await row(input); assert.equal(before.status, input.phase); assert.equal(before.last_error_code, null);
      assert.equal(await count(input), 0); assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy, true);
      await assert.rejects(recovery.publishBackupArtifact(input.draft), { code: 'backup_artifact_operation_busy' });
      if (stage === 'owner-loss') {
        assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS stopped', [pid])).rows[0].stopped, true);
        const deadline = Date.now()+5000;
        while ((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active', [pid])).rows[0].active) {
          assert.ok(Date.now()<deadline); await new Promise(resolve => { setTimeout(resolve, 10); });
        }
        assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy, true);
      }
      if (stage === 'path-replaced') {
        await rename(input.path, input.path+'.original'); await writeFile(input.path, input.draft.content, { flag: 'wx', mode: 0o600 });
      }
      finish.resolve(); const outcome = await task;
      assert.equal(syncs, 1); assert.equal(closes, 1); assert.equal(await count(input), 0);
      const failed = await row(input); assert.equal(failed.completed_at, null);
      if (stage === 'owner-loss') {
        assert.equal(outcome.error.code, 'backup_artifact_owner_lost'); assert.equal(failed.status, 'prepared');
        assert.equal(failed.last_error_code, null); assert.equal(reports.length, 1);
      } else if (stage === 'path-replaced') {
        assert.equal(outcome.value.awaitingConfirmationCount, 1); assert.equal(failed.status, 'awaiting_confirmation');
        assert.equal(failed.last_error_code, 'artifact_file_identity_changed');
      } else {
        assert.equal(outcome.value.deferredCount, 1); assert.equal(failed.status, input.phase);
        assert.equal(failed.last_error_code, stage === 'sync-null' ? 'backup_artifact_file_operation_failed' : 'EIO');
        assert.doesNotMatch(failed.last_error_message, /private|backup\.json/u);
      }
      assert.equal(await readFile(input.path, 'utf8'), input.draft.content);
      if (stage !== 'path-replaced') {
        assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount, 1);
        assert.equal(await count(input), 1); assert.equal((await row(input)).status, 'completed');
        assert.equal(await readFile(input.operation.storagePath, 'utf8'), input.draft.content);
      }
      cases.push({ stage, realSyncs: syncs, realCloses: closes, realHandleClosed: true, admissionHeldThroughClose: true,
        noPrematureCatalog: true, phaseOrConfirmationPreserved: true, freshRecoveryCompleted: stage !== 'path-replaced' });
    }
    const denied = await prepare('denied-open'); await chmod(denied.path, 0o400);
    try {
      assert.equal((await recovery.recoverIncompleteFileOperations()).deferredCount, 1);
      assert.equal((await row(denied)).last_error_code, 'EACCES'); assert.equal((await row(denied)).status, 'prepared');
      assert.equal(await count(denied), 0);
    } finally { await chmod(denied.path, 0o600); }
    assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount, 1);
    for (const kind of ['symlink', 'directory', 'partial']) {
      const input = await prepare(kind); await rm(input.path);
      if (kind === 'symlink') {
        await writeFile(input.path+'.target', input.draft.content, { mode: 0o600 }); await symlink(input.path+'.target', input.path);
      } else if (kind === 'directory') await mkdir(input.path);
      else await writeFile(input.path, input.draft.content.slice(0, 32), { mode: 0o600 });
      let syncs = 0;
      const owner = createOwnedBackupArtifactService({ createReadinessService: options => createBackupArtifactFileReadinessService({
        ...options, openFn: async (...args) => { const handle = await open(...args); return {
          stat: (...values) => handle.stat(...values), readFile: (...values) => handle.readFile(...values), close: () => handle.close(),
          sync: async () => { syncs++; await handle.sync(); },
        }; },
      }) });
      const outcome = await owner.recoverIncompleteFileOperations();
      assert.ok(outcome.awaitingConfirmationCount >= 1); assert.equal((await row(input)).status, 'awaiting_confirmation');
      assert.equal(syncs, 0); assert.equal(await count(input), 0);
    }
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count, 0);
    t.diagnostic(JSON.stringify({ cases, actualPermissionFailure: true, nonRegularAndPartialRefused: true, advisoryLocksRetired: true,
      controlledFailuresAfterSuccessfulRealSyncAndClose: true, defaultComposedRecoveryQualified: true }));
  } finally {
    for (const release of releases) release(); await Promise.allSettled(tasks);
    await app.systemModule.runtimeResourceMonitor.stop(); await rm(directory, { recursive: true, force: true });
  }
});

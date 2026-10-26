/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { getPool, closePool } from '../../src/server/database.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

async function retireBackend(pid) {
  assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated, true);
  const deadline = Date.now() + 5000;
  while ((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active', [pid])).rows[0].active) {
    assert.ok(Date.now() < deadline, 'terminated backend must retire within the qualification bound');
    await new Promise(resolve => { setTimeout(resolve, 10); });
  }
  assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count, 0);
}

test('local production ownership drains admitted link and unlink work after backend loss before recovery or replacement', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-io-drain-');
  process.env.HARMONIARR_BACKUPS = directory;
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const recovery = application.systemModule.backupArtifactFileOperationService;
  const pendingTasks = [];
  const releases = [];
  const measurements = [];
  try {
    for (const phase of ['delete', 'link', 'temporary-cleanup']) {
      const workdir = join(directory, phase);
      await mkdir(workdir);
      const draft = createBackupArtifactFixture({ storagePath: join(workdir, 'backup.json'), filename: `${phase}.json` });
      const artifact = phase === 'delete' ? await recovery.publishBackupArtifact(draft) : draft.artifact;
      const ready = Promise.withResolvers();
      const finish = Promise.withResolvers();
      let pid;
      let admitted = 0;
      let settled = 0;
      const hold = async action => {
        admitted++;
        ready.resolve();
        await finish.promise;
        try { return await action(); }
        finally { settled++; }
      };
      const owner = createOwnedBackupArtifactService({
        ownershipStore: createBackupArtifactOwnershipStore({ getPoolFn: () => ({ connect: async () => {
          const client = await getPool().connect();
          pid = client.processID;
          return client;
        } }) }),
        createFileService: options => createBackupArtifactFileService({
          ...options,
          linkFn: (...args) => phase === 'link' ? hold(() => link(...args)) : link(...args),
          unlinkFn: path => phase !== 'link' ? hold(() => unlink(path)) : unlink(path),
        }),
      });
      const task = (phase === 'delete' ? owner.deleteBackupArtifact({ artifact }) : owner.publishBackupArtifact(draft))
        .then(value => ({ value }), error => ({ error }));
      pendingTasks.push(task);
      releases.push(() => finish.resolve());
      await Promise.race([ready.promise, task.then(() => { throw new Error('operation settled before admitted I/O checkpoint'); })]);
      const readOperation = async () => (await getPool().query(
        'SELECT * FROM backup_artifact_file_operations WHERE filename=$1 ORDER BY created_at DESC LIMIT 1', [draft.artifact.filename],
      )).rows[0];
      const before = await readOperation();
      assert.equal(before.status, phase === 'delete' ? 'prepared' : 'temporary_ready');
      await retireBackend(pid);
      assert.equal(admitted, 1);
      assert.equal(settled, 0);

      assert.deepEqual(await recovery.recoverIncompleteFileOperations(), {
        abandonedCount: 0, awaitingConfirmationCount: 0, completedCount: 0, deferredCount: 0, ownershipBusy: true,
      });
      await assert.rejects(recovery.publishBackupArtifact(draft), { code: 'backup_artifact_operation_busy' });
      await assert.rejects(recovery.deleteBackupArtifact({ artifact }), { code: 'backup_artifact_operation_busy' });
      assert.deepEqual(await readOperation(), before);
      assert.equal((await getPool().query('SELECT count(*)::int AS count FROM backup_artifact_file_operations WHERE filename=$1', [draft.artifact.filename])).rows[0].count, phase === 'delete' ? 2 : 1);
      if (phase === 'link') await assert.rejects(readFile(draft.artifact.storagePath), { code: 'ENOENT' });
      else assert.equal(await readFile(draft.artifact.storagePath, 'utf8'), draft.content);

      finish.resolve();
      const outcome = await task;
      assert.equal(outcome.error.code, 'backup_artifact_owner_lost');
      assert.equal(settled, 1);
      assert.deepEqual(await readOperation(), before);
      const recovered = await recovery.recoverIncompleteFileOperations();
      assert.equal(recovered.completedCount, 1);
      assert.equal(recovered.deferredCount, 0);
      assert.equal((await readOperation()).status, 'completed');
      if (phase === 'delete') {
        await assert.rejects(readFile(draft.artifact.storagePath), { code: 'ENOENT' });
        const replacement = await recovery.publishBackupArtifact(draft);
        assert.notEqual(replacement.id, artifact.id);
        assert.equal(await readFile(draft.artifact.storagePath, 'utf8'), draft.content);
        assert.equal((await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE id=$1', [replacement.id])).rows[0].count, 1);
      } else {
        assert.equal(await readFile(draft.artifact.storagePath, 'utf8'), draft.content);
        await assert.rejects(readFile(before.temporary_path), { code: 'ENOENT' });
      }
      assert.equal((await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [draft.artifact.filename])).rows[0].count, 1);
      measurements.push({ phase, backendRetired: true, localContendersRefused: true, phasePreservedUntilDrain: true, admitted, settled, freshRecoveryCompleted: true, finalBytesAndCatalogPresent: true });
    }

    // Keep actual PostgreSQL contention covered independently of the local gate.
    await createBackupArtifactOwnershipStore().withOwnership(async () => {
      assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy, true);
    });
    assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount, 0);
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count, 0);
    t.diagnostic(JSON.stringify({ admittedIoCases: measurements, healthySessionContention: true, advisoryLocksRetired: true }));
  } finally {
    for (const release of releases) release();
    await Promise.allSettled(pendingTasks);
    await application.systemModule.runtimeResourceMonitor.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

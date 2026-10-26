/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { access, chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

test('backup failures retain primary identity through rejected journal UPDATE and lost ownership, then recover verified files', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-failure-precedence-');
  process.env.HARMONIARR_BACKUPS = directory;
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const recovery = application.systemModule.backupArtifactFileOperationService;
  const tasks = [];
  const releases = [];
  const reports = [];
  const draft = async name => {
    const parent = join(directory, name);
    await mkdir(parent);
    return createBackupArtifactFixture({ filename: name+'.json', storagePath: join(parent, 'backup.json') });
  };
  const row = async (name, type) => (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2 ORDER BY created_at DESC LIMIT 1', [name+'.json', type])).rows[0];
  const count = async name => (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [name+'.json'])).rows[0].count;
  const checkReport = diagnostic => {
    assert.equal(diagnostic.code, 'backup_artifact_failure_journal_unavailable');
    assert.match(diagnostic.fileOperationId, /^[0-9a-f-]{36}$/u);
    assert.doesNotMatch(JSON.stringify(diagnostic), /private|secret|backup\.json|SQL|P0001/u);
    reports.push(diagnostic);
  };
  try {
    // Reject the actual error-field UPDATE, without rejecting normal phase writes.
    await getPool().query(`CREATE FUNCTION qualification_reject_backup_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='private SQL path=/private/backup.json token=secret'; END; $$;
      CREATE TRIGGER qualification_reject_backup_failure BEFORE UPDATE OF last_error_code,last_error_message ON backup_artifact_file_operations
      FOR EACH ROW WHEN (NEW.last_error_code IS NOT NULL) EXECUTE FUNCTION qualification_reject_backup_failure();`);
    for (const mode of ['publish', 'delete']) {
      const name = 'permission-'+mode;
      const prepared = await draft(name);
      const artifact = mode === 'delete' ? await recovery.publishBackupArtifact(prepared) : prepared.artifact;
      let nativeError;
      const deny = async action => {
        await chmod(join(directory, name), 0o500);
        try { return await action(); }
        catch (error) { nativeError = error; throw error; }
        finally { await chmod(join(directory, name), 0o700); }
      };
      const owner = createOwnedBackupArtifactService({ onJournalFailure: checkReport, createFileService: options => {
        const files = createBackupArtifactFileService(options);
        return { ...files, promoteTemporaryFile: input => deny(() => files.promoteTemporaryFile(input)), removeFileIfPresent: input => deny(() => files.removeFileIfPresent(input)) };
      } });
      const task = mode === 'publish' ? owner.publishBackupArtifact(prepared) : owner.deleteBackupArtifact({ artifact });
      await assert.rejects(task, error => error === nativeError && error.code === 'EACCES');
      let operation = await row(name, mode);
      assert.equal(operation.status, mode === 'publish' ? 'temporary_ready' : 'prepared');
      assert.equal(operation.last_error_code, null);
      assert.equal(operation.last_error_message, null);
      assert.equal(operation.completed_at, null);
      assert.equal(await count(name), mode === 'publish' ? 0 : 1);
      assert.equal(await readFile(mode === 'publish' ? operation.temporary_path : artifact.storagePath, 'utf8'), prepared.content);
      if (mode === 'publish') {
        // Failed failure recording must not return an ordinary deferred aggregate.
        await assert.rejects(owner.recoverIncompleteFileOperations(), error => error === nativeError && error.code === 'EACCES');
        assert.deepEqual(await row(name, mode), operation);
      }
      await getPool().query('ALTER TABLE backup_artifact_file_operations DISABLE TRIGGER qualification_reject_backup_failure');
      assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount, 1);
      operation = await row(name, mode);
      assert.equal(operation.status, 'completed');
      assert.equal(await count(name), mode === 'publish' ? 1 : 0);
      if (mode === 'publish') assert.equal(await readFile(artifact.storagePath, 'utf8'), prepared.content);
      else await assert.rejects(access(artifact.storagePath), { code: 'ENOENT' });
      await getPool().query('ALTER TABLE backup_artifact_file_operations ENABLE TRIGGER qualification_reject_backup_failure');
    }
    assert.equal(reports.length, 3);
    for (const diagnostic of reports) assert.equal(diagnostic.journalFailure, 'write_failed');
    await getPool().query('DROP TRIGGER qualification_reject_backup_failure ON backup_artifact_file_operations; DROP FUNCTION qualification_reject_backup_failure()');

    for (const primary of [Object.freeze(Object.assign(new Error('controlled private I/O failure'), { code: 'EIO' })), null]) {
      const name = primary === null ? 'lost-null' : 'lost-error';
      const prepared = await draft(name);
      const ready = Promise.withResolvers(), finish = Promise.withResolvers();
      const reportReady = Promise.withResolvers(), reportFinish = Promise.withResolvers();
      releases.push(() => { finish.resolve(); reportFinish.resolve(); });
      let pid;
      const owner = createOwnedBackupArtifactService({
        ownershipStore: createBackupArtifactOwnershipStore({ getPoolFn: () => ({ connect: async () => {
          const client = await getPool().connect(); pid = client.processID; return client;
        } }) }),
        createFileService: options => createBackupArtifactFileService({ ...options, linkFn: async () => { ready.resolve(); await finish.promise; throw primary; } }),
        onJournalFailure: async diagnostic => {
          checkReport(diagnostic); reportReady.resolve(); await reportFinish.promise;
          if (primary === null) throw null;
        },
      });
      const task = owner.publishBackupArtifact(prepared).then(value => ({ value }), error => ({ error }));
      tasks.push(task);
      await Promise.race([ready.promise, task.then(() => { throw new Error('owner settled before I/O checkpoint'); })]);
      const before = await row(name, 'publish');
      assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated, true);
      const deadline = Date.now()+5000;
      while ((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active', [pid])).rows[0].active) {
        assert.ok(Date.now()<deadline);
        await new Promise(resolve => { setTimeout(resolve, 10); });
      }
      finish.resolve();
      await Promise.race([reportReady.promise, task.then(() => { throw new Error('owner settled before diagnostic checkpoint'); })]);
      assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy, true);
      assert.deepEqual(await row(name, 'publish'), before);
      assert.equal(reports.at(-1).journalFailure, 'owner_lost');
      reportFinish.resolve();
      assert.equal((await task).error, primary);
      assert.deepEqual(await row(name, 'publish'), before);
      assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount, 1);
      assert.equal(await count(name), 1);
      assert.equal(await readFile(prepared.artifact.storagePath, 'utf8'), prepared.content);
      await assert.rejects(access(before.temporary_path), { code: 'ENOENT' });
    }
    assert.equal(reports.length, 5);
    t.diagnostic(JSON.stringify({ actualPermissionFailures: 3, actualJournalUpdateRejections: 3, primaryIdentityPreserved: true,
      lostOwnerErrorAndNullPreserved: true, reporterNullContained: true, diagnosticDrainOwned: true, phasesPreserved: true,
      freshRecoveryVerified: true, boundedSecondaryDiagnostics: true }));
  } finally {
    for (const release of releases) release();
    await Promise.allSettled(tasks);
    await getPool().query('DROP TRIGGER IF EXISTS qualification_reject_backup_failure ON backup_artifact_file_operations; DROP FUNCTION IF EXISTS qualification_reject_backup_failure()');
    await application.systemModule.runtimeResourceMonitor.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { link, lstat, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '../../src/server/app.js';
import { getPool, closePool } from '../../src/server/database.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactRepository } from '../../src/server/recovery/backup-artifact-repository.js';
import { createBackupArtifactFileService } from '../../src/server/recovery/backup-artifact-file-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('exclusive publication and shared production ownership preserve foreign bytes and recover interrupted dual names', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-publication-');
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const recovery = application.systemModule.backupArtifactFileOperationService;
  const store = createBackupArtifactFileOperationStore();
  const draft = async name => { const dir = join(directory, name); await mkdir(dir); return createBackupArtifactFixture({ storagePath: join(dir, name+'.json'), filename: name+'.json' }); };
  const row = async name => (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 ORDER BY created_at DESC LIMIT 1', [name+'.json'])).rows[0];
  const count = async name => (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1', [name+'.json'])).rows[0].count;
  let single;
  const pendingTasks = [];
  const releases = [];
  try {
    const collision = await draft('collision');
    const racing = createOwnedBackupArtifactService({ createFileService: options => {
      const files = createBackupArtifactFileService(options);
      return { ...files, promoteTemporaryFile: async input => { await writeFile(input.storagePath, 'FOREIGN', { flag: 'wx' }); return files.promoteTemporaryFile(input); } };
    } });
    await assert.rejects(racing.publishBackupArtifact(collision), { code: 'backup_artifact_filesystem_confirmation_required' });
    let operation = await row('collision'); assert.equal(operation.status, 'awaiting_confirmation');
    assert.equal(await readFile(collision.artifact.storagePath,'utf8'),'FOREIGN'); assert.equal(await readFile(operation.temporary_path,'utf8'),collision.content);
    assert.equal(await count('collision'),0); assert.equal((await recovery.recoverIncompleteFileOperations()).awaitingConfirmationCount,1);

    const active = await draft('active'), ready = Promise.withResolvers(), finish = Promise.withResolvers();
    const owner = createOwnedBackupArtifactService({ createFileService: options => {
      const files = createBackupArtifactFileService(options);
      return { ...files, promoteTemporaryFile: async input => { ready.resolve(); await finish.promise; return files.promoteTemporaryFile(input); } };
    } });
    const pending = owner.publishBackupArtifact(active); const pendingOutcome = pending.then(value => ({ value }), error => ({ error }));
    pendingTasks.push(pendingOutcome); releases.push(() => finish.resolve());
    await ready.promise;
    try {
      assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy,true);
      await assert.rejects(recovery.publishBackupArtifact(active), { code: 'backup_artifact_operation_busy' });
      await assert.rejects(recovery.deleteBackupArtifact({ artifact: active.artifact }), { code: 'backup_artifact_operation_busy' });
      assert.equal((await getPool().query('SELECT count(*)::int AS count FROM backup_artifact_file_operations WHERE filename=$1', [active.artifact.filename])).rows[0].count,1);
    } finally { finish.resolve(); }
    assert.equal((await pendingOutcome).error,undefined); assert.equal(await count('active'),1);
    await recovery.deleteBackupArtifact({ artifact: await application.systemModule.backupArtifactRepository.getBackupArtifactByFilename({ filename: active.artifact.filename }) });
    assert.equal(await count('active'),0);

    const dual = await draft('dual');
    const interrupted = () => createOwnedBackupArtifactService({ createFileService: options => createBackupArtifactFileService({ ...options,
      unlinkFn: async () => { throw Object.assign(new Error('controlled cleanup interruption'),{code:'EIO'}); },
    }) });
    await assert.rejects(interrupted().publishBackupArtifact(dual), { code: 'EIO' });
    operation=await row('dual'); assert.equal(operation.status,'temporary_ready'); assert.equal(await count('dual'),0);
    assert.equal((await lstat(operation.temporary_path,{bigint:true})).ino,(await lstat(dual.artifact.storagePath,{bigint:true})).ino);
    assert.equal(await readFile(dual.artifact.storagePath,'utf8'),dual.content);
    assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount,1); assert.equal(await count('dual'),1);
    await assert.rejects(readFile(operation.temporary_path),{code:'ENOENT'});

    const foreignTemporary = await draft('foreign-temp');
    await assert.rejects(interrupted().publishBackupArtifact(foreignTemporary),{code:'EIO'});
    operation=await row('foreign-temp'); await unlink(operation.temporary_path); await writeFile(operation.temporary_path,foreignTemporary.content);
    assert.equal((await recovery.recoverIncompleteFileOperations()).awaitingConfirmationCount,2);
    assert.equal((await row('foreign-temp')).status,'awaiting_confirmation'); assert.equal(await count('foreign-temp'),0);
    assert.equal(await readFile(operation.temporary_path,'utf8'),foreignTemporary.content);

    single = new pg.Pool({ ...getPool().options, max: 1, connectionTimeoutMillis: 5000 });
    const one = createOwnedBackupArtifactService({ ownershipStore: createBackupArtifactOwnershipStore({getPoolFn:()=>single}),
      backupArtifactRepository: createBackupArtifactRepository({getPoolFn:()=>single}), backupArtifactFileOperationStore: createBackupArtifactFileOperationStore({getPoolFn:()=>single}) });
    const oneDraft=await draft('one-client'); const oneArtifact=await one.publishBackupArtifact(oneDraft);
    await one.deleteBackupArtifact({artifact:oneArtifact}); assert.equal(await count('one-client'),0); assert.equal(single.totalCount,1);
    await single.end(); single=null;

    const lost = await draft('lost-owner'), lostReady=Promise.withResolvers(), lostFinish=Promise.withResolvers(); let ownedPid, oldLinks=0;
    const lostOwner=createOwnedBackupArtifactService({ ownershipStore: createBackupArtifactOwnershipStore({ getPoolFn:()=>({connect:async()=>{
      const client=await getPool().connect(); ownedPid=client.processID; return client;
    }}) }), createFileService:options=>{
      const files=createBackupArtifactFileService({...options,linkFn:async(...args)=>{oldLinks++;return link(...args);}});
      return {...files,promoteTemporaryFile:async input=>{lostReady.resolve();await lostFinish.promise;return files.promoteTemporaryFile(input);}};
    } });
    const lostTask=lostOwner.publishBackupArtifact(lost).then(value=>({value}),error=>({error}));
    pendingTasks.push(lostTask); releases.push(() => lostFinish.resolve());
    await lostReady.promise;
    try {
      assert.ok(Number.isInteger(ownedPid));
      assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS terminated',[ownedPid])).rows[0].terminated,true);
      // Wait for the actual backend to retire before expecting a fresh owner.
      const deadline = Date.now() + 5000;
      while ((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active', [ownedPid])).rows[0].active) {
        assert.ok(Date.now() < deadline, 'terminated owner must retire within the qualification bound');
        await new Promise(resolve => { setTimeout(resolve, 10); });
      }
      assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount,1);
    } finally { lostFinish.resolve(); }
    const lostResult=await lostTask; assert.equal(lostResult.error.code,'backup_artifact_owner_lost'); assert.equal(oldLinks,0);
    assert.equal(await count('lost-owner'),1); assert.equal((await row('lost-owner')).status,'completed');
    assert.equal(await readFile(lost.artifact.storagePath,'utf8'),lost.content);
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    assert.equal((await store.listIncompleteFileOperations()).length,2);
    t.diagnostic(JSON.stringify({ exclusiveCollisionPreserved:true, competingProductionOwnersRefused:true, oneConnectionPool:true,
      dualNameRecovery:true, foreignTemporaryPreserved:true, terminatedOwnerRefusedFutureLink:true, oldOwnerDidNotRegressCompletion:true, advisoryLocksRetired:true }));
  } finally {
    for (const release of releases) release();
    await Promise.allSettled(pendingTasks);
    if(single)await single.end(); await application.systemModule.runtimeResourceMonitor.stop(); await rm(directory,{recursive:true,force:true});
  }
});

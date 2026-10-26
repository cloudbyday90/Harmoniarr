/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { createBackupArtifactDirectorySyncService } from '../../src/server/recovery/backup-artifact-directory-sync-service.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('directory checkpoints retain publication/deletion intent through failures and drain before replacement recovery', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const directory = await mkdtemp('/tmp/backup-directory-sync-');
  const app = createApp({ clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json' });
  const recovery = app.systemModule.backupArtifactFileOperationService;
  const store = createBackupArtifactFileOperationStore();
  const tasks = [], releases = [], cases = [];
  const draftFor = async name => { const parent=join(directory,name);await mkdir(parent);return createBackupArtifactFixture({storagePath:join(parent,'backup.json'),filename:name+'.json'}); };
  const row = async (draft,type) => (await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2 ORDER BY created_at DESC LIMIT 1',[draft.artifact.filename,type])).rows[0];
  const count = async draft => (await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1',[draft.artifact.filename])).rows[0].count;
  try {
    for(const stage of ['publish-link','publish-cleanup','delete-unlink','delete-absent','recovery-final','close-only','unsupported','owner-loss']){
      const draft=await draftFor(stage),deleting=stage.startsWith('delete-');
      const artifact=deleting?await recovery.publishBackupArtifact(draft):draft.artifact;
      if(stage==='delete-absent')await unlink(artifact.storagePath);
      if(stage==='recovery-final'){
        await writeFile(draft.artifact.storagePath,draft.content,{flag:'wx',mode:0o600});
        await store.createFileOperation({artifactSnapshot:draft.artifact,filename:draft.artifact.filename,operationType:'publish',storagePath:draft.artifact.storagePath,
          temporaryPath:join(dirname(draft.artifact.storagePath),'.missing.partial'),expectedFileSha256:createHash('sha256').update(draft.content).digest('hex'),expectedFileSizeBytes:Buffer.byteLength(draft.content)});
      }
      const ready=Promise.withResolvers(),finish=Promise.withResolvers();releases.push(()=>finish.resolve());
      const primary=stage==='publish-link'||stage==='recovery-final'?null:Object.assign(new Error('private checkpoint failure'),{code:stage==='unsupported'?'ENOTSUP':'EIO'});
      const secondary=Object.assign(new Error('private close failure'),{code:'EIO'});
      let attempts=0,realSyncs=0,closes=0,pid,targetHandle;
      const failAt=stage==='publish-cleanup'?2:1,reports=[];
      const owner=createOwnedBackupArtifactService({onJournalFailure:event=>{reports.push(event);},
        ownershipStore:createBackupArtifactOwnershipStore({getPoolFn:()=>({connect:async()=>{const client=await getPool().connect();pid=client.processID;return client;}})}),
        createDirectorySyncService:options=>createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{
          const handle=await open(...args),target=++attempts===failAt;
          if(target)targetHandle=handle;
          return {stat:(...values)=>handle.stat(...values),sync:async()=>{
            if(target&&stage==='unsupported')throw primary;
            await handle.sync();realSyncs++;
            if(target&&!['close-only','owner-loss'].includes(stage))throw primary;
          },close:async()=>{
            await handle.close();closes++;
            if(target){ready.resolve();await finish.promise;if(stage!=='owner-loss'&&stage!=='unsupported')throw secondary;}
          }};
        }}),
      });
      const task=(stage==='recovery-final'?owner.recoverIncompleteFileOperations():deleting?owner.deleteBackupArtifact({artifact}):owner.publishBackupArtifact(draft))
        .then(value=>({value}),error=>({error}));tasks.push(task);
      await Promise.race([ready.promise,task.then(()=>{throw new Error('checkpoint settled before close barrier');})]);
      await assert.rejects(targetHandle.stat(),{code:'EBADF'});
      const before=await row(draft,deleting?'delete':'publish'),phase=deleting||stage==='recovery-final'?'prepared':'temporary_ready';
      assert.equal(before.status,phase);assert.equal(before.last_error_code,null);assert.equal(await count(draft),deleting?1:0);
      assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy,true);
      await assert.rejects(recovery.publishBackupArtifact(draft),{code:'backup_artifact_operation_busy'});
      if(stage==='owner-loss'){
        assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS stopped',[pid])).rows[0].stopped,true);
        const deadline=Date.now()+5000;
        while((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active',[pid])).rows[0].active){assert.ok(Date.now()<deadline);await new Promise(resolve=>{setTimeout(resolve,10);});}
        assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy,true);
      }
      if(deleting)await assert.rejects(readFile(artifact.storagePath),{code:'ENOENT'});
      else {
        assert.equal(await readFile(draft.artifact.storagePath,'utf8'),draft.content);
        if(stage==='publish-cleanup'||stage==='recovery-final')await assert.rejects(readFile(before.temporary_path),{code:'ENOENT'});
        else assert.equal(await readFile(before.temporary_path,'utf8'),draft.content);
      }
      finish.resolve();const outcome=await task,failed=await row(draft,deleting?'delete':'publish');
      assert.equal(attempts,failAt);assert.equal(closes,failAt);assert.equal(failed.status,phase);assert.equal(failed.completed_at,null);
      assert.equal(await count(draft),deleting?1:0);
      if(stage==='owner-loss'){
        assert.equal(outcome.error.code,'backup_artifact_owner_lost');assert.equal(failed.last_error_code,null);assert.equal(reports.length,1);
      }else{
        if(stage==='recovery-final')assert.equal(outcome.value.deferredCount,1);
        else assert.equal(outcome.error,stage==='close-only'?secondary:primary);
        assert.equal(failed.last_error_code,primary===null||stage==='unsupported'?'backup_artifact_file_operation_failed':stage==='close-only'?'EIO':primary.code);
        assert.doesNotMatch(failed.last_error_message,/private|backup\.json/u);
      }
      assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount,1);
      assert.equal((await row(draft,deleting?'delete':'publish')).status,'completed');assert.equal(await count(draft),deleting?0:1);
      cases.push({stage,directoryAttempts:attempts,realSyncs,realCloses:closes,closedBeforeRelease:true,phasePreserved:true,localAdmissionHeld:true,freshRecoveryCompleted:true});
    }
    const denied=await draftFor('permission');let nativeFailure;
    const owner=createOwnedBackupArtifactService({createDirectorySyncService:options=>createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{
      await chmod(args[0],0o100);
      try{return await open(...args);}catch(error){nativeFailure=error;throw error;}finally{await chmod(args[0],0o700);}
    }})});
    await assert.rejects(owner.publishBackupArtifact(denied),error=>error===nativeFailure&&error.code==='EACCES');
    assert.equal((await row(denied,'publish')).status,'temporary_ready');assert.equal((await row(denied,'publish')).last_error_code,'EACCES');assert.equal(await count(denied),0);
    assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount,1);
    const cross=await draftFor('cross-directory'),temporaryParent=join(directory,'cross-temporary');await mkdir(temporaryParent);
    const temporaryPath=join(temporaryParent,'owned.partial');await writeFile(temporaryPath,cross.content,{mode:0o600});
    await store.createFileOperation({artifactSnapshot:cross.artifact,filename:cross.artifact.filename,operationType:'publish',storagePath:cross.artifact.storagePath,temporaryPath,
      expectedFileSha256:createHash('sha256').update(cross.content).digest('hex'),expectedFileSizeBytes:Buffer.byteLength(cross.content)});
    const synced=[];
    const crossOwner=createOwnedBackupArtifactService({createDirectorySyncService:options=>createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{synced.push(args[0]);return open(...args);}})});
    assert.equal((await crossOwner.recoverIncompleteFileOperations()).completedCount,1);
    assert.deepEqual(synced,[dirname(cross.artifact.storagePath),temporaryParent]);assert.equal(await count(cross),1);await assert.rejects(readFile(temporaryPath),{code:'ENOENT'});
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    t.diagnostic(JSON.stringify({cases,actualPermissionFailure:true,bothRecordedParentsSynced:true,unsupportedNeverCompleted:true,advisoryLocksRetired:true,
      controlledFailuresAfterRealSyncAndClose:true,unsupportedSyncIsControlledBeforeRealSync:true,powerLossNotTested:true}));
  }finally{
    for(const release of releases)release();await Promise.allSettled(tasks);
    await app.systemModule.runtimeResourceMonitor.stop();await rm(directory,{recursive:true,force:true});
  }
});

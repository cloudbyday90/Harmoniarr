/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { createBackupArtifactDirectoryCreationService } from '../../src/server/recovery/backup-artifact-directory-creation-service.js';
import { createBackupArtifactDirectorySyncService } from '../../src/server/recovery/backup-artifact-directory-sync-service.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('first-use directory creation checkpoints ancestor entries and recovery never skips an uncertain existing chain', { timeout:60_000 }, async t=>{
  t.after(closePool);
  const anchor=await mkdtemp('/tmp/backup-create-'),root=join(anchor,'backups');
  process.env.HARMONIARR_BACKUPS=root;
  const app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
  const recovery=app.systemModule.backupArtifactFileOperationService,store=createBackupArtifactFileOperationStore();
  const tasks=[],releases=[],cases=[];
  const draftFor=name=>createBackupArtifactFixture({storagePath:join(root,name,'nested','backup.json'),filename:name+'.json'});
  const row=async draft=>(await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 ORDER BY created_at DESC LIMIT 1',[draft.artifact.filename])).rows[0];
  const count=async draft=>(await getPool().query('SELECT count(*)::int AS count FROM backup_artifacts WHERE filename=$1',[draft.artifact.filename])).rows[0].count;
  try{
    await assert.rejects(lstat(root),{code:'ENOENT'});
    for(const stage of ['cold-root','existing-chain','owner-loss']){
      const draft=draftFor(stage),ready=Promise.withResolvers(),finish=Promise.withResolvers();releases.push(()=>finish.resolve());
      const synced=[];let pid,heldHandle,closes=0;
      const primary=stage==='cold-root'?null:Object.assign(new Error('private creation checkpoint'),{code:'EIO'});
      const owner=createOwnedBackupArtifactService({onJournalFailure:()=>{},
        ownershipStore:createBackupArtifactOwnershipStore({getPoolFn:()=>({connect:async()=>{const client=await getPool().connect();pid=client.processID;return client;}})}),
        createDirectoryCreationService:options=>createBackupArtifactDirectoryCreationService({...options,directorySyncService:createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{
          const handle=await open(...args),hold=args[0]===anchor;synced.push(args[0]);if(hold)heldHandle=handle;
          return {stat:(...values)=>handle.stat(...values),sync:async()=>{await handle.sync();if(hold&&stage!=='owner-loss')throw primary;},close:async()=>{
            await handle.close();closes++;if(hold){ready.resolve();await finish.promise;if(stage!=='owner-loss')throw new Error('secondary close');}
          }};
        }})}),
      });
      const task=owner.publishBackupArtifact(draft).then(value=>({value}),error=>({error}));tasks.push(task);
      await Promise.race([ready.promise,task.then(()=>{throw new Error('creation settled before close checkpoint');})]);
      await assert.rejects(heldHandle.stat(),{code:'EBADF'});
      assert.deepEqual(synced,[join(root,stage,'nested'),join(root,stage),root,anchor]);assert.equal(closes,4);
      for(const path of synced.slice(0,3))assert.equal(Number((await lstat(path)).mode&0o777),0o700);
      const before=await row(draft);assert.equal(before.status,'prepared');assert.equal(before.last_error_code,null);
      await assert.rejects(readFile(before.temporary_path),{code:'ENOENT'});await assert.rejects(readFile(draft.artifact.storagePath),{code:'ENOENT'});
      assert.equal(await count(draft),0);assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy,true);
      await assert.rejects(recovery.publishBackupArtifact(draft),{code:'backup_artifact_operation_busy'});
      if(stage==='owner-loss'){
        assert.equal((await getPool().query('SELECT pg_terminate_backend($1) AS stopped',[pid])).rows[0].stopped,true);
        const deadline=Date.now()+5000;
        while((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active',[pid])).rows[0].active){assert.ok(Date.now()<deadline);await new Promise(resolve=>{setTimeout(resolve,10);});}
        assert.equal((await recovery.recoverIncompleteFileOperations()).ownershipBusy,true);
      }
      finish.resolve();const outcome=await task;
      if(stage==='owner-loss')assert.equal(outcome.error.code,'backup_artifact_owner_lost');else assert.equal(outcome.error,primary);
      assert.equal((await row(draft)).status,'prepared');assert.equal(await count(draft),0);
      const verified=[];
      const fresh=createOwnedBackupArtifactService({createDirectoryCreationService:options=>createBackupArtifactDirectoryCreationService({...options,
        mkdirFn:async()=>{assert.fail('recovery cannot mkdir');},directorySyncService:createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{verified.push(args[0]);return open(...args);}})})});
      assert.equal((await fresh.recoverIncompleteFileOperations()).abandonedCount,1);
      assert.deepEqual(verified,synced);assert.equal((await row(draft)).status,'abandoned');assert.equal(await count(draft),0);
      const published=await recovery.publishBackupArtifact(draft);assert.equal(published.filename,draft.artifact.filename);
      assert.equal(await readFile(published.storagePath,'utf8'),draft.content);assert.equal(await count(draft),1);
      cases.push({stage,checkpointedDirectories:4,realCloseBeforeRelease:true,noByteWriteBeforeReadiness:true,localAdmissionHeld:true,recoveryRepeatedExistingChain:true,unwrittenIntentAbandoned:true,freshPublicationCompleted:true});
    }
    const denied=draftFor('denied-mkdir');let deniedError;
    const permissionOwner=createOwnedBackupArtifactService({createDirectoryCreationService:options=>createBackupArtifactDirectoryCreationService({...options,mkdirFn:async(...args)=>{
      if(args[0]===join(root,'denied-mkdir'))await chmod(root,0o500);
      try{return await mkdir(...args);}catch(error){if(error.code==='EACCES')deniedError=error;throw error;}finally{await chmod(root,0o700);}
    }})});
    await assert.rejects(permissionOwner.publishBackupArtifact(denied),error=>error===deniedError&&error.code==='EACCES');
    const partial=await row(denied);assert.equal(partial.status,'prepared');assert.equal(partial.last_error_code,'EACCES');assert.equal(await count(denied),0);
    assert.equal((await recovery.recoverIncompleteFileOperations()).deferredCount,1);await assert.rejects(lstat(join(root,'denied-mkdir')),{code:'ENOENT'});
    await recovery.publishBackupArtifact(denied);assert.equal((await recovery.recoverIncompleteFileOperations()).completedCount,1);
    const saved=draftFor('saved-bytes');await mkdir(join(root,'saved-bytes','nested'),{recursive:true,mode:0o700});
    const temporaryPath=join(root,'saved-bytes','nested','.saved.partial');await writeFile(temporaryPath,saved.content,{mode:0o600});
    await store.createFileOperation({artifactSnapshot:saved.artifact,operationType:'publish',filename:saved.artifact.filename,storagePath:saved.artifact.storagePath,temporaryPath,
      expectedFileSha256:createHash('sha256').update(saved.content).digest('hex'),expectedFileSizeBytes:Buffer.byteLength(saved.content)});
    const repeated=[];
    const savedOwner=createOwnedBackupArtifactService({createDirectoryCreationService:options=>createBackupArtifactDirectoryCreationService({...options,mkdirFn:async()=>{assert.fail('saved recovery cannot mkdir');},
      directorySyncService:createBackupArtifactDirectorySyncService({...options,openFn:async(...args)=>{repeated.push(args[0]);return open(...args);}})})});
    assert.equal((await savedOwner.recoverIncompleteFileOperations()).completedCount,1);assert.equal(await count(saved),1);assert.equal(repeated.at(-1),anchor);
    const outside=join(anchor,'outside');await mkdir(outside);
    await symlink(outside,join(root,'linked'));
    for(const storagePath of [join(outside,'out-of-scope.json'),join(root,'linked','redirected.json')]){
      const draft=createBackupArtifactFixture({storagePath,filename:storagePath.includes('redirected')?'redirected.json':'out-of-scope.json'});
      await assert.rejects(recovery.publishBackupArtifact(draft),{code:'backup_artifact_directory_scope_invalid'});
      assert.equal((await row(draft)).status,'prepared');assert.equal(await count(draft),0);
      await assert.rejects(readFile(storagePath),{code:'ENOENT'});
    }
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    t.diagnostic(JSON.stringify({cases,actualMkdirPermissionFailure:true,missingRecoveryNeverMkdir:true,savedBytesRecoveryCheckpointed:true,scopeAndSymlinkRefused:true,privateModeVerified:true,advisoryLocksRetired:true,
      controlledFailuresAfterRealDirectorySyncAndClose:true,anchorWasProvisioned:true,powerLossNotTested:true}));
  }finally{
    for(const release of releases)release();await Promise.allSettled(tasks);await app.systemModule.runtimeResourceMonitor.stop();await rm(anchor,{recursive:true,force:true});
  }
});

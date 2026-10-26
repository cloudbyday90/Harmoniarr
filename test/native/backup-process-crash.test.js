/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { backupCrashPlan } from '../../testing/server/backup-crash-plan.js';
import { startBackupCrashProcess } from '../../testing/server/backup-crash-process.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('abrupt application-service process loss recovers actual backup files, journal and inventory through a fresh default process', {timeout:120_000}, async t=>{
  const anchor=await mkdtemp('/tmp/backup-process-crash-'),root=join(anchor,'backups');await mkdir(root,{mode:0o700});process.env.HARMONIARR_BACKUPS=root;
  const app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'}),children=new Set(),cases=[];
  const zero={completedCount:0,deferredCount:0,awaitingConfirmationCount:0,abandonedCount:0};
  const snapshot=async plan=>{
    const operation=(await getPool().query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2 ORDER BY created_at DESC LIMIT 1',[plan.checkpoint+'.json',plan.operation])).rows[0];
    const inventory=(await getPool().query('SELECT * FROM backup_artifacts WHERE filename=$1',[plan.checkpoint+'.json'])).rows;
    assert.ok(operation);return {operation,inventory};
  };
  async function bytes(path,expected,content){
    if(expected==='missing'){if(path)await assert.rejects(readFile(path),{code:'ENOENT'});return;}
    assert.equal(await readFile(path,'utf8'),expected==='partial'?content.slice(0,32):content);
  }
  const start=(mode,checkpoint)=>{const child=startBackupCrashProcess({mode,checkpoint,root,signal:t.signal});children.add(child);return child;};
  async function retire(child){await child.dispose();assert.equal(child.isClosed(),true);assert.equal(child.outputBytes(),0);children.delete(child);}
  async function recover(checkpoint,producerPid){
    const child=start('recover',checkpoint);
    return withWorkerTaskCleanup(async()=>{const result=await child.complete();assert.notEqual(result.processPid,producerPid);return result;},()=>retire(child));
  }
  async function backendRetired(pid){
    const deadline=Date.now()+5000;
    while((await getPool().query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active',[pid])).rows[0].active){assert.ok(Date.now()<deadline,'original application backend must retire');await new Promise(resolve=>{setTimeout(resolve,10);});}
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE pid=$1 AND locktype='advisory'",[pid])).rows[0].count,0);
  }
  await withWorkerTaskCleanup(async()=>{
    for(const plan of backupCrashPlan){
      const draft=createBackupArtifactFixture({storagePath:join(root,plan.checkpoint,'backup.json'),filename:plan.checkpoint+'.json'});
      if(plan.operation==='delete')await app.systemModule.backupArtifactFileOperationService.publishBackupArtifact(draft);
      const child=start('crash',plan.checkpoint);let before,checkpoint;
      await withWorkerTaskCleanup(async()=>{
        checkpoint=await child.waitReady();
        assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND granted",[checkpoint.backendPid])).rows[0].count,1);
        before=await snapshot(plan);assert.equal(before.operation.status,plan.phase);assert.equal(before.inventory.length,plan.catalog);assert.equal(before.operation.last_error_code,null);
        assert.equal(before.operation.completed_at!==null,plan.phase==='completed');
        await bytes(before.operation.temporary_path,plan.temporary,draft.content);await bytes(draft.artifact.storagePath,plan.final,draft.content);
        await child.crash();assert.equal(child.isClosed(),true);assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
        await backendRetired(checkpoint.backendPid);
        assert.deepEqual(await snapshot(plan),before);
      },()=>retire(child));
      let recovered=await recover(plan.checkpoint,child.pid);
      if(plan.recovery==='missing-tree'){
        assert.deepEqual(recovered.first,{...zero,deferredCount:1});assert.deepEqual(recovered.second,recovered.first);
        assert.equal((await snapshot(plan)).operation.status,'prepared');await assert.rejects(lstat(dirname(draft.artifact.storagePath)),{code:'ENOENT'});
        // Explicit fixture repair is separate from default recovery, which must not mkdir.
        await mkdir(dirname(draft.artifact.storagePath),{mode:0o700});recovered=await recover(plan.checkpoint,child.pid);
        assert.deepEqual(recovered.first,{...zero,abandonedCount:1});assert.deepEqual(recovered.second,zero);
      }else if(plan.recovery==='confirmation'){
        assert.deepEqual(recovered.first,{...zero,awaitingConfirmationCount:1});assert.deepEqual(recovered.second,recovered.first);
      }else{
        const key=plan.recovery==='abandoned'?'abandonedCount':'completedCount';
        assert.deepEqual(recovered.first,plan.recovery==='terminal'?zero:{...zero,[key]:1});assert.deepEqual(recovered.second,zero);
      }
      const after=await snapshot(plan),unwritten=['missing-tree','abandoned'].includes(plan.recovery),held=plan.recovery==='confirmation';
      assert.equal(after.operation.status,held?'awaiting_confirmation':unwritten?'abandoned':'completed');
      assert.equal(after.operation.completed_at!==null,!held);
      assert.equal(after.inventory.length,plan.operation==='delete'||unwritten||held?0:1);
      await bytes(after.operation.temporary_path,held?'partial':'missing',draft.content);
      await bytes(draft.artifact.storagePath,plan.operation==='delete'||unwritten||held?'missing':'complete',draft.content);
      if(plan.operation==='publish'&&before.inventory.length)assert.equal(after.inventory[0].id,before.inventory[0].id);
      if(plan.recovery==='terminal')assert.deepEqual(after,before);
      if(held)assert.equal(after.operation.last_error_code,'artifact_file_size_mismatch');
      cases.push({checkpoint:plan.checkpoint,operation:plan.operation,phaseAtCrash:plan.phase,recovery:plan.recovery,
        actualSigkillAndClose:true,originalBackendRetired:true,freshDefaultRecoveryProcess:true,repeatedRecoveryVerified:true,currentBytesAndCatalogVerified:true});
    }
    assert.equal((await getPool().query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    t.diagnostic(JSON.stringify({cases,processesClosed:true,advisoryLocksRetired:true,selectedPostCallBoundaries:true,partialWriteIsControlledPrefix:true,
      missingTreeRepairWasExplicit:true,productionRuntimeUnmodified:true,powerLossNotTested:true}));
  },async()=>{
    const retired=await Promise.allSettled([...children].map(retire));
    await app.systemModule.runtimeResourceMonitor.stop();await closePool();
    assert.ok(retired.every(row=>row.status==='fulfilled'),'retain fixture files after uncertain child retirement');await rm(anchor,{recursive:true,force:true});
  });
});

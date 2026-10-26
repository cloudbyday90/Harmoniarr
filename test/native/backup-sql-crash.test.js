/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { lstat,mkdir,mkdtemp,readFile,rm } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { closePool,getPool } from '../../src/server/database.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';
import { createBackupCrashProcessRunner } from '../../testing/server/backup-crash-process.js';
import { createBackupPgAckRelay } from '../../testing/server/backup-pg-ack-relay.js';
import { backupSqlCrashPlan,getBackupSqlCrashCase } from '../../testing/server/backup-sql-crash-plan.js';
import { backupSqlGateNamespace,backupSqlFixtureApplication,installBackupSqlCrashGate } from '../../testing/server/backup-sql-crash-gate.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
const startProcess=createBackupCrashProcessRunner({getCase:getBackupSqlCrashCase,childModuleUrl:new URL('../../testing/server/backup-sql-crash-child.js',import.meta.url),allowDispatch:true});
const zero={completedCount:0,deferredCount:0,awaitingConfirmationCount:0,abandonedCount:0};
test('in-flight backup SQL rollback and withheld committed acknowledgements recover through fresh default processes',{timeout:120_000},async t=>{
  const anchor=await mkdtemp('/tmp/backup-sql-crash-'),root=join(anchor,'backups');await mkdir(root,{mode:0o700});process.env.HARMONIARR_BACKUPS=root;
  const app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'}),pool=getPool(),children=new Set(),cases=[];
  async function until(probe,label){
    const deadline=Date.now()+5000;
    while(!await probe()){assert.ok(Date.now()<deadline,label);t.signal.throwIfAborted();await new Promise(resolve=>{setTimeout(resolve,15);});}
  }
  const activity=async pid=>(await pool.query('SELECT application_name,state,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
  async function retired(pid){
    await until(async()=>!await activity(pid),'original fixture backend must retire');
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE pid=$1 AND locktype='advisory'",[pid])).rows[0].count,0);
  }
  async function cancelOwned(pid,checkpoint){
    const row=await activity(pid);
    if(!row)return false;
    assert.equal(row.application_name,backupSqlFixtureApplication(checkpoint));assert.equal(row.state,'active');
    const result=await pool.query("SELECT pg_cancel_backend(pid) AS cancelled FROM pg_stat_activity WHERE pid=$1 AND application_name=$2 AND state='active'",[pid,backupSqlFixtureApplication(checkpoint)]);
    if(result.rows.length)assert.equal(result.rows[0].cancelled,true);
    return result.rows.length===1;
  }
  async function snapshot(plan){
    const operations=(await pool.query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2',[plan.checkpoint+'.json',plan.operation])).rows;
    assert.ok(operations.length<=1);
    return {operation:operations[0]??null,inventory:(await pool.query('SELECT * FROM backup_artifacts WHERE filename=$1',[plan.checkpoint+'.json'])).rows};
  }
  async function bytes(path,expected,content){
    if(expected==='missing'){if(path)await assert.rejects(readFile(path),{code:'ENOENT'});return;}
    assert.equal(await readFile(path,'utf8'),content);
  }
  const start=(mode,checkpoint,pgPort)=>{const child=startProcess({mode,checkpoint,root,pgPort,signal:t.signal});children.add(child);return child;};
  async function retire(child){await child.dispose();assert.equal(child.isClosed(),true);assert.equal(child.outputBytes(),0);children.delete(child);}
  async function recover(plan,oldPid){
    const child=start('recover',plan.checkpoint);
    return withWorkerTaskCleanup(async()=>{const result=await child.complete();assert.notEqual(result.processPid,oldPid);return result;},()=>retire(child));
  }
  await withWorkerTaskCleanup(async()=>{
    await installBackupSqlCrashGate(pool);
    for(const plan of backupSqlCrashPlan){
      t.diagnostic('SQL crash checkpoint: '+plan.checkpoint);
      const draft=createBackupArtifactFixture({storagePath:join(root,plan.checkpoint,'backup.json'),filename:plan.checkpoint+'.json'});
      if(plan.operation==='delete')await app.systemModule.backupArtifactFileOperationService.publishBackupArtifact(draft);
      let holder,relay,child,checkpoint,before,cancelled=false,holderPid;
      await withWorkerTaskCleanup(async()=>{
        if(plan.mode==='wait-rollback'){
          holder=await pool.connect();await holder.query('BEGIN');
          holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          await holder.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[backupSqlGateNamespace,plan.gateKey]);
        }else relay=await createBackupPgAckRelay();
        child=start('crash',plan.checkpoint,relay?.port);checkpoint=await child.waitReady();
        assert.equal((await activity(checkpoint.backendPid)).application_name,backupSqlFixtureApplication(plan.checkpoint));
        before=await snapshot(plan);
        if(relay){
          assert.equal((await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=$1',[checkpoint.backendPid])).rows[0].ssl,false);
          relay.arm(checkpoint.backendPid);
        }
        await child.dispatch();
        if(holder){
          await until(async()=>{const row=await activity(checkpoint.backendPid);return row?.wait_event_type==='Lock'&&row.blockers.includes(holderPid);},'actual target SQL must wait on the fixture holder');
          assert.deepEqual(await snapshot(plan),before);
        }else{
          await until(async()=>{const state=relay.state();assert.equal(state.error,false);return state.command===plan.verb&&state.ready==='I'&&state.withheldBytes>0;},'target commit response must be consumed and withheld');
        }
        const atCrash=await snapshot(plan);
        assert.equal(atCrash.operation?.status??null,plan.expectedPhase);assert.equal(atCrash.inventory.length,plan.catalog);
        if(atCrash.operation){assert.equal(atCrash.operation.last_error_code,null);await bytes(atCrash.operation.temporary_path,plan.temporary,draft.content);}
        await bytes(draft.artifact.storagePath,plan.final,draft.content);
        await child.crash();assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
        if(holder){
          cancelled=await cancelOwned(checkpoint.backendPid,plan.checkpoint);await retired(checkpoint.backendPid);
          assert.deepEqual(await snapshot(plan),before);
          await holder.query('ROLLBACK');holder.release();holder=null;
        }else{
          const busy=await app.systemModule.backupArtifactFileOperationService.recoverIncompleteFileOperations();assert.equal(busy.ownershipBusy,true);
          assert.deepEqual(await snapshot(plan),atCrash);await relay.close();relay=null;await retired(checkpoint.backendPid);
        }
        assert.deepEqual(await snapshot(plan),atCrash);before=atCrash;
      },async()=>{
        if(child)await retire(child);
        if(relay){await relay.close();relay=null;}
        if(checkpoint){if(holder)await cancelOwned(checkpoint.backendPid,plan.checkpoint);await retired(checkpoint.backendPid);}
        if(holder){await holder.query('ROLLBACK');holder.release();holder=null;}
      });
      let result=await recover(plan,child.pid);
      if(plan.recovery==='missing-tree'){
        assert.deepEqual(result.first,{...zero,deferredCount:1});assert.deepEqual(result.second,result.first);
        await assert.rejects(lstat(dirname(draft.artifact.storagePath)),{code:'ENOENT'});
        await mkdir(dirname(draft.artifact.storagePath),{mode:0o700});result=await recover(plan,child.pid);
        assert.deepEqual(result.first,{...zero,abandonedCount:1});assert.deepEqual(result.second,zero);
      }else{
        assert.deepEqual(result.first,plan.recovery==='completed'?{...zero,completedCount:1}:zero);assert.deepEqual(result.second,zero);
      }
      const after=await snapshot(plan),untouched=plan.recovery==='none',unwritten=plan.recovery==='missing-tree';
      assert.equal(after.operation?.status??null,untouched?null:unwritten?'abandoned':'completed');
      assert.equal(after.inventory.length,untouched?plan.catalog:unwritten||plan.operation==='delete'?0:1);
      if(after.operation){
        assert.equal(after.operation.completed_at!==null,true);await bytes(after.operation.temporary_path,'missing',draft.content);
        assert.equal(after.operation.last_error_code,unwritten?'artifact_file_missing':null);
      }
      await bytes(draft.artifact.storagePath,untouched?plan.final:unwritten||plan.operation==='delete'?'missing':'complete',draft.content);
      if(before.inventory.length&&after.inventory.length)assert.equal(after.inventory[0].id,before.inventory[0].id);
      if(untouched||plan.recovery==='terminal')assert.deepEqual(after,before);
      cases.push({checkpoint:plan.checkpoint,operation:plan.operation,outcome:plan.mode,phaseAtCrash:plan.expectedPhase,serverCancellationRequired:cancelled,
        actualSqlWaitVerified:plan.mode==='wait-rollback',wireAcknowledgementWithheld:plan.mode==='lost-ack',oldOwnerBusyVerified:plan.mode==='lost-ack',
        originalBackendRetired:true,actualSigkillAndClose:true,freshDefaultRecoveryProcess:true,repeatedRecoveryVerified:true,currentBytesAndCatalogVerified:true});
    }
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    t.diagnostic(JSON.stringify({cases,processesClosed:true,advisoryLocksRetired:true,productionRuntimeUnmodified:true,testOnlyLoopbackRelay:true,
      missingTreeRepairWasExplicit:true,powerLossNotTested:true}));
  },async()=>{
    const results=await Promise.allSettled([...children].map(retire));
    await app.systemModule.runtimeResourceMonitor.stop();await closePool();
    assert.ok(results.every(row=>row.status==='fulfilled'),'retain fixture files if process retirement is uncertain');await rm(anchor,{recursive:true,force:true});
  });
});

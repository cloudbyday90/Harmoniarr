/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import test from 'node:test';
import pg from 'pg';
import {createApp} from '../../src/server/app.js';
import {buildConnectionConfig,closePool} from '../../src/server/database.js';
import {withWorkerTaskCleanup} from '../../src/server/worker-task-cleanup.js';
import {createBackupArtifactFixture} from '../../testing/server/backup-artifact-fixture.js';
import {createBackupCrashProcessRunner} from '../../testing/server/backup-crash-process.js';
import {createBackupPgAckRelay} from '../../testing/server/backup-pg-ack-relay.js';
import {createBackupPgCrashControl} from '../../testing/server/backup-pg-crash-control.js';
import {requireBackupPgCrashProfile} from '../../testing/server/backup-pg-crash-profile.js';
import {backupSqlCrashPlan,getBackupSqlCrashCase} from '../../testing/server/backup-sql-crash-plan.js';
import {backupSqlGateNamespace,backupSqlFixtureApplication,installBackupSqlCrashGate} from '../../testing/server/backup-sql-crash-gate.js';

const {profile}=await requireBackupPgCrashProfile();
const startProcess=createBackupCrashProcessRunner({getCase:getBackupSqlCrashCase,childModuleUrl:new URL('../../testing/server/backup-pg-crash-child.js',import.meta.url),allowDispatch:true});
const zero={completedCount:0,deferredCount:0,awaitingConfirmationCount:0,abandonedCount:0};
test('PostgreSQL immediate shutdown and WAL recovery preserve backup outcomes on an owned persistent volume',{timeout:120_000},async t=>{
  const control=await createBackupPgCrashControl(),anchor=await mkdtemp('/app/data/backup-pg-crash-'),root=join(anchor,'backups');
  await mkdir(root,{mode:0o700});process.env.HARMONIARR_BACKUPS=root;
  const children=new Set(),clients=new Set(),cases=[],beforeKernel=await profile.snapshot();
  async function connect(){
    const client=new pg.Client(buildConnectionConfig());let ended=false,errors=0;
    client.on('error',()=>{errors++;});client.once('end',()=>{ended=true;});
    const row={client,isEnded:()=>ended,errors:()=>errors};clients.add(row);await client.connect();return row;
  }
  async function retireClient(row){await row.client.end();assert.equal(row.isEnded(),true);clients.delete(row);}
  async function until(probe,label){
    const deadline=Date.now()+5000;
    while(!await probe()){assert.ok(Date.now()<deadline,label);t.signal.throwIfAborted();await new Promise(resolve=>{setTimeout(resolve,15);});}
  }
  async function snapshot(client,plan){
    const operations=(await client.query('SELECT * FROM backup_artifact_file_operations WHERE filename=$1 AND operation_type=$2',[plan.checkpoint+'.json',plan.operation])).rows;
    assert.ok(operations.length<=1);
    return {operation:operations[0]??null,inventory:(await client.query('SELECT * FROM backup_artifacts WHERE filename=$1',[plan.checkpoint+'.json'])).rows};
  }
  async function bytes(path,state,content){
    if(state==='missing'){if(path)await assert.rejects(readFile(path),{code:'ENOENT'});return;}
    assert.equal(await readFile(path,'utf8'),content);
  }
  const start=(mode,checkpoint,pgPort)=>{const child=startProcess({mode,checkpoint,root,pgPort,signal:t.signal});children.add(child);return child;};
  async function retire(child,quiet=false){await child.dispose();assert.equal(child.isClosed(),true);assert.ok(child.outputBytes()<=32_768);if(quiet)assert.equal(child.outputBytes(),0);children.delete(child);}
  async function recover(plan,oldPid){
    const child=start('recover',plan.checkpoint);
    return withWorkerTaskCleanup(async()=>{const result=await child.complete();assert.notEqual(result.processPid,oldPid);return result;},()=>retire(child,true));
  }
  await withWorkerTaskCleanup(async()=>{
    const setup=await connect();
    await installBackupSqlCrashGate(setup.client);
    await setup.client.query('CREATE TABLE fixture_backup_pg_crash_sentinels(checkpoint text PRIMARY KEY, marker text NOT NULL)');
    await retireClient(setup);
    for(const plan of backupSqlCrashPlan){
      t.diagnostic('PostgreSQL crash checkpoint: '+plan.checkpoint);
      const draft=createBackupArtifactFixture({storagePath:join(root,plan.checkpoint,'backup.json'),filename:plan.checkpoint+'.json'});
      if(plan.operation==='delete'){
        const app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
        await withWorkerTaskCleanup(()=>app.systemModule.backupArtifactFileOperationService.publishBackupArtifact(draft),
          async()=>{await app.systemModule.runtimeResourceMonitor.stop();await closePool();});
      }
      let observer,holder,relay,child,checkpoint,atCrash,stopped,restarted;
      await withWorkerTaskCleanup(async()=>{
        observer=await connect();
        const settings=(await observer.client.query("SELECT current_setting('fsync') AS fsync,current_setting('full_page_writes') AS full_page_writes,current_setting('synchronous_commit') AS synchronous_commit")).rows[0];
        assert.deepEqual(settings,{fsync:'on',full_page_writes:'on',synchronous_commit:'on'});
        await observer.client.query('CHECKPOINT');
        await observer.client.query('INSERT INTO fixture_backup_pg_crash_sentinels VALUES ($1,$2)',[plan.checkpoint,'committed-after-checkpoint']);
        if(plan.mode==='wait-rollback'){
          holder=await connect();await holder.client.query('BEGIN');
          await holder.client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[backupSqlGateNamespace,plan.gateKey]);
        }else relay=await createBackupPgAckRelay();
        child=start('crash',plan.checkpoint,relay?.port);checkpoint=await child.waitReady();
        const activity=async()=>(await observer.client.query('SELECT application_name,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[checkpoint.backendPid])).rows[0];
        assert.equal((await activity()).application_name,backupSqlFixtureApplication(plan.checkpoint));
        const before=await snapshot(observer.client,plan);
        if(relay){
          assert.equal((await observer.client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=$1',[checkpoint.backendPid])).rows[0].ssl,false);
          relay.arm(checkpoint.backendPid);
        }
        await child.dispatch();
        if(holder){
          const holderPid=holder.client.processID;
          await until(async()=>{const row=await activity();return row?.wait_event_type==='Lock'&&row.blockers.includes(holderPid);},'actual target must be blocked');
          assert.deepEqual(await snapshot(observer.client,plan),before);
        }else await until(async()=>{const state=relay.state();assert.equal(state.error,false);return state.command===plan.verb&&state.ready==='I'&&state.withheldBytes>0;},'committed response must be withheld');
        atCrash=await snapshot(observer.client,plan);assert.equal(atCrash.operation?.status??null,plan.expectedPhase);assert.equal(atCrash.inventory.length,plan.catalog);
        if(atCrash.operation)await bytes(atCrash.operation.temporary_path,plan.temporary,draft.content);
        await bytes(draft.artifact.storagePath,plan.final,draft.content);
        assert.equal(child.outputBytes(),0);
        stopped=await control.stop();
        await until(async()=>observer.isEnded()&&(!holder||holder.isEnded()),'old observer and blocker must disconnect');
        await retire(child);assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
        if(relay){await relay.close();relay=null;}
        await retireClient(observer);observer=null;if(holder){await retireClient(holder);holder=null;}
        restarted=await control.start(plan.checkpoint);
        assert.equal(restarted.identifier,stopped.identifier);assert.notEqual(restarted.newPid,stopped.oldPid);
        observer=await connect();
        assert.equal((await observer.client.query('SELECT marker FROM fixture_backup_pg_crash_sentinels WHERE checkpoint=$1',[plan.checkpoint])).rows[0].marker,'committed-after-checkpoint');
        assert.equal((await observer.client.query('SELECT pg_is_in_recovery() AS recovering')).rows[0].recovering,false);
        assert.equal((await observer.client.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=$1',[checkpoint.backendPid])).rows[0].count,0);
        assert.equal((await observer.client.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
        assert.deepEqual(await snapshot(observer.client,plan),atCrash);
      },async()=>{
        if(child)await retire(child);
        if(relay)await relay.close();
        if(holder)await retireClient(holder);
      });
      await withWorkerTaskCleanup(async()=>{
        let result=await recover(plan,child.pid);
        if(plan.recovery==='missing-tree'){
          assert.deepEqual(result.first,{...zero,deferredCount:1});assert.deepEqual(result.second,result.first);
          await assert.rejects(lstat(dirname(draft.artifact.storagePath)),{code:'ENOENT'});
          await mkdir(dirname(draft.artifact.storagePath),{mode:0o700});result=await recover(plan,child.pid);
          assert.deepEqual(result.first,{...zero,abandonedCount:1});assert.deepEqual(result.second,zero);
        }else{assert.deepEqual(result.first,plan.recovery==='completed'?{...zero,completedCount:1}:zero);assert.deepEqual(result.second,zero);}
        const after=await snapshot(observer.client,plan),untouched=plan.recovery==='none',unwritten=plan.recovery==='missing-tree';
        assert.equal(after.operation?.status??null,untouched?null:unwritten?'abandoned':'completed');
        assert.equal(after.inventory.length,untouched?plan.catalog:unwritten||plan.operation==='delete'?0:1);
        if(after.operation){
          assert.equal(after.operation.completed_at!==null,true);assert.equal(after.operation.last_error_code,unwritten?'artifact_file_missing':null);
          await bytes(after.operation.temporary_path,'missing',draft.content);
        }
        await bytes(draft.artifact.storagePath,untouched?plan.final:unwritten||plan.operation==='delete'?'missing':'complete',draft.content);
        if(atCrash.inventory.length&&after.inventory.length)assert.equal(after.inventory[0].id,atCrash.inventory[0].id);
        if(untouched||plan.recovery==='terminal')assert.deepEqual(after,atCrash);
        cases.push({checkpoint:plan.checkpoint,outcome:plan.mode,phaseAtCrash:plan.expectedPhase,immediateShutdownObserved:true,uncleanControlState:true,
          producerShutdownDiagnosticBytes:child.outputBytes(),
          walRedoObserved:true,sameClusterIdentifier:true,newPostmaster:true,sentinelPersisted:true,originalBackendAndLocksRetired:true,
          targetStatePreserved:true,freshDefaultRecovery:true,repeatedRecovery:true,currentBytesAndCatalogVerified:true});
      },()=>retireClient(observer));
    }
    assert.equal((await profile.snapshot()).oomKills,beforeKernel.oomKills);
    t.diagnostic(JSON.stringify({cases,persistentVolumeStorage:true,oldConnectionsRetired:true,childrenClosed:true,productionRuntimeUnmodified:true,
      explicitMissingTreeRepair:true,powerLossNotTested:true,databaseRunningAtCompletion:true}));
  },async()=>{
    const results=await Promise.allSettled([...children].map(child=>retire(child)));
    const ended=await Promise.allSettled([...clients].map(retireClient));await closePool();
    assert.ok([...results,...ended].every(row=>row.status==='fulfilled'),'retain fixture files after uncertain retirement');await rm(anchor,{recursive:true,force:true});
  });
});

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createApp} from '/app/server-dist/app.js';
import {closePool,getPool} from '/app/server-dist/database.js';
import {withWorkerTaskCleanup} from '/app/server-dist/worker-task-cleanup.js';
import {createBackupArtifactFixture} from './backup-artifact-fixture.js';
import {createBackupCrashProcessRunner} from './backup-crash-process.js';
import {createBackupPgAckRelay} from './backup-pg-ack-relay.js';
import {backupSqlGateNamespace,backupSqlFixtureApplication,installBackupSqlCrashGate} from './backup-sql-crash-gate.js';
import {getBackupSqlCrashCase} from './backup-sql-crash-plan.js';
import {backupContainerRoot,backupContainerBackups,backupContainerLog,backupContainerBytes,backupContainerSnapshot,writeBackupContainerRecord} from './backup-container-record.js';
import {waitForBackupStartupRecovery} from './backup-startup-recovery-wait.js';

const startProcess=createBackupCrashProcessRunner({getCase:getBackupSqlCrashCase,childModuleUrl:new URL('./backup-pg-crash-child.js',import.meta.url),allowDispatch:true});
export async function prepareBackupContainer(plan,manifest,send){
  const pool=getPool();let holder,relay,child,app;
  await withWorkerTaskCleanup(async()=>{
    await waitForBackupStartupRecovery(pool);
    await mkdir(backupContainerBackups,{recursive:true,mode:0o700});await mkdir(join(backupContainerRoot,'logs'),{recursive:true,mode:0o700});
    if(!(await pool.query("SELECT to_regclass('fixture_backup_container_sentinels') AS name")).rows[0].name){
      await installBackupSqlCrashGate(pool);
      await pool.query('CREATE TABLE fixture_backup_container_sentinels(checkpoint text PRIMARY KEY, marker text NOT NULL)');
    }
    await pool.query("ALTER SYSTEM SET logging_collector='on'");
    await pool.query("ALTER SYSTEM SET log_directory='/app/data/backup-container-crash/logs'");
    await pool.query("ALTER SYSTEM SET log_filename='container-recovery.log'");
    let logOffset=0;try{logOffset=(await stat(backupContainerLog)).size;}catch(error){if(error.code!=='ENOENT')throw error;}
    const draft=createBackupArtifactFixture({storagePath:join(backupContainerBackups,plan.checkpoint,'backup.json'),filename:plan.checkpoint+'.json'});
    if(plan.operation==='delete'){
      app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
      await app.systemModule.backupArtifactFileOperationService.publishBackupArtifact(draft);
    }
    const settings=(await pool.query("SELECT current_setting('fsync') AS fsync,current_setting('full_page_writes') AS full_page_writes,current_setting('synchronous_commit') AS synchronous_commit")).rows[0];
    assert.deepEqual(settings,{fsync:'on',full_page_writes:'on',synchronous_commit:'on'});
    await pool.query('CHECKPOINT');await pool.query('INSERT INTO fixture_backup_container_sentinels VALUES ($1,$2)',[plan.checkpoint,manifest.profileId]);
    if(plan.mode==='wait-rollback'){
      holder=await pool.connect();holder.on('error',()=>{});await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[backupSqlGateNamespace,plan.gateKey]);
    }else relay=await createBackupPgAckRelay();
    child=startProcess({mode:'crash',checkpoint:plan.checkpoint,root:backupContainerBackups,pgPort:relay?.port});
    const checkpoint=await child.waitReady();
    const activity=async()=>(await pool.query('SELECT application_name,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[checkpoint.backendPid])).rows[0];
    assert.equal((await activity()).application_name,backupSqlFixtureApplication(plan.checkpoint));
    const before=await backupContainerSnapshot(pool,plan);
    if(relay){
      assert.equal((await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=$1',[checkpoint.backendPid])).rows[0].ssl,false);
      relay.arm(checkpoint.backendPid);
    }
    await child.dispatch();const deadline=Date.now()+5000;
    for(;;){
      assert.ok(!child.isClosed(),'producer must remain pending');
      if(holder){const row=await activity();if(row?.wait_event_type==='Lock'&&row.blockers.includes(holder.processID))break;}
      else{const state=relay.state();assert.equal(state.error,false);if(state.command===plan.verb&&state.ready==='I'&&state.withheldBytes>0)break;}
      assert.ok(Date.now()<deadline,'actual SQL checkpoint must be observed');await new Promise(resolve=>{setTimeout(resolve,15);});
    }
    const snapshot=await backupContainerSnapshot(pool,plan);
    if(holder)assert.deepEqual(snapshot,before);
    assert.equal(snapshot.operation?.status??null,plan.expectedPhase);assert.equal(snapshot.inventory.length,plan.catalog);
    if(snapshot.operation)await backupContainerBytes(snapshot.operation.temporary_path,plan.temporary,draft.content);
    await backupContainerBytes(draft.artifact.storagePath,plan.final,draft.content);assert.equal(child.outputBytes(),0);
    const clusterId=(await pool.query('SELECT system_identifier::text AS id FROM pg_control_system()')).rows[0].id;
    const snapshotSha256=await writeBackupContainerRecord(plan.checkpoint,{checkpoint:plan.checkpoint,clusterId,profileId:manifest.profileId,logOffset,snapshot});
    send({event:'prepared',checkpoint:plan.checkpoint,containerId:manifest.containerId,clusterId,snapshotSha256});
    // The host kills the container. Unexpected producer completion must fail beforehand.
    while(!child.isClosed())await new Promise(resolve=>{setTimeout(resolve,100);});
    throw new Error('Producer closed before owned container termination');
  },async()=>{
    if(child)await child.dispose();if(relay)await relay.close();
    if(holder){await holder.query('ROLLBACK');holder.release();}
    await app?.systemModule.runtimeResourceMonitor.stop();await closePool();
  });
}

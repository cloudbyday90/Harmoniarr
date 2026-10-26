/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {lstat,mkdir,readFile,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createApp} from '/app/server-dist/app.js';
import {closePool,getPool} from '/app/server-dist/database.js';
import {withWorkerTaskCleanup} from '/app/server-dist/worker-task-cleanup.js';
import {createBackupArtifactFixture} from './backup-artifact-fixture.js';
import {backupSqlFixtureApplication} from './backup-sql-crash-gate.js';
import {backupContainerBackups,backupContainerLog,backupContainerBytes,backupContainerSnapshot,readBackupContainerRecord} from './backup-container-record.js';

export async function verifyBackupContainer(plan,manifest,expectedHash,expectedClusterId){
  const record=await readBackupContainerRecord(plan.checkpoint,expectedHash);
  assert.equal(record.checkpoint,plan.checkpoint);assert.equal(record.profileId,manifest.profileId);assert.equal(record.clusterId,expectedClusterId);
  const pool=getPool(),app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
  return withWorkerTaskCleanup(async()=>{
    const clusterId=(await pool.query('SELECT system_identifier::text AS id FROM pg_control_system()')).rows[0].id;assert.equal(clusterId,expectedClusterId);
    assert.equal((await pool.query('SELECT marker FROM fixture_backup_container_sentinels WHERE checkpoint=$1',[plan.checkpoint])).rows[0].marker,manifest.profileId);
    assert.equal((await pool.query('SELECT pg_is_in_recovery() AS recovering')).rows[0].recovering,false);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=$1',[backupSqlFixtureApplication(plan.checkpoint)])).rows[0].count,0);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")).rows[0].count,0);
    assert.deepEqual(JSON.parse(JSON.stringify(await backupContainerSnapshot(pool,plan))),record.snapshot);
    assert.ok((await stat(backupContainerLog)).size<=2_097_152);
    const log=(await readFile(backupContainerLog,'utf8')).slice(record.logOffset);
    for(const pattern of [/database system was interrupted/u,/redo starts at/u,/redo done at/u,/database system is ready to accept connections/u])assert.match(log,pattern);
    const draft=createBackupArtifactFixture({storagePath:join(backupContainerBackups,plan.checkpoint,'backup.json'),filename:plan.checkpoint+'.json'});
    if(record.snapshot.operation)await backupContainerBytes(record.snapshot.operation.temporary_path,plan.temporary,draft.content);
    await backupContainerBytes(draft.artifact.storagePath,plan.final,draft.content);
    const service=app.systemModule.backupArtifactFileOperationService,zero={completedCount:0,deferredCount:0,awaitingConfirmationCount:0,abandonedCount:0};
    let first=await service.recoverIncompleteFileOperations(),second=await service.recoverIncompleteFileOperations();
    if(plan.recovery==='missing-tree'){
      assert.deepEqual(first,{...zero,deferredCount:1});assert.deepEqual(second,first);await assert.rejects(lstat(dirname(draft.artifact.storagePath)),{code:'ENOENT'});
      await mkdir(dirname(draft.artifact.storagePath),{mode:0o700});
      first=await service.recoverIncompleteFileOperations();second=await service.recoverIncompleteFileOperations();
      assert.deepEqual(first,{...zero,abandonedCount:1});assert.deepEqual(second,zero);
    }else{assert.deepEqual(first,plan.recovery==='completed'?{...zero,completedCount:1}:zero);assert.deepEqual(second,zero);}
    const after=await backupContainerSnapshot(pool,plan),untouched=plan.recovery==='none',unwritten=plan.recovery==='missing-tree';
    assert.equal(after.operation?.status??null,untouched?null:unwritten?'abandoned':'completed');
    assert.equal(after.inventory.length,untouched?plan.catalog:unwritten||plan.operation==='delete'?0:1);
    if(after.operation){
      assert.equal(after.operation.completed_at!==null,true);assert.equal(after.operation.last_error_code,unwritten?'artifact_file_missing':null);
      await backupContainerBytes(after.operation.temporary_path,'missing',draft.content);
    }
    await backupContainerBytes(draft.artifact.storagePath,untouched?plan.final:unwritten||plan.operation==='delete'?'missing':'complete',draft.content);
    if(record.snapshot.inventory.length&&after.inventory.length)assert.equal(after.inventory[0].id,record.snapshot.inventory[0].id);
    if(untouched||plan.recovery==='terminal')assert.deepEqual(JSON.parse(JSON.stringify(after)),record.snapshot);
    return {event:'verified',checkpoint:plan.checkpoint,containerId:manifest.containerId,clusterId,snapshotSha256:expectedHash,repeatedRecovery:true,currentBytesAndCatalogVerified:true};
  },async()=>{await app.systemModule.runtimeResourceMonitor.stop();await closePool();});
}

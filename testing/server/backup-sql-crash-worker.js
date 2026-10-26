/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createApp } from '/app/server-dist/app.js';
import { closePool,getPool } from '/app/server-dist/database.js';
import { createBackupArtifactFileOperationStore } from '/app/server-dist/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactRepository } from '/app/server-dist/recovery/backup-artifact-repository.js';
import { createBackupArtifactOwnershipStore } from '/app/server-dist/recovery/backup-artifact-ownership-store.js';
import { createOwnedBackupArtifactService } from '/app/server-dist/recovery/owned-backup-artifact-service.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createBackupArtifactFixture } from './backup-artifact-fixture.js';
import { getBackupSqlCrashCase } from './backup-sql-crash-plan.js';
import { configureBackupSqlCrashGate } from './backup-sql-crash-gate.js';
import { requireDeploymentMemoryProfile } from './deployment-memory-profile.js';

export async function runBackupSqlCrashChild({requireProfile=requireDeploymentMemoryProfile}={}) {
await requireProfile();assert.equal(process.platform,'linux');assert.equal(typeof process.send,'function');
const [mode,checkpoint,root]=process.argv.slice(2),plan=getBackupSqlCrashCase(checkpoint);
assert.ok(['crash','recover'].includes(mode));assert.equal(root,process.env.HARMONIARR_BACKUPS);
const send=value=>new Promise((resolve,reject)=>{process.send({...value,processPid:process.pid,checkpoint},error=>error?reject(error):resolve());});
let expectedDisconnect=false,app,backendPid,hit=false;
process.on('disconnect',()=>{if(!expectedDisconnect)process.exitCode=1;});
async function before(table,verb,phase){
  if(plan.table!==table||plan.verb!==verb||(table==='backup_artifact_file_operations'&&plan.phase!==phase))return;
  assert.equal(hit,false);hit=true;
  const dispatch=new Promise((resolve,reject)=>{process.once('message',message=>{
    if(message?.event==='dispatch'&&Object.keys(message).length===1)resolve();else reject(new Error('Invalid SQL fixture dispatch'));
  });});
  await send({event:'checkpoint',backendPid});await dispatch;
}
try{
  await withWorkerTaskCleanup(async()=>{
    app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
    if(mode==='recover'){
      const service=app.systemModule.backupArtifactFileOperationService;
      await send({event:'recovered',first:await service.recoverIncompleteFileOperations(),second:await service.recoverIncompleteFileOperations()});return;
    }
    const store=createBackupArtifactFileOperationStore(),repository=createBackupArtifactRepository();
    const owner=createOwnedBackupArtifactService({
      ownershipStore:createBackupArtifactOwnershipStore({getPoolFn:()=>({connect:async()=>{
        const client=await getPool().connect();await configureBackupSqlCrashGate(client,plan);
        backendPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return client;
      }})}),
      backupArtifactFileOperationStore:{...store,
        createFileOperation:async(...args)=>{await before('backup_artifact_file_operations','INSERT','prepared');return store.createFileOperation(...args);},
        updateFileOperation:async(input,queryable)=>{await before('backup_artifact_file_operations','UPDATE',input.status);return store.updateFileOperation(input,queryable);},
      },
      backupArtifactRepository:{...repository,
        createBackupArtifact:async(...args)=>{await before('backup_artifacts','INSERT','*');return repository.createBackupArtifact(...args);},
        deleteBackupArtifactById:async(...args)=>{await before('backup_artifacts','DELETE','*');return repository.deleteBackupArtifactById(...args);},
      },
    });
    const draft=createBackupArtifactFixture({storagePath:join(root,checkpoint,'backup.json'),filename:checkpoint+'.json'});
    if(plan.operation==='delete'){
      const artifact=await repository.getBackupArtifactByFilename({filename:draft.artifact.filename});assert.ok(artifact);await owner.deleteBackupArtifact({artifact});
    }else await owner.publishBackupArtifact(draft);
    throw new Error('Target SQL response unexpectedly reached the application');
  },async()=>{await app?.systemModule.runtimeResourceMonitor.stop();await closePool();});
}catch{process.exitCode=1;}
finally{expectedDisconnect=true;if(process.connected)process.disconnect();}
}

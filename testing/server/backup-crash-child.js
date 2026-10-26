/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { link, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '/app/server-dist/app.js';
import { closePool, getPool } from '/app/server-dist/database.js';
import { createBackupArtifactDirectoryCreationService } from '/app/server-dist/recovery/backup-artifact-directory-creation-service.js';
import { createBackupArtifactDirectorySyncService } from '/app/server-dist/recovery/backup-artifact-directory-sync-service.js';
import { createBackupArtifactFileOperationStore } from '/app/server-dist/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactFileService } from '/app/server-dist/recovery/backup-artifact-file-service.js';
import { createBackupArtifactOwnershipStore } from '/app/server-dist/recovery/backup-artifact-ownership-store.js';
import { createBackupArtifactRepository } from '/app/server-dist/recovery/backup-artifact-repository.js';
import { createOwnedBackupArtifactService } from '/app/server-dist/recovery/owned-backup-artifact-service.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createBackupArtifactFixture } from './backup-artifact-fixture.js';
import { getBackupCrashCase } from './backup-crash-plan.js';
import { requireDeploymentMemoryProfile } from './deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
assert.equal(process.platform,'linux');assert.equal(typeof process.send,'function');
const [mode,checkpoint,root]=process.argv.slice(2),plan=getBackupCrashCase(checkpoint);
assert.ok(['crash','recover'].includes(mode));assert.equal(root,process.env.HARMONIARR_BACKUPS);
const send=value=>new Promise((resolve,reject)=>{process.send({...value,processPid:process.pid,checkpoint},error=>error?reject(error):resolve());});
// Ref the owned IPC channel while a checkpoint deliberately stops workflow progress.
let expectedDisconnect=false;
process.on('disconnect',()=>{if(!expectedDisconnect)process.exitCode=1;});
let app,backendPid;
async function hit(name){
  if(checkpoint!==name)return;
  await send({event:'checkpoint',backendPid});
  await new Promise(()=>{});
}
try{
  await withWorkerTaskCleanup(async()=>{
    app=createApp({clientDistDir:'/app/client-dist',packageJsonPath:'/app/package.json'});
    if(mode==='recover'){
      const recovery=app.systemModule.backupArtifactFileOperationService;
      const first=await recovery.recoverIncompleteFileOperations(),second=await recovery.recoverIncompleteFileOperations();
      await send({event:'recovered',first,second});return;
    }
    const store=createBackupArtifactFileOperationStore(),repository=createBackupArtifactRepository();
    let directoryCheckpoints=0;
    const owner=createOwnedBackupArtifactService({
      ownershipStore:createBackupArtifactOwnershipStore({getPoolFn:()=>({connect:async()=>{
        const client=await getPool().connect();backendPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return client;
      }})}),
      backupArtifactFileOperationStore:{...store,
        createFileOperation:async(...args)=>{const value=await store.createFileOperation(...args);await hit(plan.operation==='delete'?'delete-intent':'intent-recorded');return value;},
        updateFileOperation:async(input,queryable)=>{
          const value=await store.updateFileOperation(input,queryable);
          await hit(input.status==='temporary_ready'?'temporary-ready':`${plan.operation==='delete'?'delete':'publish'}-${input.status}`);return value;
        },
      },
      backupArtifactRepository:{...repository,
        createBackupArtifact:async(...args)=>{const value=await repository.createBackupArtifact(...args);await hit('catalog-created');return value;},
        deleteBackupArtifactById:async(...args)=>{const value=await repository.deleteBackupArtifactById(...args);await hit('catalog-deleted');return value;},
      },
      createDirectoryCreationService:options=>{
        const service=createBackupArtifactDirectoryCreationService(options);
        return {prepareArtifactDirectories:async input=>{await service.prepareArtifactDirectories(input);await hit('directories-ready');}};
      },
      createDirectorySyncService:options=>{
        const service=createBackupArtifactDirectorySyncService(options);
        return {syncParentDirectory:async input=>{await service.syncParentDirectory(input);directoryCheckpoints++;
          await hit(plan.operation==='delete'?'deletion-directory-synced':directoryCheckpoints===1?'final-directory-synced':'temporary-directory-synced');}};
      },
      createFileService:options=>createBackupArtifactFileService({...options,
        openFn:async(...args)=>{
          const handle=await open(...args);
          return {writeFile:async content=>{
            if(checkpoint==='partial-write'){await handle.writeFile(content.slice(0,32));await hit('partial-write');}
            await handle.writeFile(content);await hit('bytes-written');
          },sync:()=>handle.sync(),close:async()=>{await handle.close();await hit('file-closed');}};
        },
        linkFn:async(...args)=>{await link(...args);await hit('link-created');},
        unlinkFn:async path=>{await unlink(path);await hit(plan.operation==='delete'?'file-unlinked':'temporary-unlinked');},
      }),
    });
    const draft=createBackupArtifactFixture({storagePath:join(root,checkpoint,'backup.json'),filename:checkpoint+'.json'});
    if(plan.operation==='delete'){
      const artifact=await repository.getBackupArtifactByFilename({filename:draft.artifact.filename});assert.ok(artifact);
      await owner.deleteBackupArtifact({artifact});
    }else await owner.publishBackupArtifact(draft);
    throw new Error('Crash checkpoint was not reached');
  },async()=>{
    await app?.systemModule.runtimeResourceMonitor.stop();await closePool();
  });
}catch{
  process.exitCode=1;
}finally{
  expectedDisconnect=true;if(process.connected)process.disconnect();
}

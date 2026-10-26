/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupArtifactFileOperationService } from '../../src/server/recovery/backup-artifact-file-operation-service.js';
import { createBackupArtifactFixture } from '../../testing/server/backup-artifact-fixture.js';

function fixture({ sync = async () => {}, final = false, temporary = false } = {}) {
  const draft = createBackupArtifactFixture({ storagePath: '/unused/final.json' });
  const operation = { id:'operation', status:'prepared', operationType:'publish', artifactSnapshot:draft.artifact,
    storagePath:draft.artifact.storagePath, temporaryPath:'/other/temporary.json', filename:draft.artifact.filename };
  const events = [], errors = []; let artifact = { ...draft.artifact,id:'artifact' };
  const verify = async ({ storagePath }) => ({ status:(storagePath === operation.storagePath ? final : temporary) ? 'verified' : 'missing' });
  const service = createBackupArtifactFileOperationService({
    backupArtifactFileVerificationService:{ verifyBackupArtifactFile:verify },
    backupArtifactFileReadinessService:{ prepareBackupArtifactFile:verify },
    backupArtifactFileService:{
      writePrivateTemporaryFile:async () => { temporary=true; },
      promoteTemporaryFile:async () => { events.push('link'); final=true; },
      removeLinkedTemporaryFile:async () => { events.push('cleanup'); temporary=false; },
      removeFileIfPresent:async () => { events.push('unlink'); final=false; return {removed:true}; },
    },
    backupArtifactDirectorySyncService:{ syncParentDirectory:async ({storagePath}) => { events.push(storagePath === operation.storagePath ? 'sync-final' : 'sync-temporary'); await sync(storagePath); } },
    backupArtifactDirectoryCreationService:{ prepareArtifactDirectories:async () => {} },
    createFileOperation:async input => { Object.assign(operation,input); return operation; },
    listIncompleteFileOperations:async () => [operation],
    updateFileOperation:async ({fileOperationId:_id,...patch}) => { if(patch.status)events.push(patch.status); Object.assign(operation,patch); },
    recordFileOperationFailure:async input => { errors.push(input); },
    createBackupArtifact:async input => { events.push('catalog'); artifact={...input,id:'artifact'}; return artifact; },
    deleteBackupArtifactById:async () => { events.push('catalog-delete'); const removed=artifact; artifact=null; return removed; },
  });
  return {service,draft,operation,events,errors,artifact:()=>artifact};
}

test('normal publication persists the final name before cleanup and cleanup before inventory', async () => {
  const f=fixture(); await f.service.publishBackupArtifact(f.draft);
  assert.deepEqual(f.events,['temporary_ready','link','sync-final','cleanup','sync-temporary','finalized','catalog','completed']);
});

test('recovering an already-final file repeats both directory checkpoints even with no temporary name', async () => {
  const f=fixture({final:true}); assert.equal((await f.service.recoverIncompleteFileOperations()).completedCount,1);
  assert.deepEqual(f.events,['sync-final','cleanup','sync-temporary','finalized','catalog','completed']);
});

test('either publication checkpoint failure preserves phase and refuses catalog completion', async () => {
  for(const failingCall of [1,2])for(const primary of [new Error('sync failed'),null]){
    let calls=0;const f=fixture({sync:async () => { if(++calls===failingCall)throw primary; }});
    await assert.rejects(f.service.publishBackupArtifact(f.draft),error=>error===primary);
    assert.equal(f.operation.status,'temporary_ready');assert.equal(f.errors.length,1);
    assert.ok(!f.events.includes('catalog'));assert.ok(!f.events.includes('finalized'));
    assert.equal(f.events.includes('cleanup'),failingCall===2);
  }
});

test('delete keeps inventory after unlink sync failure and retries sync when the file is already absent', async () => {
  const failure=Object.assign(new Error('unsupported'),{code:'EINVAL'});let failed=true;
  const f=fixture({final:true,sync:async () => { if(failed)throw failure; }});
  await assert.rejects(f.service.deleteBackupArtifact({artifact:f.artifact()}),error=>error===failure);
  assert.equal(f.operation.status,'prepared');assert.ok(f.artifact());assert.deepEqual(f.events,['unlink','sync-final']);
  failed=false;assert.equal((await f.service.recoverIncompleteFileOperations()).completedCount,1);
  assert.equal(f.artifact(),null);assert.deepEqual(f.events,['unlink','sync-final','sync-final','finalized','catalog-delete','completed']);
});

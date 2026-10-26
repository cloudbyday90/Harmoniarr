/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { open } from 'node:fs/promises';
import { closePool } from '/app/server-dist/database.js';
import { createBackupRecoveryModule } from '/app/server-dist/recovery/backup-recovery-module.js';
import { createBackupRecoveryRunStore } from '/app/server-dist/recovery/backup-recovery-run-store.js';
import { createOwnedBackupArtifactService } from '/app/server-dist/recovery/owned-backup-artifact-service.js';
import { createBackupArtifactOwnershipStore } from '/app/server-dist/recovery/backup-artifact-ownership-store.js';
import { createBackupArtifactFileOperationStore } from '/app/server-dist/recovery/backup-artifact-file-operation-store.js';
import { createBackupArtifactFileReadinessService } from '/app/server-dist/recovery/backup-artifact-file-readiness-service.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { createOperationQueueStore } from '/app/server-dist/operation-queue-store.js';
import { createOperationQueueDispatcher } from '/app/server-dist/operation-queue-dispatcher.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { validateBackupRecoveryInterruptionCase } from './backup-recovery-interruption-plan.js';

const [caseName, runId, mode] = process.argv.slice(2);
validateBackupRecoveryInterruptionCase(caseName);
assert.ok(['interrupt', 'resume'].includes(mode));
const gate = Promise.withResolvers();
let backendPid, openHandles = 0, checkpointSent = false, shutdown, dispatcher, completion, module;
const send = (event, extra = {}) => new Promise((resolve, reject) => {
  process.send({ event, caseName, runId, processPid: process.pid, openHandles, ...extra }, error => error ? reject(error) : resolve());
});
async function checkpoint() {
  if (mode === 'resume' || checkpointSent) return;
  checkpointSent = true; await send('checkpoint', { backendPid }); await gate.promise;
}
const store = createBackupArtifactFileOperationStore(), runStore = createBackupRecoveryRunStore();
const ownership = createBackupArtifactOwnershipStore();
const owner = createOwnedBackupArtifactService({
  ownershipStore: { withOwnership: (work, options) => ownership.withOwnership(async context => {
    backendPid = context.queryable.processID;
    await context.queryable.query("SELECT set_config('application_name',$1,false)", ['recovery-interruption:' + caseName]);
    return work(context);
  }, options) },
  createReadinessService: options => createBackupArtifactFileReadinessService({ ...options, openFn: async (...args) => {
    const handle = await open(...args), sync = handle.sync.bind(handle), close = handle.close.bind(handle);
    openHandles++;
    handle.sync = async () => { await sync(); if (caseName.endsWith('open-handle')) await checkpoint(); };
    handle.close = async () => { await close(); openHandles--; };
    return handle;
  } }),
  backupArtifactFileOperationStore: { ...store, updateFileOperation: async (input, queryable) => {
    const result = await store.updateFileOperation(input, queryable);
    if (caseName === 'crash-after-publication' && input.status === 'completed') await checkpoint();
    return result;
  } },
});
const basePause = runStore.markRunPaused;
runStore.markRunPaused = async input => {
  const result = await basePause(input);
  if (result && caseName === 'crash-after-continuation') await checkpoint();
  return result;
};
const locks = createMaintenanceLockService();
module = createBackupRecoveryModule({ backupArtifactFileOperationService: owner, runStore, listActiveMaintenanceLocks: locks.listActiveMaintenanceLocks });
dispatcher = createOperationQueueDispatcher({ operationQueueStore: createOperationQueueStore(), handlers: {
  backup_artifact_recovery: ({ run }) => {
    assert.equal(run.id, runId); const accepted = module.worker.startWorkerRun({ run }); completion = accepted.completion; return accepted;
  },
} });
let expectedDisconnect = false;
process.on('disconnect', () => { if (!expectedDisconnect) process.exit(2); });
process.on('message', value => {
  if (!value || Object.keys(value).length !== 1) return;
  if (value.event === 'release') gate.resolve();
  if (value.event === 'shutdown' && !shutdown) {
    shutdown = (async () => {
      const drain = dispatcher.stopAndDrain(); await send('draining'); await drain;
      await drainApplicationWorkerOwners({ systemModule: { backupRecoveryWorker: module.worker } });
    })();
  }
});
try {
  await withWorkerTaskCleanup(async () => {
    const deadline = Date.now() + 40_000;
    for (;;) {
      completion = null; await dispatcher.tick(); if (completion) await completion;
      const run = await runStore.getRunById(runId);
      if (mode !== 'resume' || ['completed', 'failed', 'cancelled'].includes(run.status)) break;
      assert.ok(Date.now() < deadline, 'Recovery continuation must finish');
      await new Promise(resolve => { setTimeout(resolve, 100); });
    }
    await shutdown;
    await dispatcher.stopAndDrain(); await module.worker.close();
    assert.equal(openHandles, 0); await send('finished', { drained: true });
  }, async () => {
    gate.resolve(); await dispatcher.stopAndDrain(); await module.worker.close(); await closePool();
  });
} catch (error) { process.stderr.write(String(error?.stack ?? error)); process.exitCode = 1; }
finally { expectedDisconnect = true; if (process.connected) process.disconnect(); }

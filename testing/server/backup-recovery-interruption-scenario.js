/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createBackupRecoveryModule } from '/app/server-dist/recovery/backup-recovery-module.js';
import { createBackupRecoveryRunStore } from '/app/server-dist/recovery/backup-recovery-run-store.js';
import { createOperationRunControlService } from '/app/server-dist/operation-run-control-service.js';
import { createOperationStrandedRunRecoveryService } from '/app/server-dist/operation-stranded-run-recovery-service.js';
import { createOperationRetryPolicyService } from '/app/server-dist/operation-retry-policy-service.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { createJobLeaseStore } from '/app/server-dist/job-lease-store.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { seedBackupStartupRecovery } from './backup-startup-recovery-fixture.js';
import { startBackupRecoveryInterruptionProcess } from './backup-recovery-interruption-process.js';

const operationTypes = ['backup_artifact_recovery'];
export async function runBackupRecoveryInterruptionScenario({ pool, caseName, signal }) {
  const anchor = await mkdtemp('/app/data/recovery-interruption-'), root = join(anchor, 'backups');
  const runStore = createBackupRecoveryRunStore(), locks = createMaintenanceLockService();
  const module = createBackupRecoveryModule({ runStore, backupArtifactFileOperationService: {} });
  const recovery = createOperationStrandedRunRecoveryService({ retryPolicyService: createOperationRetryPolicyService({ initialBackoffMs: 1, jitterRatio: 0 }) });
  const replacementStore = createJobLeaseStore({ ownerInstanceId: 'qualification-replacement', leaseDurationMs: 30_000 });
  const children = new Set(), runIds = []; let seeded = [], lock, checkpoint, replacement;
  async function until(probe, label, timeoutMs = 40_000) {
    const deadline = Date.now() + timeoutMs;
    while (!await probe()) { signal?.throwIfAborted(); assert.ok(Date.now() < deadline, label); await new Promise(resolve => { setTimeout(resolve, 25); }); }
  }
  function start(runId, mode = 'interrupt') {
    const child = startBackupRecoveryInterruptionProcess({ caseName, runId, root, mode }); children.add(child); return child;
  }
  async function retire(child) { await child.dispose(); assert.equal(child.isClosed(), true); children.delete(child); }
  async function resume(runId) {
    const child = start(runId, 'resume');
    return withWorkerTaskCleanup(async () => { await child.complete(); }, () => retire(child));
  }
  async function waitForExpiry(runId) {
    await until(async () => (await runStore.getLease({ runId })).state === 'expired', 'The real 30-second recovery lease must expire');
  }
  return withWorkerTaskCleanup(async () => {
    await mkdir(root, { mode: 0o700 }); seeded = await seedBackupStartupRecovery(pool, root);
    const { runId } = await runStore.queueStartupRecovery(); runIds.push(runId);
    const child = start(runId); checkpoint = await child.waitFor('checkpoint');
    const lease = await runStore.getLease({ runId }); assert.equal(lease.state, 'active');
    assert.equal(checkpoint.openHandles, caseName.endsWith('open-handle') ? 1 : 0);
    const journalBefore = await runStore.getJournalCounts();
    const before = await runStore.getRunById(runId);
    if (caseName === 'crash-after-publication') assert.equal(journalBefore.unfinishedCount, 33);
    if (caseName === 'crash-after-continuation') {
      assert.equal(before.status, 'pending'); assert.ok(before.summary.processedCount > 0 && before.summary.processedCount <= 25);
      assert.ok(before.summary.backupRecoveryAfter);
    } else assert.equal(before.status, 'running');

    if (caseName.startsWith('crash-')) {
      await child.crash(); await retire(child);
      await until(async () => !(await pool.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active', [checkpoint.backendPid])).rows[0].active, 'Original recovery backend must retire', 5000);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE pid=$1 AND locktype='advisory'", [checkpoint.backendPid])).rows[0].count, 0);
      assert.deepEqual(await runStore.getJournalCounts(), journalBefore);
      await assert.rejects(runStore.acquireLease({ runId }), { code: 'operation_run_lease_unavailable' });
      if (before.status === 'running') assert.equal((await recovery.recoverStrandedRuns({ operationTypes })).activeLeaseCount, 1);
      await waitForExpiry(runId);
      if (before.status === 'running') assert.equal((await recovery.recoverStrandedRuns({ operationTypes })).retriedCount, 1);
      await resume(runId);
    } else {
      if (caseName === 'cancel-open-handle') await createOperationRunControlService().requestOperationRunCancellation({ runId, requestedByUserId: null });
      if (caseName === 'maintenance-open-handle') lock = await locks.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Recovery interruption qualification' });
      if (caseName === 'lease-loss-open-handle') {
        // This is controlled expiry of this exact fixture acquisition, not the crash-expiry proof above.
        const expired = await pool.query('UPDATE job_leases SET expires_at=clock_timestamp()-interval \'1 second\' WHERE lease_key=$1 AND acquisition_id=$2 RETURNING id', [lease.leaseKey, lease.acquisitionId]);
        assert.equal(expired.rowCount, 1);
        replacement = await replacementStore.acquireLease({ jobType: 'backup_artifact_recovery', leaseKey: lease.leaseKey });
        assert.notEqual(replacement.acquisitionId, lease.acquisitionId);
      }
      if (caseName === 'shutdown-open-handle') {
        await child.command('shutdown'); const draining = await child.waitFor('draining'); assert.equal(draining.openHandles, 1);
      }
      assert.equal(child.isClosed(), false); assert.deepEqual(await runStore.getJournalCounts(), journalBefore);
      const currentLease = await runStore.getLease({ runId });
      assert.equal(currentLease.releasedAt, null); // Cancellation/shutdown cannot release an admitted handle early.
      await child.command('release'); await child.complete(); await retire(child);
      const after = await runStore.getRunById(runId);
      if (caseName === 'cancel-open-handle') {
        assert.equal(after.status, 'cancelled'); assert.equal((await module.getStatus()).progressMayBeIncomplete, true);
        assert.equal((await runStore.getJournalCounts()).unfinishedCount, 34);
        const next = await runStore.queueStartupRecovery(); runIds.push(next.runId); await resume(next.runId);
      } else if (caseName === 'lease-loss-open-handle') {
        assert.equal(after.status, 'running');
        assert.equal((await replacementStore.getLease({ leaseKey: lease.leaseKey })).acquisitionId, replacement.acquisitionId);
        assert.equal((await replacementStore.getLease({ leaseKey: lease.leaseKey })).releasedAt, null);
        await replacementStore.releaseLease({ leaseKey: lease.leaseKey, expectedLease: replacement, status: 'completed' }); replacement = null;
        assert.equal((await recovery.recoverStrandedRuns({ operationTypes })).retriedCount, 1); await resume(runId);
      } else {
        assert.equal(after.status, 'pending');
        if (lock) { await locks.releaseMaintenanceLock({ lockId: lock.id }); lock = null; }
        await resume(runId);
      }
    }

    const final = await module.getStatus(); assert.equal(final.state, 'completed');
    assert.equal(final.unfinishedCount, 4); assert.equal(final.confirmationCount, 1);
    const latest = await runStore.getLatestRun();
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=$1", ['recovery-interruption:' + caseName])).rows[0].count, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM job_leases WHERE lease_key=ANY($1::text[]) AND released_at IS NULL', [runIds.map(id => 'backup_artifact_recovery:' + id)])).rows[0].count, 0);
    if (['crash-open-handle', 'crash-after-publication', 'lease-loss-open-handle', 'maintenance-open-handle'].includes(caseName)) assert.equal(final.progressMayBeIncomplete, true);
    if (caseName === 'crash-after-publication') assert.equal(latest.summary.completedCount, 28);
    if (caseName === 'crash-after-continuation') assert.equal(latest.summary.completedCount, 29);
    for (const row of seeded) {
      const status = (await pool.query('SELECT status FROM backup_artifact_file_operations WHERE id=$1', [row.id])).rows[0].status;
      assert.equal(status, row.type === 'complete' ? 'completed' : row.type === 'partial' ? 'awaiting_confirmation' : row.type === 'unwritten' ? 'abandoned' : 'prepared');
      if (row.type === 'complete') assert.equal(await readFile(row.draft.artifact.storagePath, 'utf8'), row.draft.content);
      if (row.type === 'missing-tree') await assert.rejects(lstat(dirname(row.draft.artifact.storagePath)), { code: 'ENOENT' });
    }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM backup_artifacts WHERE storage_path=ANY($1::text[])', [seeded.map(row => row.draft.artifact.storagePath)])).rows[0].count, 29);
    return { caseName, realProcessClose: true, currentUnfinished: final.unfinishedCount, confirmation: final.confirmationCount,
      replayCaveat: final.progressMayBeIncomplete, completedObservations: latest.summary.completedCount,
      realLeaseExpiry: caseName.startsWith('crash-'), fileAndCatalogVerified: true, privateFixtureRetired: true };
  }, async () => {
    const diagnostics = [...children].map(child => child.diagnostics()).filter(Boolean);
    const retirements = await Promise.allSettled([...children].map(retire));
    assert.ok(retirements.every(row => row.status === 'fulfilled'), 'Every owned recovery child must retire before fixture cleanup');
    if (lock) await locks.releaseMaintenanceLock({ lockId: lock.id });
    if (replacement) await replacementStore.releaseLease({ leaseKey: replacement.leaseKey, expectedLease: replacement, status: 'failed' });
    await module.worker.close();
    if (seeded.length) {
      await pool.query('DELETE FROM backup_artifact_file_operations WHERE id=ANY($1::uuid[])', [seeded.map(row => row.id)]);
      await pool.query('DELETE FROM backup_artifacts WHERE storage_path=ANY($1::text[])', [seeded.map(row => row.draft.artifact.storagePath)]);
    }
    if (runIds.length) {
      await pool.query('DELETE FROM job_leases WHERE lease_key=ANY($1::text[])', [runIds.map(id => 'backup_artifact_recovery:' + id)]);
      await pool.query('DELETE FROM operation_runs WHERE id=ANY($1::uuid[])', [runIds]);
    }
    await rm(anchor, { recursive: true, force: true });
    await assert.rejects(lstat(anchor), { code: 'ENOENT' });
    if (diagnostics.length) throw new Error('Recovery child diagnostics: ' + diagnostics.join('\n'));
  });
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createApp } from '/app/server-dist/app.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { seedBackupStartupRecovery } from '../../testing/server/backup-startup-recovery-fixture.js';

await requireDeploymentMemoryProfile();
test('production startup queues bounded backup recovery, preserves held records and delivers administrator status', { timeout: 60_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.APP_PORT = '3000';
  const anchor = await mkdtemp('/app/data/startup-recovery-'), root = join(anchor, 'backups'); await mkdir(root, { mode: 0o700 }); process.env.HARMONIARR_BACKUPS = root;
  const pool = getPool(), seeded = await seedBackupStartupRecovery(pool, root), application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const module = application.systemModule.backupRecoveryStatusService, locks = application.maintenanceLockService;
  const lock = await locks.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Qualification pause' });
  let runtime;
  const client = createSessionHttpClient('http://127.0.0.1:3000');
  async function until(probe, label) {
    const deadline = Date.now() + 20_000; while (!await probe()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, label); await new Promise(resolve => { setTimeout(resolve, 25); }); }
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => application, startBackgroundServices: true, processEmitter: new EventEmitter(), stdout: { write() { } }, stderr: { write() { } } });
    await until(async () => module.startupService.getState() === 'queued', 'startup must queue recovery independently of readiness');
    assert.equal((await fetch('http://127.0.0.1:3000/healthz')).status, 200);
    let run = await module.runStore.getLatestRun(); assert.equal(run.status, 'pending');
    const admissions = await Promise.all([module.runStore.queueStartupRecovery(), module.runStore.queueStartupRecovery()]);
    assert.ok(admissions.every(row => row.runId === run.id && row.coalesced));
    assert.equal((await client.requestJson('/api/v1/recovery/backups')).response.status, 401);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'startup-admin', password: 'StartupFixture123!' } })).response.status, 201);
    const pending = await client.requestJson('/api/v1/recovery/backups'); assert.equal(pending.response.status, 200); assert.equal(pending.response.headers.get('cache-control'), 'no-store');
    assert.equal(pending.payload.backupRecovery.state, 'pending'); assert.equal(pending.payload.backupRecovery.unfinishedCount, 34);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM backup_artifacts')).rows[0].count, 0);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='startup-admin'");
    assert.equal((await client.requestJson('/api/v1/recovery/backups')).response.status, 403);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='startup-admin'");
    await locks.releaseMaintenanceLock({ lockId: lock.id });
    await until(async () => { run = await module.runStore.getLatestRun(); return run.status === 'completed'; }, 'bounded startup recovery must finish its finite scan');
    assert.equal(run.summary.processedCount, 34); assert.equal(run.summary.completedCount, 29); assert.equal(run.summary.deferredCount, 3);
    assert.equal(run.summary.awaitingConfirmationCount, 1); assert.equal(run.summary.abandonedCount, 1); assert.equal(run.attemptCount, 1);
    const after = await client.requestJson('/api/v1/recovery/backups');
    assert.equal(after.payload.backupRecovery.state, 'completed'); assert.equal(after.payload.backupRecovery.unfinishedCount, 4);
    assert.equal(after.payload.backupRecovery.confirmationCount, 1);
    assert.doesNotMatch(JSON.stringify(after.payload.backupRecovery), /storagePath|temporaryPath|backupRecoveryThrough|backupRecoveryAfter|expectedFileSha256/u);
    assert.equal(after.payload.backupArtifacts.length, 25);
    for (const row of seeded) {
      const operation = (await pool.query('SELECT status FROM backup_artifact_file_operations WHERE id=$1', [row.id])).rows[0];
      assert.equal(operation.status, row.type === 'complete' ? 'completed' : row.type === 'partial' ? 'awaiting_confirmation' : row.type === 'unwritten' ? 'abandoned' : 'prepared');
      if (row.type === 'complete') assert.equal(await readFile(row.draft.artifact.storagePath, 'utf8'), row.draft.content);
      if (row.type === 'missing-tree') await assert.rejects(lstat(dirname(row.draft.artifact.storagePath)), { code: 'ENOENT' });
      if (row.type === 'partial') assert.equal(await readFile(row.temporaryPath, 'utf8'), row.draft.content.slice(0, 32));
    }
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM job_leases WHERE job_type='backup_artifact_recovery' AND released_at IS NULL")).rows[0].count, 0);
    t.diagnostic(JSON.stringify({
seeded: 34, completed: 29, deferred: 3, confirmation: 1, abandoned: 1, exactMicrosecondPaging: true, continuationsDoNotConsumeRetries: true,
      httpReadyWhileMaintenancePaused: true, startupCoalesced: true, administratorOnly: true, noStore: true, safeStatus: true, realFilesAndJournalVerified: true
}));
  }, async () => {
    if (runtime) await runtime.startupServiceSupervisor.shutdown({
onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await module.worker.close(); await application.systemModule.runtimeResourceMonitor.stop(); await closePool();
      }
  });
    else await closePool();
    await rm(anchor, { recursive: true, force: true });
  });
  });

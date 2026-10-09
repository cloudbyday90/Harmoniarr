/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { lockJobLeaseKey } from '../../src/server/job-lease-lock-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createArtworkCleanupWorker } from '../../src/server/artwork/artwork-cleanup-worker.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let unavailable;
const gate = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; };
async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const a = createJobLeaseStore({ getPoolFn, ownerInstanceId: 'same-owner', leaseDurationMs: 60_000 });
    const b = createJobLeaseStore({ getPoolFn, ownerInstanceId: 'replacement-owner', leaseDurationMs: 60_000 });
    const runs = createOperationRunStore({ getPoolFn, operationType: 'artwork_cleanup',
      createJobLeaseStoreFn: () => a });
    const run = await runs.createOperationRun({ status: 'pending', summary: { currentStep: 'Controlled lease fixture' } });
    await callback({ getPoolFn, pool: getPoolFn(), a, b, runs, run, key: `artwork_cleanup:${run.id}`,
      queue: createOperationQueueStore({ getPoolFn }) });
  });
}
const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [c.key]);
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
async function waitForBlock(c) {
  for (let index = 0; index < 100; index += 1) {
    if ((await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND cardinality(pg_blocking_pids(pid))>0 AND query NOT LIKE '%pg_stat_activity%'`)).rowCount > 0) return;
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
  assert.fail('Expected a real PostgreSQL lock wait');
}

suite('Acquisition-token lease and lifecycle fences in real PostgreSQL', () => {
  before(async () => { try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('the actual additive migration backfills unique acquisition tokens without changing rows or historical frames', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await c.pool.query('ALTER TABLE job_leases DROP COLUMN acquisition_id');
    const old = (await c.pool.query(`INSERT INTO job_leases(job_type,lease_key,owner_instance_id,acquired_at,heartbeat_at,expires_at,status)
      VALUES('artwork_cleanup','historical:first','legacy-owner',NOW(),NOW(),NOW()+INTERVAL '1 day','active'),
        ('artwork_cleanup','historical:second','legacy-owner',NOW(),NOW(),NOW()+INTERVAL '1 day','active') RETURNING *`)).rows;
    const frame = { leaseKey: old[0].lease_key, ownerInstanceId: old[0].owner_instance_id, acquiredAt: old[0].acquired_at.toISOString() };
    await c.pool.query("UPDATE operation_runs SET summary=jsonb_build_object('historicalLease',$2::jsonb) WHERE id=$1", [c.run.id, JSON.stringify(frame)]);
    await c.pool.query(await readFile(new URL('../../src/server/migrations/20261009_205425_job_lease_acquisition_fencing.sql', import.meta.url), 'utf8'));
    const current = (await c.pool.query('SELECT * FROM job_leases ORDER BY lease_key')).rows;
    assert.deepEqual(current.map((row) => row.id), old.map((row) => row.id));
    assert.equal(new Set(current.map((row) => row.acquisition_id)).size, 2);
    assert.ok(current.every((row) => /^[0-9a-f-]{36}$/u.test(row.acquisition_id)));
    assert.deepEqual((await parent(c)).summary.historicalLease, frame);
    assert.equal(await c.a.renewLease({ leaseKey: frame.leaseKey, expectedLease: frame }), null);
  }));

  test('same-owner acquisitions keep row identity but rotate authority; old and missing callbacks cannot mutate replacement', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await c.runs.acquireLease({ runId: c.run.id });
    assert.equal(await c.a.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key }), null);
    await expire(c);
    const second = await c.a.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key });
    assert.equal(first.id, second.id); assert.notEqual(first.acquisitionId, second.acquisitionId);
    assert.equal(first.ownerInstanceId, second.ownerInstanceId);
    const initial = await parent(c);
    for (const expectedLease of [undefined, {}, first]) {
      assert.equal(await c.runs.renewLease({ runId: c.run.id, expectedLease }), null);
      assert.equal(await c.runs.releaseLease({ runId: c.run.id, expectedLease, status: 'failed' }), null);
      for (const mark of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunCancelled', 'markRunPaused']) {
        assert.equal(await c.runs[mark]({ runId: c.run.id, expectedLease, errorMessage: 'Stale worker', summary: { currentStep: 'Stale result' } }), false);
      }
      assert.deepEqual(await parent(c), initial);
    }
    assert.equal(await c.runs.markRunStarted({ runId: c.run.id, expectedLease: second }), true);
    assert.equal(await c.runs.markRunCompleted({ runId: c.run.id, expectedLease: second, summary: { currentStep: 'Replacement complete' } }), true);
    assert.equal((await parent(c)).status, 'completed');
    assert.equal((await c.runs.releaseLease({ runId: c.run.id, expectedLease: second, status: 'completed' })).state, 'released');
  }));

  test('a heartbeat already waiting when stopped keeps its original token and cannot renew the replacement', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await c.runs.acquireLease({ runId: c.run.id }); const entered = gate(); const finish = gate();
    const heartbeat = createOperationRunLeaseHeartbeat({ runId: c.run.id, expectedLease: first,
      renewLease: async (input) => { entered.release(); await finish.promise; return c.runs.renewLease(input); } });
    const tick = heartbeat.tick(); await entered.promise; heartbeat.stop();
    await expire(c); const second = await c.b.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key });
    finish.release(); assert.deepEqual(await tick, { reason: 'lease_lost', skipped: true });
    assert.equal((await c.runs.getLease({ runId: c.run.id })).acquisitionId, second.acquisitionId);
    assert.equal((await c.runs.renewLease({ runId: c.run.id, expectedLease: second })).acquisitionId, second.acquisitionId);
  }));

  test('an actual old worker finishing after takeover cannot complete, fail or release the replacement run', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const finish = gate(); const released = gate();
    const worker = createArtworkCleanupWorker({ ...c.runs,
      artworkCleanupService: { cleanupUnassignedArtwork: async () => { entered.release(); await finish.promise; return { deletedCount: 1 }; } },
      releaseLease: async (input) => { await c.runs.releaseLease(input); released.release(); } });
    worker.startWorkerRun({ runId: c.run.id, requestedAssetCount: 1, retentionCutoff: new Date().toISOString() });
    await entered.promise; await expire(c);
    const second = await c.b.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key });
    finish.release(); await released.promise;
    assert.equal((await parent(c)).status, 'running');
    assert.equal((await c.runs.getLease({ runId: c.run.id })).acquisitionId, second.acquisitionId);
    assert.equal((await c.runs.getLease({ runId: c.run.id })).releasedAt, null);
    assert.equal(await c.runs.markRunCompleted({ runId: c.run.id, expectedLease: second }), true);
  }));

  test('expiry while waiting for the lease key refuses renewal and lifecycle writes but permits exact own release', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await c.runs.acquireLease({ runId: c.run.id });
    const expires = (await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '500 milliseconds' WHERE lease_key=$1 RETURNING expires_at", [c.key])).rows[0].expires_at;
    const holder = await c.pool.connect(); await holder.query('BEGIN'); await lockJobLeaseKey({ leaseKey: c.key, queryable: holder });
    const mark = c.runs.markRunStarted({ runId: c.run.id, expectedLease: first }); await waitForBlock(c);
    await new Promise((resolve) => { setTimeout(resolve, Math.max(0, expires.getTime() - Date.now()) + 50); });
    await holder.query('COMMIT'); holder.release();
    assert.equal(await mark, false); assert.equal((await parent(c)).status, 'pending');
    assert.equal(await c.runs.renewLease({ runId: c.run.id, expectedLease: first }), null);
    assert.equal((await c.runs.releaseLease({ runId: c.run.id, expectedLease: first, status: 'expired' })).state, 'released');
  }));

  test('stranded recovery cannot release or rewrite a newer acquisition after observing the older expired token', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await c.runs.acquireLease({ runId: c.run.id }); await c.runs.markRunStarted({ runId: c.run.id, expectedLease: first });
    await expire(c); const entered = gate(); const finish = gate();
    const service = createOperationStrandedRunRecoveryService({ operationQueueStore: c.queue,
      jobLeaseStore: { listLeases: async (input) => { const rows = await c.a.listLeases(input); entered.release(); await finish.promise; return rows; } } });
    const recovery = service.recoverStrandedRuns({ operationTypes: ['artwork_cleanup'] }); await entered.promise;
    const second = await c.b.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key });
    finish.release(); const result = await recovery;
    assert.equal(result.failedCount + result.retriedCount + result.cancelledCount, 0);
    assert.equal((await parent(c)).status, 'running');
    assert.equal((await c.runs.getLease({ runId: c.run.id })).acquisitionId, second.acquisitionId);
    assert.equal((await c.runs.getLease({ runId: c.run.id })).releasedAt, null);
  }));

  test('the key advisory fence covers missing-row recovery against a raw generic acquisition', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await c.pool.query("UPDATE operation_runs SET status='running',attempt_count=1 WHERE id=$1", [c.run.id]);
    const observed = (await c.queue.listRecoverableRuns({ operationTypes: ['artwork_cleanup'] }))[0];
    const holder = await c.pool.connect(); await holder.query('BEGIN'); await lockJobLeaseKey({ leaseKey: c.key, queryable: holder });
    const acquired = c.b.acquireLease({ jobType: 'artwork_cleanup', leaseKey: c.key }); await waitForBlock(c);
    const recovered = c.queue.recoverStrandedRun({ observedRun: observed, expectedLease: null,
      recoverySummary: {}, errorMessage: 'Observed missing lease', buildRetrySchedule: () => null });
    await holder.query('COMMIT'); holder.release();
    assert.ok(await acquired); assert.equal(await recovered, null); assert.equal((await parent(c)).status, 'running');
  }));

  test('leased failure retry uses the locked budget and the explicit backup command never authorizes a leased foreign row', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const lease = await c.runs.acquireLease({ runId: c.run.id });
    await c.pool.query('UPDATE operation_runs SET attempt_count=1,max_attempts=2 WHERE id=$1', [c.run.id]);
    assert.equal(await c.runs.markRunFailed({ runId: c.run.id, expectedLease: lease, errorMessage: 'Current failure' }), true);
    assert.equal((await parent(c)).status, 'pending'); assert.equal((await parent(c)).summary.lastFailureMessage, 'Current failure');
    const backup = createOperationRunStore({ getPoolFn: c.getPoolFn, operationType: 'backup_restore_apply' });
    await backup.markRunCompleted({ runId: c.run.id }); assert.equal((await parent(c)).status, 'pending');
    const own = await backup.createOperationRun({ status: 'pending' }); await backup.markRunStarted({ runId: own.id });
    await backup.markRunCompleted({ runId: own.id }); assert.equal((await backup.getRunById(own.id)).status, 'completed');
  }));
});

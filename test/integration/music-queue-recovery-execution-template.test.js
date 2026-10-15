/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, suite, test } from 'node:test';
import { assertNoPendingMigrations } from '../../src/server/migrations.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createOwnedPostgresServer } from '../../testing/integration/owned-postgres-server.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { withMusicQueueRecoveryScenario } from '../../testing/integration/music-queue-recovery-scenario.js';
import { runMusicQueueRecoveryExecutionWorker } from '../../testing/integration/music-queue-recovery-execution-fixtures.js';
import { seedMusicQueueRecoveryFixture, seedMusicQueueRecoveryReplacement, recoverMusicQueueFixture }
  from '../../testing/integration/music-queue-recovery-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); const active = new Set(); let server;
function tracked(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });
async function databaseIdentity(pool) {
  return (await pool.query('SELECT datname AS name,oid::text AS oid FROM pg_database WHERE datname=current_database()')).rows[0];
}
async function child(context) {
  const fixture = await seedMusicQueueRecoveryFixture(context, { shared: true, fallback: true });
  const replacement = await seedMusicQueueRecoveryReplacement(context, fixture);
  const result = await recoverMusicQueueFixture(context, fixture);
  assert.equal(result.nextCandidateId, replacement.id);
  await context.pool.query("UPDATE operation_runs SET status='completed' WHERE id=$1", [fixture.originRunId]);
  return { runId: result.recoveryRunId, candidateId: replacement.id };
}

suite('Recovery execution templates retain the actual worker lifetime and fresh state', () => {
  before(() => tracked((async () => { server = await createOwnedPostgresServer({ config, env: {} }); })()),
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await server?.close(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const primary of [new Error('controlled execution cancellation'), null]) {
    test(`held provider and released lease precede actual drain; ${primary === null ? 'null' : 'Error'} cancellation retains the database until completion`, {
      timeout: config.scenarioTimeoutMs,
    }, t => tracked((async () => {
      let runtime; let first; let context; let seeded; let settled = false;
      const records = []; const controller = new AbortController();
      const providerReady = Promise.withResolvers(); const providerHold = Promise.withResolvers();
      const releaseReady = Promise.withResolvers(); const releaseHold = Promise.withResolvers();
      await withWorkerTaskCleanup(async () => {
        runtime = await createPostgresIntegrationRuntime({ config, env: server.env, schemaMode: 'migration_template',
          phaseObserver: createFixturePhaseObserver({ onRecord: record => records.push(record) }) });
        const offset = records.length;
        const pending = withMusicQueueRecoveryScenario(runtime, { signal: controller.signal }, async current => {
          context = current; first = await databaseIdentity(current.pool); seeded = await child(current);
          assert.equal(current.fixtureSignal, controller.signal);
          await runMusicQueueRecoveryExecutionWorker(current, seeded.runId, seeded.candidateId, {
            enqueueDownloads: async ({ files, username }) => {
              providerReady.resolve(); await providerHold.promise;
              return { enqueued: files.map(file => ({ ...file, username, id: randomUUID() })), failed: [] };
            },
            releaseLease: async input => {
              const result = await current.executionRuns.releaseLease(input);
              releaseReady.resolve(); await releaseHold.promise; return result;
            },
          });
        });
        const observed = pending.then(() => { settled = true; }, () => { settled = true; });
        try {
          await waitForFixtureReady({ ready: providerReady.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.deepEqual(await databaseIdentity(context.pool), first);
          assert.equal((await context.store.getOrigin(seeded.runId, seeded.candidateId)).status, 'running');
          providerHold.resolve();
          await waitForFixtureReady({ ready: releaseReady.promise, operation: pending, signal: t.signal });
          assert.equal((await context.store.getOrigin(seeded.runId, seeded.candidateId)).status, 'completed');
          assert.equal((await context.executionRuns.getLease({ runId: seeded.runId })).state, 'released');
          assert.ok((await context.pool.query('SELECT count(*)::int AS count FROM import_execution_transfer_links')).rows[0].count > 0);
          controller.abort(primary); await Promise.resolve();
          assert.equal(settled, false); assert.deepEqual(await databaseIdentity(context.pool), first);
          assert.equal(records.slice(offset).some(record => ['scenario_work', 'pool_close', 'database_drop'].includes(record.phase)), false);
          releaseHold.resolve(); await assert.rejects(pending, error => error === primary);
        } finally { providerHold.resolve(); releaseHold.resolve(); await observed; }
        assert.equal(records.filter(record => record.phase === 'scenario_work' && record.outcome === 'failed').length, 1);
        assert.equal(records.filter(record => record.phase === 'database_drop' && record.outcome === 'passed').length, 1);
        await withMusicQueueRecoveryScenario(runtime, t, async current => {
          const second = await databaseIdentity(current.pool);
          assert.notEqual(second.name, first.name); assert.notEqual(second.oid, first.oid);
          assert.equal((await current.pool.query('SELECT oid FROM pg_database WHERE datname=$1', [first.name])).rowCount, 0);
          assert.equal(current.pool.options.max, config.poolMax);
          assert.equal(current.pool.options.connectionTimeoutMillis, config.poolConnectionTimeoutMs);
          for (const table of ['app_users', 'import_candidates', 'operation_runs', 'import_candidate_events', 'audit_events',
            'library_discovery_requests', 'library_wanted_releases', 'import_execution_transfer_links', 'job_leases']) {
            assert.equal((await current.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0, table);
          }
          assert.deepEqual((await assertNoPendingMigrations({ getPoolFn: current.getPoolFn })).pending, []);
          const fresh = await child(current);
          assert.equal((await runMusicQueueRecoveryExecutionWorker(current, fresh.runId, fresh.candidateId)).enqueue, 1);
          assert.equal((await current.store.getCandidate(fresh.candidateId)).status, 'downloading');
          assert.equal((await current.store.getOrigin(fresh.runId, fresh.candidateId)).status, 'completed');
        });
        assert.equal(records.filter(record => record.phase === 'template_prepare' && record.outcome === 'passed').length, 1);
      }, async () => { await runtime?.cleanup(); });
    })()));
  }
});

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
import { createMusicQueueRecoveryDiscoveryFixtureContext, runMusicQueueRecoveryDiscoveryWorker }
  from '../../testing/integration/music-queue-recovery-discovery-fixtures.js';
import { seedMusicQueueRecoveryFixture, recoverMusicQueueFixture } from '../../testing/integration/music-queue-recovery-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); const active = new Set(); let server;
const dependencies = { createContext: createMusicQueueRecoveryDiscoveryFixtureContext };
function tracked(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });
async function databaseIdentity(pool) {
  return (await pool.query('SELECT datname AS name,oid::text AS oid FROM pg_database WHERE datname=current_database()')).rows[0];
}
async function queued(context) {
  const fixture = await seedMusicQueueRecoveryFixture(context, { shared: true, fallback: true });
  const result = await recoverMusicQueueFixture(context, fixture);
  assert.equal(result.reason, 'rediscovery_scheduled');
  return { ...fixture, runId: result.rediscovery.discoveryRunId };
}

suite('Recovery discovery templates retain dispatch, ingestion, release and pruning lifetimes', () => {
  before(() => tracked((async () => { server = await createOwnedPostgresServer({ config, env: {} }); })()),
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await server?.close(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const primary of [new Error('controlled discovery cancellation'), null]) {
    test(`held discovery boundaries preserve ${primary === null ? 'null' : 'Error'} and a live database until post-release pruning drains`, {
      timeout: config.scenarioTimeoutMs,
    }, t => tracked((async () => {
      let runtime; let first; let context; let fixture; let settled = false; let searches = 0; let ingestions = 0;
      const records = []; const controller = new AbortController();
      const gates = Object.fromEntries(['prepare', 'provider', 'ingest', 'release', 'prune'].map(stage =>
        [stage, { ready: Promise.withResolvers(), hold: Promise.withResolvers() }]));
      const hold = async stage => { gates[stage].ready.resolve(); await gates[stage].hold.promise; };
      await withWorkerTaskCleanup(async () => {
        runtime = await createPostgresIntegrationRuntime({ config, env: server.env, schemaMode: 'migration_template',
          phaseObserver: createFixturePhaseObserver({ onRecord: record => records.push(record) }) });
        const offset = records.length;
        const pending = withMusicQueueRecoveryScenario(runtime, { signal: controller.signal }, async current => {
          context = current; first = await databaseIdentity(current.pool); fixture = await queued(current);
          assert.equal(current.fixtureSignal, controller.signal);
          await runMusicQueueRecoveryDiscoveryWorker(current, fixture, {
            prepare: () => hold('prepare'),
            provider: async () => { searches++; await hold('provider'); return { id: randomUUID() }; },
            ingest: async () => { ingestions++; await hold('ingest'); return { candidateCount: 0, fileCount: 0 }; },
            releaseLease: async input => {
              const result = await current.discoveryRuns.releaseLease(input); await hold('release'); return result;
            },
            pruneOldRuns: () => hold('prune'),
          });
        }, dependencies);
        const observed = pending.then(() => { settled = true; }, () => { settled = true; });
        try {
          for (const stage of ['prepare', 'provider', 'ingest', 'release', 'prune']) {
            await waitForFixtureReady({ ready: gates[stage].ready.promise, operation: pending, signal: t.signal });
            assert.equal(settled, false); assert.deepEqual(await databaseIdentity(context.pool), first);
            assert.equal(searches, stage === 'prepare' ? 0 : 1);
            assert.equal(ingestions, ['prepare', 'provider'].includes(stage) ? 0 : 1);
            const finalizing = ['release', 'prune'].includes(stage);
            assert.equal((await context.store.getOrigin(fixture.runId, null)).status, finalizing ? 'completed' : 'running');
            if (finalizing) {
              const leases = (await context.pool.query('SELECT released_at,status FROM job_leases')).rows;
              assert.equal(leases.length, 1); assert.ok(leases[0].released_at); assert.equal(leases[0].status, 'completed');
              assert.equal((await context.store.getDiscovery(fixture.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, 'completed');
            }
            assert.equal(records.slice(offset).some(record => ['scenario_work', 'pool_close', 'database_drop'].includes(record.phase)), false);
            if (stage !== 'prune') gates[stage].hold.resolve();
          }
          controller.abort(primary); await Promise.resolve();
          assert.equal(settled, false); assert.deepEqual(await databaseIdentity(context.pool), first);
          gates.prune.hold.resolve(); await assert.rejects(pending, error => error === primary);
        } finally { for (const gate of Object.values(gates)) gate.hold.resolve(); await observed; }
        assert.equal(records.filter(record => record.phase === 'scenario_work' && record.outcome === 'failed').length, 1);
        assert.equal(records.filter(record => record.phase === 'database_drop' && record.outcome === 'passed').length, 1);
        await withMusicQueueRecoveryScenario(runtime, t, async current => {
          const second = await databaseIdentity(current.pool);
          assert.notEqual(second.name, first.name); assert.notEqual(second.oid, first.oid);
          assert.equal((await current.pool.query('SELECT oid FROM pg_database WHERE datname=$1', [first.name])).rowCount, 0);
          assert.equal(current.pool.options.max, config.poolMax);
          assert.equal(current.pool.options.connectionTimeoutMillis, config.poolConnectionTimeoutMs);
          for (const table of ['app_users', 'import_candidates', 'operation_runs', 'import_candidate_events', 'audit_events',
            'library_discovery_requests', 'library_wanted_releases', 'library_discovery_request_wanted_release_links', 'job_leases']) {
            assert.equal((await current.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0, table);
          }
          assert.deepEqual((await assertNoPendingMigrations({ getPoolFn: current.getPoolFn })).pending, []);
          const fresh = await queued(current); const result = await runMusicQueueRecoveryDiscoveryWorker(current, fresh);
          assert.equal(result.outcome.state, 'completed'); assert.equal(result.searches.length, 1); assert.equal(result.ingestions.length, 1);
          assert.equal((await current.store.getDiscovery(fresh.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, 'completed');
        }, dependencies);
        assert.equal(records.filter(record => record.phase === 'template_prepare' && record.outcome === 'passed').length, 1);
      }, async () => { await runtime?.cleanup(); });
    })()));
  }
});

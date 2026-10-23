/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { before, after, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createActivityModule } from '../../src/server/activity/activity-module.js';
import { createRestoreScopeRuntimeSnapshotStore } from '../../src/server/recovery/restore-scope-runtime-snapshot-store.js';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';
import { createSourceUserTrustOverrideService } from '../../src/server/activity/source-user-trust-override-service.js';
import { createSourceUserBlocklistService } from '../../src/server/activity/source-user-blocklist-service.js';
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';
import { createSourceUserSpectralCacheStore } from '../../src/server/activity/source-user-spectral-cache-store.js';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';
import { waitForFixtureReady } from '../integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../integration/fixture-lock-observer.js';

const input = { username: 'fixture-peer', filePath: '/fixture/source.flac', declaredCodec: 'flac', sampleRate: 44100 };
const analyze = async () => ({ cutoffHz: 15500, frameCount: 120 });
export function registerSpectralReputationTests({ config, createRuntime }) {
  let runtime;
  async function fixture(work) {
    return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseConfig }) => {
      await applyPendingMigrations({ getPoolFn });
      const pool = getPoolFn();
      const snapshots = createRestoreScopeRuntimeSnapshotStore({ getPoolFn });
      const ledger = createSourceUserOutcomeLedgerStore({ getPoolFn });
      const store = createSourceUserSpectralJobStore({ getPoolFn });
      const cache = createSourceUserSpectralCacheStore({ getPoolFn });
      const evidence = overrides => createSourceUserTrustEvidenceService({ ...snapshots,
        appendOutcomeEventFn: ledger.appendOutcomeEvent, listRecentOutcomeEventsFn: ledger.listRecentOutcomeEvents, ...overrides });
      const service = overrides => createSourceUserSpectralSidecarService({ spectralJobStore: store, spectralCacheStore: cache,
        hashFileFn: async () => 'fixture-hash', analyzeSpectralCutoffFn: analyze,
        recordSpectralOutcomeEvidenceFn: evidence().recordSpectralOutcomeEvidence, ...overrides });
      const counts = async () => (await pool.query(`SELECT
        (SELECT COUNT(*)::int FROM source_user_outcome_events) AS events,
        (SELECT COUNT(*)::int FROM source_user_spectral_cache) AS cache,
        (SELECT COUNT(*)::int FROM recovery_trust_snapshots) AS snapshots`)).rows[0];
      await work({ pool, databaseConfig, getPoolFn, snapshots, ledger, store, cache, evidence, service, counts });
    });
  }
  const scenario = (name, work) => test(name, { timeout: config.scenarioTimeoutMs }, t => fixture(c => work(c, t)));

  suite('atomic spectral reputation in real PostgreSQL', () => {
    before(async () => { runtime = await createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
    after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

    scenario('canonical activity composition commits all effects before draining returned advisories', async (c, t) => {
      const ready = Promise.withResolvers(); const gate = Promise.withResolvers(); let settled = false;
      const { job } = await c.store.enqueueSpectralJob(input);
      const module = createActivityModule({ ...c.snapshots,
        spectralJobStore: c.store, spectralCacheStore: c.cache, fileContentHasher: { hashFile: async () => 'fixture-hash' },
        analyzeSpectralCutoffFn: analyze, sourceUserIgnoreService: { evaluateAutoIgnoreForUser: async () => {} },
        sourceUserOutcomeLedgerStore: { ...c.ledger, listRecentOutcomeEvents: async () => {
          assert.deepEqual(await c.counts(), { events: 1, cache: 1, snapshots: 1 });
          ready.resolve(); await gate.promise; return [];
        } },
      });
      const task = module.sourceUserSpectralSidecarService.processPendingSpectralJobs();
      task.then(() => { settled = true; }, () => { settled = true; });
      try {
        await waitForFixtureReady({ ready: ready.promise, operation: task, signal: t.signal });
        assert.equal(settled, false);
        const events = await c.ledger.listRecentOutcomeEvents(); assert.equal(events[0].id, job.id);
        const [snapshot] = await c.snapshots.listTrustSnapshot(); assert.equal(snapshot.failureCount, 1);
        assert.equal(snapshot.trustHistory[0].id, job.id);
        gate.resolve(); assert.equal((await task).transcodedConfirmed, 1);
        assert.equal((await c.service().processPendingSpectralJobs()).claimed, 0);
        assert.deepEqual(await c.counts(), { events: 1, cache: 1, snapshots: 1 });
      } finally { gate.resolve(); await Promise.allSettled([task]); }
    });

    for (const phase of ['before-commit', 'after-commit']) {
      scenario(`actual consumer exit ${phase} preserves atomic recovery and replay`, async (c, t) => {
        const { job } = await c.store.enqueueSpectralJob(input);
        const ready = Promise.withResolvers(); const closed = Promise.withResolvers(); let retired = false;
        const child = spawn(process.execPath, [fileURLToPath(new URL('../fixtures/spectral-reputation-consumer.js', import.meta.url))],
          { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        child.stdout.resume(); child.stderr.resume();
        child.once('message', message => { if (message === 'checkpoint') ready.resolve(); });
        child.once('error', error => closed.reject(error)); child.once('close', () => { retired = true; closed.resolve(); });
        try {
          child.send({ connectionConfig: c.databaseConfig, phase });
          await waitForFixtureReady({ ready: ready.promise, operation: closed.promise, signal: t.signal });
          assert.deepEqual(await c.counts(), phase === 'before-commit'
            ? { events: 0, cache: 0, snapshots: 0 } : { events: 1, cache: 1, snapshots: 1 });
          child.kill(); await closed.promise;
          // This actual row lock also waits for server-side transaction retirement.
          await c.pool.query('SELECT id FROM source_user_spectral_jobs WHERE id=$1 FOR UPDATE', [job.id]);
          if (phase === 'before-commit') {
            await c.pool.query("UPDATE source_user_spectral_jobs SET claimed_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [job.id]);
            assert.equal(await c.store.requeueStaleActiveJobs({ olderThanMs: 1 }), 1);
          }
          assert.equal((await c.service().processPendingSpectralJobs()).claimed, phase === 'before-commit' ? 1 : 0);
          assert.deepEqual(await c.counts(), { events: 1, cache: 1, snapshots: 1 });
          assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
        } finally { if (!retired) child.kill(); await closed.promise; }
      });
    }

    for (const reason of [new Error('original ledger failure'), null]) {
      scenario(`ledger ${reason === null ? 'null' : 'Error'} after INSERT rolls back every durable effect`, async c => {
        await c.store.enqueueSpectralJob(input); const warnings = [];
        const result = await c.service({ recordSpectralOutcomeEvidenceFn: c.evidence({ appendOutcomeEventFn: async event => {
          await c.ledger.appendOutcomeEvent(event); throw reason;
        } }).recordSpectralOutcomeEvidence, onWarning: (_message, error) => warnings.push(error) }).processPendingSpectralJobs();
        assert.equal(result.failed, 1); assert.ok(warnings.includes(reason));
        assert.deepEqual(await c.counts(), { events: 0, cache: 0, snapshots: 0 });
        assert.equal(await c.store.countPendingSpectralJobs(), 1);
        assert.equal((await c.service().processPendingSpectralJobs()).transcodedConfirmed, 1);
        assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
      });
    }

    for (const target of ['source_user_spectral_cache', 'source_user_spectral_jobs', 'recovery_trust_snapshots']) {
      scenario(`real SQL failure in ${target} refuses partial publication`, async c => {
        await c.store.enqueueSpectralJob(input);
        await c.pool.query("CREATE OR REPLACE FUNCTION fixture_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture refusal'; END $$");
        const event = target === 'source_user_spectral_jobs' ? "UPDATE OF state ON source_user_spectral_jobs FOR EACH ROW WHEN (NEW.state='done')" : `INSERT ON ${target} FOR EACH ROW`;
        await c.pool.query(`CREATE TRIGGER fixture_refusal BEFORE ${event} EXECUTE FUNCTION fixture_refuse()`);
        assert.equal((await c.service().processPendingSpectralJobs()).failed, 1);
        assert.deepEqual(await c.counts(), { events: 0, cache: 0, snapshots: 0 });
        await c.pool.query(`DROP TRIGGER fixture_refusal ON ${target}`);
        assert.equal((await c.service().processPendingSpectralJobs()).transcodedConfirmed, 1);
      });
    }

    for (const reason of [new Error('cancelled before commit'), null]) {
      scenario(`abort with ${reason === null ? 'null' : 'Error'} after evidence rolls back counters and ledger`, async (c, t) => {
        await c.store.enqueueSpectralJob(input);
        const ready = Promise.withResolvers(); const gate = Promise.withResolvers(); const controller = new AbortController();
        const task = c.service({ recordSpectralOutcomeEvidenceFn: async event => {
          const result = await c.evidence().recordSpectralOutcomeEvidence(event); ready.resolve(); await gate.promise; return result;
        } }).processPendingSpectralJobs({ signal: controller.signal });
        const refused = assert.rejects(task, error => error === reason);
        try {
          await waitForFixtureReady({ ready: ready.promise, operation: task, signal: t.signal });
          assert.deepEqual(await c.counts(), { events: 0, cache: 0, snapshots: 0 });
          controller.abort(reason); gate.resolve(); await refused;
          assert.deepEqual(await c.counts(), { events: 0, cache: 0, snapshots: 0 });
          assert.equal(await c.store.countPendingSpectralJobs(), 1);
        } finally { gate.resolve(); await Promise.allSettled([task, refused]); }
      });
    }

    scenario('duplicate event identity refuses counter increments and concurrent workers preserve independent events', async c => {
      const { job } = await c.store.enqueueSpectralJob(input);
      await c.ledger.appendOutcomeEvent({ id: job.id, username: input.username, outcome: 'failure' });
      assert.equal((await c.service().processPendingSpectralJobs()).failed, 1);
      assert.deepEqual(await c.counts(), { events: 1, cache: 0, snapshots: 0 });
      await c.pool.query('TRUNCATE source_user_outcome_events');
      await c.store.enqueueSpectralJob(input);
      await c.store.enqueueSpectralJob({ ...input, username: 'another-peer' });
      await Promise.all([c.service().processPendingSpectralJobs({ limit: 2 }), c.service().processPendingSpectralJobs({ limit: 2 })]);
      assert.deepEqual(await c.counts(), { events: 3, cache: 1, snapshots: 2 });
      const rows = await c.snapshots.listTrustSnapshot();
      assert.equal(rows.find(row => row.username === input.username).failureCount, 2);
      assert.equal(rows.find(row => row.username === 'another-peer').failureCount, 1);
    });

    scenario('retroactive and non-penalizing classifications publish no reputation evidence', async c => {
      for (const verdict of ['authentic', 'suspicious', 'inconclusive', 'retroactive']) {
        if (verdict === 'retroactive') await c.store.enqueueRetroactiveLibraryJobs({ files: [{ libraryFileId: '00000000-0000-4000-8000-000000000001', filePath: input.filePath }] });
        else await c.store.enqueueSpectralJob(input);
        const result = await c.service({ classifySpectralCutoffFn: () => ({ verdict: verdict === 'retroactive' ? 'transcoded' : verdict,
          penalize: verdict === 'retroactive', confidence: 1 }) }).processPendingSpectralJobs();
        assert.equal(result.analyzed, 1);
      }
      assert.deepEqual(await c.counts(), { events: 0, cache: 1, snapshots: 0 });
    });

    for (const first of ['snapshot', 'spectral']) {
      scenario(`${first}-first admission serializes outcome, override, block, unblock and full replacement`, async (c, t) => {
        for (const action of ['outcome', 'override', 'block', 'unblock', 'replace']) {
          await c.pool.query('TRUNCATE source_user_spectral_jobs, source_user_spectral_cache, source_user_outcome_events');
          await c.snapshots.replaceTrustSnapshot({ sourceUsers: [{ username: input.username, failureCount: 5,
            isBlocked: action === 'unblock', trustState: action === 'unblock' ? 'blocked' : 'neutral' }] });
          await c.store.enqueueSpectralJob(input);
          const ready = Promise.withResolvers(); const gate = Promise.withResolvers(); let holderPid;
          const heldPool = () => ({ connect: async () => {
            const client = await c.pool.connect();
            holderPid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            await client.query("SET default_transaction_isolation='repeatable read'");
            return { release: error => client.release(error), query: async (...args) => {
              const result = await client.query(...args);
              if (args[0].startsWith(action === 'replace' ? 'DELETE FROM recovery_trust_snapshots' : 'SELECT payload FROM recovery_trust_snapshots')) {
                ready.resolve(); await gate.promise;
              }
              return result;
            } };
          } });
          const selected = first === 'snapshot' ? createRestoreScopeRuntimeSnapshotStore({ getPoolFn: heldPool }) : c.snapshots;
          const writer = () => {
            if (action === 'replace') return selected.replaceTrustSnapshot({ sourceUsers: [{ username: input.username, failureCount: 20 }] });
            if (action === 'outcome') return createSourceUserTrustEvidenceService({ ...selected, appendOutcomeEventFn: c.ledger.appendOutcomeEvent })
              .recordSourceUserOutcomeEvidence({ username: input.username, outcome: 'success' });
            if (action === 'override') return createSourceUserTrustOverrideService(selected)
              .updateSourceUserTrust({ username: input.username, reason: 'fixture', trustState: 'trusted' });
            const blocklist = createSourceUserBlocklistService(selected);
            return action === 'block' ? blocklist.blockSourceUser({ username: input.username, reason: 'fixture' })
              : blocklist.unblockSourceUser({ username: input.username });
          };
          const spectral = () => c.service({ recordSpectralOutcomeEvidenceFn: async event => {
            const result = await c.evidence().recordSpectralOutcomeEvidence(event);
            if (first === 'spectral') {
              holderPid = (await event.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
              ready.resolve(); await gate.promise;
            }
            return result;
          } }).processPendingSpectralJobs();
          const owner = first === 'snapshot' ? writer() : spectral(); let other;
          try {
            await waitForFixtureReady({ ready: ready.promise, operation: owner, signal: t.signal });
            other = first === 'snapshot' ? spectral() : writer(); other.catch(() => {});
            await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal: t.signal }, observer =>
              waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: other, signal: t.signal }));
            gate.resolve(); await Promise.all([owner, other]);
            const [row] = await c.snapshots.listTrustSnapshot();
            assert.equal(row.failureCount, action === 'replace' ? (first === 'snapshot' ? 21 : 20) : 6);
            if (action === 'outcome') assert.equal(row.successCount, 1);
            if (action === 'override') assert.equal(row.trustState, 'trusted');
            if (action === 'block') assert.equal(row.isBlocked, true);
            if (action === 'unblock') assert.equal(row.isBlocked, false);
            assert.equal((await c.ledger.listRecentOutcomeEvents()).filter(event => event.eventType === 'spectral_analysis').length, 1);
          } finally { gate.resolve(); await Promise.allSettled([owner, other]); }
        }
      });
    }

    scenario('legacy ledger SQL refusal recovers its savepoint while preserving snapshot evidence', async c => {
      await c.pool.query("CREATE OR REPLACE FUNCTION fixture_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture refusal'; END $$");
      await c.pool.query('CREATE TRIGGER fixture_refusal BEFORE INSERT ON source_user_outcome_events FOR EACH ROW EXECUTE FUNCTION fixture_refuse()');
      await c.evidence().recordSourceUserOutcomeEvidence({ username: input.username, outcome: 'failure' });
      assert.deepEqual(await c.counts(), { events: 0, cache: 0, snapshots: 1 });
      assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
    });
  });
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { before, after, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createMusicQueueRecoveryService } from '../../src/server/import-candidates/music-queue-recovery-service.js';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';
import { createTrustSnapshotStore } from '../../src/server/recovery/trust-snapshot-store.js';
import { seedImportCandidateFixture } from '../integration/import-candidate-fixtures.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture, recoverMusicQueueFixture } from '../integration/music-queue-recovery-fixtures.js';
import { waitForFixtureReady } from '../integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../integration/fixture-postgres-observer.js';

const operations = [
  ['markImportCandidateApplied', 'import_pending', 'applied', 'success', {}],
  ['markImportCandidateDownloadFailed', 'downloading', 'failed', 'failure', {}],
  ['markImportCandidateQualityFailed', 'import_pending', 'failed', 'failure', {}],
  ['markImportCandidateImportBlocked', 'import_pending', 'failed', 'failure', { recordSourceFailure: true }],
];

export function registerCandidateReputationTests({ config, createRuntime }) {
  let runtime;
  async function fixture(work) {
    return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseConfig }) => {
      await applyPendingMigrations({ getPoolFn });
      const pool = getPoolFn(); const snapshots = createTrustSnapshotStore({ getPoolFn });
      const ledger = createSourceUserOutcomeLedgerStore({ getPoolFn });
      const evidence = overrides => createSourceUserTrustEvidenceService({ ...snapshots,
        appendOutcomeEventFn: ledger.appendOutcomeEvent, ...overrides });
      const service = overrides => createImportCandidateService({ pool, recordAuditEventFn: async () => {},
        recordSourceUserOutcomeEvidenceFn: evidence().recordSourceUserOutcomeEvidence, ...overrides });
      const seed = (status = 'downloading') => seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status } });
      const counts = async () => (await pool.query(`SELECT
        (SELECT count(*)::int FROM source_user_outcome_events) AS ledger,
        (SELECT count(*)::int FROM recovery_trust_snapshots) AS snapshots,
        (SELECT count(*)::int FROM import_candidate_events) AS events`)).rows[0];
      return work({ pool, getPoolFn, databaseConfig, snapshots, ledger, evidence, service, seed, counts });
    });
  }
  const scenario = (name, run) => test(name, { timeout: config.scenarioTimeoutMs }, t => fixture(c => run(c, t)));
  suite('Atomic candidate reputation with PostgreSQL', () => {
    before(async () => { runtime = await createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
    after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

    for (const [method, status, terminal, outcome, options] of operations) {
      scenario(`${method} binds ledger and history to the guarded event`, async c => {
        const candidate = await c.seed(status);
        const result = await c.service()[method]({ importCandidateId: candidate.id, reason: 'fixture', ...options });
        assert.equal(result.candidate.status, terminal);
        const [event] = await c.ledger.listRecentOutcomeEvents();
        assert.equal(event.id, result.event.id); assert.equal(event.outcome, outcome);
        assert.equal(event.eventType, result.event.eventType); assert.equal(event.occurredAt, new Date(result.event.occurredAt).toISOString());
        const [row] = await c.snapshots.listTrustSnapshot();
        assert.equal(row.trustHistory[0].id, result.event.id);
        assert.equal(row[outcome === 'success' ? 'successCount' : 'failureCount'], 1);
        await assert.rejects(c.service()[method]({ importCandidateId: candidate.id, ...options }), e => e.code === 'import_candidate_status_conflict');
        assert.deepEqual(await c.counts(), { ledger: 1, snapshots: 1, events: 1 });
      });
    }

    for (const failure of [new Error('fixture ledger refusal'), null]) {
      scenario(`candidate ledger ${failure === null ? 'null' : 'Error'} rolls back the producer and counters`, async c => {
        const candidate = await c.seed();
        const record = c.evidence({ appendOutcomeEventFn: async event => { await c.ledger.appendOutcomeEvent(event); throw failure; } }).recordSourceUserOutcomeEvidence;
        await assert.rejects(c.service({ recordSourceUserOutcomeEvidenceFn: record }).markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), e => e === failure);
        assert.equal((await c.pool.query('SELECT status FROM import_candidates WHERE id=$1', [candidate.id])).rows[0].status, 'downloading');
        assert.deepEqual(await c.counts(), { ledger: 0, snapshots: 0, events: 0 });
        await c.service().markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
        assert.deepEqual(await c.counts(), { ledger: 1, snapshots: 1, events: 1 });
      });
    }
    for (const table of ['source_user_outcome_events', 'recovery_trust_snapshots']) {
      scenario(`actual SQL refusal in ${table} rolls back accepted candidate evidence`, async c => {
        const candidate = await c.seed();
        await c.pool.query("CREATE OR REPLACE FUNCTION fixture_refuse_candidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture refusal'; END $$");
        await c.pool.query(`CREATE TRIGGER fixture_candidate_refusal BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fixture_refuse_candidate()`);
        try { await assert.rejects(c.service().markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), /fixture refusal/u); }
        finally { await c.pool.query(`DROP TRIGGER fixture_candidate_refusal ON ${table}`); }
        assert.deepEqual(await c.counts(), { ledger: 0, snapshots: 0, events: 0 });
        assert.equal((await c.pool.query('SELECT status FROM import_candidates WHERE id=$1', [candidate.id])).rows[0].status, 'downloading');
      });
    }
    scenario('conflicting ledger identity refuses rather than accepting a different outcome', async c => {
      const candidate = await c.seed(); const id = randomUUID();
      await c.ledger.appendOutcomeEvent({ id, username: candidate.username, outcome: 'success' });
      const record = c.evidence().recordSourceUserOutcomeEvidence;
      const service = c.service({ recordSourceUserOutcomeEvidenceFn: event => record({ ...event, id }) });
      // Foreign identity is refused before SQL, with no producer publication.
      await assert.rejects(service.markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), /publication authority/u);
      assert.deepEqual(await c.counts(), { ledger: 1, snapshots: 0, events: 0 });
    });
    scenario('actual duplicate ledger primary key rolls back the candidate publication', async c => {
      const candidate = await c.seed(); const record = c.evidence().recordSourceUserOutcomeEvidence;
      await assert.rejects(c.service({ recordSourceUserOutcomeEvidenceFn: async event => {
        await c.ledger.appendOutcomeEvent({ ...event, outcome: 'success' });
        return record(event);
      } }).markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), error => error.code === '23505');
      assert.deepEqual(await c.counts(), { ledger: 0, snapshots: 0, events: 0 });
    });
    scenario('concurrent terminal calls produce one observation and one counter increment', async c => {
      const candidate = await c.seed();
      const results = await Promise.allSettled([0, 1].map(() => c.service().markImportCandidateDownloadFailed({ importCandidateId: candidate.id })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.code, 'import_candidate_status_conflict');
      assert.deepEqual(await c.counts(), { ledger: 1, snapshots: 1, events: 1 });
    });
    scenario('a genuine later attempt retains a distinct event identity after ledger pruning', async c => {
      const candidate = await c.seed(); const service = c.service();
      const first = await service.markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
      await c.ledger.pruneOutcomeEvents({ olderThan: new Date(Date.now() + 60_000).toISOString() });
      await assert.rejects(service.markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), e => e.code === 'import_candidate_status_conflict');
      await service.reopenImportCandidate({ importCandidateId: candidate.id });
      await service.selectImportCandidate({ importCandidateId: candidate.id });
      const second = await service.markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
      assert.notEqual(first.event.id, second.event.id);
      assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 2);
      assert.equal((await c.ledger.listRecentOutcomeEvents())[0].id, second.event.id);
    });
    scenario('operator import blocker does not penalize a source', async c => {
      const candidate = await c.seed('import_pending');
      await c.service().markImportCandidateImportBlocked({ importCandidateId: candidate.id, recordSourceFailure: false });
      assert.deepEqual(await c.counts(), { ledger: 0, snapshots: 0, events: 1 });
    });
    scenario('advisories see committed evidence and cannot undo publication', async c => {
      const candidate = await c.seed(); let observed;
      const record = c.evidence().recordSourceUserOutcomeEvidence;
      await c.service({ recordSourceUserOutcomeEvidenceFn: async event => {
        const result = await record(event);
        return { ...result, afterCommit: async () => { observed = await c.counts(); throw new Error('advisory refusal'); } };
      } }).markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
      assert.deepEqual(observed, { ledger: 1, snapshots: 1, events: 1 });
    });

    scenario('recovery concurrent replay retains one terminal identity and one counter', async c => {
      const context = createMusicQueueRecoveryFixtureContext(c); const f = await seedMusicQueueRecoveryFixture(context);
      const results = await Promise.all([recoverMusicQueueFixture(context, f), recoverMusicQueueFixture(context, f)]);
      assert.equal(results.filter(r => r.episodeReplayed).length, 1);
      assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
      const [event] = await c.ledger.listRecentOutcomeEvents();
      const owner = (await c.pool.query('SELECT event_type FROM import_candidate_events WHERE id=$1', [event.id])).rows[0];
      assert.equal(owner.event_type, 'import_candidate_download_failed');
      await c.ledger.pruneOutcomeEvents({ olderThan: new Date(Date.now() + 60_000).toISOString() });
      assert.equal((await recoverMusicQueueFixture(context, f)).episodeReplayed, true);
      assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
    });
    for (const failure of [new Error('fixture recovery refusal'), null]) {
      scenario(`recovery ${failure === null ? 'null' : 'Error'} refuses terminal, episode and child writes together`, async c => {
        const context = createMusicQueueRecoveryFixtureContext(c); const f = await seedMusicQueueRecoveryFixture(context);
        const previousCounts = await c.counts();
        context.service = createMusicQueueRecoveryService({ ...context,
          createExecutionRun: context.executionRuns.createOperationRun, createDiscoveryRun: context.discoveryRuns.createOperationRun,
          recordSourceOutcome: c.evidence({ appendOutcomeEventFn: async event => { await c.ledger.appendOutcomeEvent(event); throw failure; } }).recordSourceUserOutcomeEvidence });
        await assert.rejects(recoverMusicQueueFixture(context, f), e => e === failure);
        assert.deepEqual(await c.counts(), previousCounts);
        assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'downloading');
        assert.equal((await c.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE summary ? 'musicQueueRecovery'")).rows[0].count, 0);
      });
    }
    scenario('a scheduled same-candidate rejection retry does not record a failure', async c => {
      const context = createMusicQueueRecoveryFixtureContext(c); const f = await seedMusicQueueRecoveryFixture(context);
      const result = await recoverMusicQueueFixture(context, f, 'rejected');
      assert.equal(result.retrySameCandidate, true);
      assert.equal((await c.counts()).ledger, 0); assert.equal((await c.counts()).snapshots, 0);
    });
    for (const phase of ['before-commit', 'after-commit']) {
      scenario(`actual consumer exit ${phase} leaves a recoverable atomic state`, async (c, t) => {
        const candidate = await c.seed(); const ready = Promise.withResolvers(); const close = Promise.withResolvers(); let retired = false;
        const child = spawn(process.execPath, [fileURLToPath(new URL('../fixtures/candidate-reputation-consumer.js', import.meta.url))],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        child.once('message', message => { if (message === 'held') ready.resolve(); });
        child.once('error', error => close.reject(error)); child.once('close', () => { retired = true; close.resolve(); });
        try {
          child.send({ connectionConfig: c.databaseConfig, candidateId: candidate.id, phase });
          await waitForFixtureReady({ ready: ready.promise, operation: close.promise, signal: t.signal });
          const committed = phase === 'after-commit';
          assert.deepEqual(await c.counts(), { ledger: committed ? 1 : 0, snapshots: committed ? 1 : 0, events: committed ? 1 : 0 });
          child.kill(); await close.promise;
          await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal: t.signal }, async observer => {
            await observer.query('BEGIN');
            try { await observer.query('SELECT id FROM import_candidates WHERE id=$1 FOR UPDATE', [candidate.id]); }
            finally { await observer.query('ROLLBACK'); }
          });
          if (committed) await assert.rejects(c.service().markImportCandidateDownloadFailed({ importCandidateId: candidate.id }), e => e.code === 'import_candidate_status_conflict');
          else await c.service().markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
          assert.deepEqual(await c.counts(), { ledger: 1, snapshots: 1, events: 1 });
          assert.equal((await c.snapshots.listTrustSnapshot())[0].failureCount, 1);
        } finally { if (!retired) child.kill(); await close.promise; }
      });
    }
  });
}

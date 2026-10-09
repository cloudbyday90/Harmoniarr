/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedImportExecutionOriginFixture, reviewImportExecutionOrigin, readImportExecutionOriginCounts }
  from '../../testing/integration/import-execution-origin-fixtures.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createMusicQueueExecutionObservationService } from '../../src/server/import-candidates/music-queue-execution-observation-service.js';
import { createSlskdTransferSnapshotService } from '../../src/server/slskd/slskd-transfer-snapshot-service.js';
import { listImportExecutionRunItems, updateImportExecutionRunItem, initializeImportExecutionRunItems,
  replaceImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createOperationRunStore, countPrunableOperationRuns, pruneOperationRunsLedger } from '../../src/server/operation-run-store.js';
import { createImportCandidateExecutionHeartbeat } from '../../src/server/import-candidates/import-candidate-execution-heartbeat.js';
import { buildPublicImportCandidateExecution } from '../../src/server/import-candidates/import-candidate-execution-public-projection.js';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createSlskdModule } from '../../src/server/slskd/slskd-module.js';
import { createSlskdConfigService } from '../../src/server/slskd/slskd-config-service.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let unavailable;
async function scenario(t, callback, options = {}) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    await callback(await seedImportExecutionOriginFixture(t, { getPoolFn, ...options }));
  });
}
const resolve = (context, command, service = context.service) => service.resolveDownloadOrigin({ ...context.owner, command });
const barrier = () => { let release; const promise = new Promise((res) => { release = res; }); return { promise, release }; };
async function waitForBlock(context) {
  for (let index = 0; index < 100; index += 1) {
    const rows = await context.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND cardinality(pg_blocking_pids(pid))>0 AND query NOT LIKE '%pg_stat_activity%'`);
    if (rows.rowCount) return;
    await new Promise((res) => { setTimeout(res, 10); });
  }
  assert.fail('Expected an actual PostgreSQL writer lock wait');
}

suite('Guarded origin retirement and restored observation in real PostgreSQL', () => {
  before(async () => { try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('one exact shared batch restores once, survives an unrelated newer job, and heartbeat completes the original source', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const command = await reviewImportExecutionOrigin(context);
    const result = await resolve(context, command);
    assert.equal(result.downloadOriginResolution.outcome, 'restored'); assert.equal(context.state.posts, 0);
    assert.equal(await context.store.getCurrentOrigin({ importCandidateId: context.candidate.id }), context.sourceRunId);
    assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'downloading');
    const beforeReplay = await readImportExecutionOriginCounts(context);
    assert.equal((await resolve(context, command)).downloadOriginResolution.replayed, true);
    assert.deepEqual(await readImportExecutionOriginCounts(context), beforeReplay);
    const sourceItem = await context.evidenceStore.getItem(context.owner);
    const retired = await context.pool.query('SELECT summary,status FROM operation_runs WHERE id=$1', [context.newerRunId]);
    assert.deepEqual(retired.rows[0].summary.downloadOriginSupersession, sourceItem.planningSnapshot.execution.handoff.originResolution);
    assert.equal(retired.rows[0].status, 'cancelled');
    const unrelated = await context.executionRuns.createOperationRun({ status: 'pending', requestedCandidateCount: 0,
      summary: { executionMode: 'download_enqueue', requestedCandidateCount: 0, triggerSource: 'manual' } });
    const summaryService = createImportCandidateExecutionSummaryService({ importCandidateExecutionRunStore: context.executionRuns,
      listImportExecutionRunItemsFn: (id) => listImportExecutionRunItems(id, context.pool),
      buildTransferSnapshot: createSlskdTransferSnapshotService({ getBoundDownloads: async ({ requestedTransfers }) => ({
        observations: requestedTransfers.map((request) => ({ request, transfer: { ...context.state.evidence.transfers[0],
          state: 'Completed, Succeeded', bytesTransferred: request.size }, issue: null })) }) }).buildTransferSnapshot });
    const summary = await summaryService.buildImportCandidateExecutionSummary();
    assert.equal(summary.currentRun.id, unrelated.id);
    assert.equal(summary.restoredRuns[0].id, context.sourceRunId);
    assert.doesNotMatch(JSON.stringify(buildPublicImportCandidateExecution(summary)), /restoredRuns|sourceAttemptId|originResolution|downloadOriginSupersession|requestHash/u);
    const phase = createMusicQueueExecutionObservationService({ store: context.recoveryStore, withTransaction: context.withTransaction });
    const reconciliation = createImportCandidateExecutionReconciliationService({ getImportCandidate: ({ importCandidateId }) => context.evidenceStore.getCandidate(importCandidateId),
      transitionOwnedExecutionCandidate: phase.transitionOwnedExecutionCandidate,
      isCurrentExecutionObservation: ({ candidateId, operationRunId }) => context.evidenceStore.isCurrentOrigin({ importCandidateId: candidateId, operationRunId }),
      updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool) });
    const heartbeat = createImportCandidateExecutionHeartbeat({ buildImportCandidateExecutionSummary: async () => summary,
      reconcileImportCandidateExecutionState: reconciliation.reconcileImportCandidateExecutionState });
    const outcome = await heartbeat.tick();
    assert.equal(outcome.skipped, false);
    assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'import_pending');
    assert.equal((await context.executionRuns.listRestoredExecutionRuns()).runIds.length, 0);
    assert.equal(context.state.posts, 0);
  }));

  test('legacy uncertainty, claims, leases and positive or incomplete provider evidence cannot retire newer work', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const initial = await readImportExecutionOriginCounts(context);
    const mutations = [
      async () => context.pool.query("UPDATE import_execution_run_items SET item_status='awaiting_confirmation' WHERE operation_run_id=$1", [context.newerRunId]),
      async () => context.pool.query("UPDATE operation_runs SET claimed_at=NOW(),claimed_by_instance_id='other',attempt_count=1 WHERE id=$1", [context.newerRunId]),
      async () => { await context.executionRuns.acquireLease({ runId: context.newerRunId }); },
    ];
    for (const mutate of mutations) {
      await mutate();
      assert.equal((await context.service.getDownloadOriginReview(context.owner)).downloadOriginReview.canRestore, false);
      await context.pool.query("UPDATE import_execution_run_items SET item_status='ready' WHERE operation_run_id=$1", [context.newerRunId]);
      await context.pool.query('UPDATE operation_runs SET claimed_at=NULL,claimed_by_instance_id=NULL,attempt_count=0 WHERE id=$1', [context.newerRunId]);
      await context.pool.query('DELETE FROM job_leases WHERE lease_key=$1', [`import_candidate_execution_planning:${context.newerRunId}`]);
    }
    for (const state of ['Queued, Locally', 'Completed, Errored']) {
      context.state.evidence.transfers[0].state = state;
      assert.equal((await context.service.getDownloadOriginReview(context.owner)).downloadOriginReview.canRestore, false);
    }
    assert.deepEqual(await readImportExecutionOriginCounts(context), initial);
    assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'selected'); assert.equal(context.state.posts, 0);
  }));

  test('required phase, confirmation and resolution audits roll back retirement, pair, links and phase together', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const command = await reviewImportExecutionOrigin(context); const initial = await readImportExecutionOriginCounts(context);
    for (const eventType of ['import_candidate_downloading', 'import_execution_handoff_confirmed', 'import_execution_origin_restored']) {
      await context.pool.query(`CREATE OR REPLACE FUNCTION reject_origin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='${eventType}' THEN RAISE EXCEPTION 'Controlled origin audit failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_origin_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_origin_audit()`);
      await assert.rejects(resolve(context, command), /Controlled origin audit failure/u);
      assert.deepEqual(await readImportExecutionOriginCounts(context), initial);
      assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'selected');
      assert.equal((await context.pool.query('SELECT status,summary FROM operation_runs WHERE id=$1', [context.newerRunId])).rows[0].status, 'pending');
      assert.equal((await context.evidenceStore.getItem(context.owner)).planningSnapshot.execution.handoff.originResolution, undefined);
      await context.pool.query('DROP TRIGGER reject_origin_audit ON audit_events');
    }
  }));

  test('retirement serializes scoped allocation, lease admission and stale source writes through actual parent lock waits', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const entered = barrier(); const release = barrier();
    const service = context.createService({ confirmDownloadHandoff: async (input) => { entered.release(); await release.promise; return context.handoff.confirmDownloadHandoff(input); } });
    const command = await reviewImportExecutionOrigin(context, service);
    const staleSource = await context.evidenceStore.getItem(context.owner);
    const resolving = resolve(context, command, service);
    await entered.promise;
    const allocation = context.executionRuns.createOperationRun({ status: 'pending', requestedCandidateCount: 1,
      summary: { executionMode: 'download_enqueue', requestedCandidateCount: 1, selectedCandidateId: context.candidate.id, triggerSource: 'manual' } });
    const lease = context.executionRuns.acquireLease({ runId: context.newerRunId });
    const unscoped = await context.executionRuns.createOperationRun({ status: 'pending', requestedCandidateCount: 1,
      summary: { executionMode: 'download_enqueue', requestedCandidateCount: 1, triggerSource: 'manual' } });
    const association = initializeImportExecutionRunItems(unscoped.id, [{ importCandidateId: context.candidate.id, position: 1,
      itemStatus: 'ready', statusMessage: 'Stale unscoped initializer', planningSnapshot: {} }], context.pool);
    const stale = updateImportExecutionRunItem({ importCandidateId: context.candidate.id, operationRunId: context.sourceRunId,
      itemStatus: 'blocked', statusMessage: 'Stale old writer', planningSnapshot: staleSource.planningSnapshot }, context.pool);
    const observed = Promise.allSettled([allocation, lease, stale, association]);
    await waitForBlock(context); release.release(); await resolving;
    const results = await observed;
    assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'rejected');
    assert.equal(results[2].status, 'fulfilled'); assert.equal(results[2].value, null);
    assert.equal(results[3].status, 'fulfilled'); assert.deepEqual(results[3].value, []);
    assert.equal((await context.evidenceStore.getItem(context.owner)).planningSnapshot.execution.handoff.state, 'confirmed');
    assert.equal(context.state.posts, 0);
  }));

  test('retired jobs cannot restart, retry, rewrite items or lose lineage through either retention sweep', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const command = await reviewImportExecutionOrigin(context); await resolve(context, command);
    const row = (await context.pool.query('SELECT summary FROM operation_runs WHERE id=$1', [context.newerRunId])).rows[0];
    const operations = createOperationRunStore({ getPoolFn: context.getPoolFn, operationType: 'import_candidate_execution_planning' });
    for (const method of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunPaused', 'markRunCancelled']) await operations[method]({ runId: context.newerRunId, summary: {}, errorMessage: 'Late worker' });
    const queue = createOperationQueueStore({ getPoolFn: context.getPoolFn });
    assert.equal(await queue.scheduleRetry({ runId: context.newerRunId }), null);
    await assert.rejects(createOperationRunControlService({ getPoolFn: context.getPoolFn }).requestOperationRunRetry({ runId: context.newerRunId }), { code: 'operation_run_not_retryable' });
    assert.deepEqual(await initializeImportExecutionRunItems(context.newerRunId, [{ importCandidateId: context.candidate.id, position: 1,
      itemStatus: 'ready', statusMessage: 'Late initializer', planningSnapshot: {} }], context.pool), []);
    await assert.rejects(replaceImportExecutionRunItems(context.newerRunId, [], context.pool), { code: 'import_execution_origin_resolution_stale' });
    const current = (await context.pool.query('SELECT summary,status FROM operation_runs WHERE id=$1', [context.newerRunId])).rows[0];
    assert.equal(current.status, 'cancelled'); assert.deepEqual(current.summary.downloadOriginSupersession, row.summary.downloadOriginSupersession);
    const denied = barrier();
    const worker = createImportCandidateExecutionWorker({ ...context.executionRuns, ...context.handoff,
      acquireLease: async (input) => { try { return await context.executionRuns.acquireLease(input); }
        catch (error) { denied.release(); throw error; } },
      prepareDownloadDispatch: context.provider.prepareDownloadDispatch,
      enqueueDownloads: async () => { context.state.posts += 1; throw new Error('Retired worker must not POST'); } });
    await worker.startWorkerRun({ runId: context.newerRunId, selectedCandidateId: context.candidate.id, requestedCandidateCount: 1 });
    await denied.promise;
    await context.pool.query("UPDATE operation_runs SET created_at=NOW()-INTERVAL '30 days',started_at=NOW()-INTERVAL '30 days' WHERE id=ANY($1::uuid[])", [[context.sourceRunId, context.newerRunId]]);
    await operations.createOperationRun({ status: 'completed', summary: {} });
    await operations.pruneOldRuns({ retainCount: 1 });
    const options = { getPoolFn: context.getPoolFn, olderThanIso: new Date(Date.now() - 7 * 86_400_000).toISOString(), retainCountPerType: 1 };
    assert.equal((await countPrunableOperationRuns(options)).prunableCount, 0);
    assert.equal((await pruneOperationRunsLedger(options)).prunedCount, 0);
    assert.equal((await context.pool.query('SELECT id FROM operation_runs WHERE id=ANY($1::uuid[])', [[context.sourceRunId, context.newerRunId]])).rowCount, 2);
    assert.equal(context.state.posts, 0);
  }));

  test('native default-module config reads share a single transaction connection and reject credential changes during the owning lock', { timeout: config.scenarioTimeoutMs }, async (t) => {
    let transactionalReads = 0;
    const createProvider = ({ settings, pool }) => {
      pool.options.max = 1; pool.options.connectionTimeoutMillis = 500;
      const read = async (queryable) => { if (queryable) transactionalReads += 1; await (queryable ?? pool).query('SELECT 1'); };
      return createSlskdModule({ slskdConfigService: createSlskdConfigService({ env: {},
        loadSettingsFn: async (queryable) => { await read(queryable); return { slskd: {
          providerMode: 'external', baseUrl: settings.baseUrl, requestTimeoutMs: settings.requestTimeoutMs } }; },
        encryptedSecretService: { getSecretValue: async ({ queryable }) => { await read(queryable); return settings.apiKey; } },
      }) }).slskdService;
    };
    await scenario(t, async (context) => {
      const command = await reviewImportExecutionOrigin(context);
      await resolve(context, command);
      assert.ok(transactionalReads >= 2);
      assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'downloading');
      const next = await seedImportExecutionOriginFixture(t, { getPoolFn: context.getPoolFn, createProvider });
      const locked = barrier(); const release = barrier();
      const service = next.createService({ store: { ...next.store, lockContext: async (input) => {
        const current = await next.store.lockContext(input); locked.release(); await release.promise; return current;
      } } });
      const nextCommand = await reviewImportExecutionOrigin(next, service);
      const initial = await readImportExecutionOriginCounts(next);
      const pending = resolve(next, nextCommand, service);
      const result = Promise.allSettled([pending]);
      await locked.promise; next.settings.apiKey = 'changed-current-key'; release.release();
      assert.equal((await result)[0].status, 'rejected');
      assert.deepEqual(await readImportExecutionOriginCounts(next), initial);
      assert.equal((await next.evidenceStore.getCandidate(next.candidate.id)).status, 'selected');
      assert.equal((await next.pool.query('SELECT status FROM operation_runs WHERE id=$1', [next.newerRunId])).rows[0].status, 'pending');
      assert.equal(next.state.posts, 0);
    }, { createProvider });
  });

  test('fresh actor, shared consent and physical source changes after the batch read refuse every owning write', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (first) => {
    for (const [index, change] of ['actor', 'consent', 'source'].entries()) {
      const context = index === 0 ? first : await seedImportExecutionOriginFixture(t, { getPoolFn: first.getPoolFn });
      const command = await reviewImportExecutionOrigin(context);
      const initial = await readImportExecutionOriginCounts(context);
      const service = context.createService({ getDownloadBatchEvidence: async (input) => {
        const raw = await context.provider.getDownloadBatchEvidence(input);
        if (change === 'actor') await context.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [context.owner.actorUserId]);
        if (change === 'consent') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence='{}'::jsonb WHERE wanted_release_id=$1", [context.fixture.wantedId]);
        if (change === 'source') await context.pool.query('UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [context.candidate.id, 'Changed physical source']);
        return raw;
      } });
      await assert.rejects(resolve(context, command, service));
      assert.deepEqual(await readImportExecutionOriginCounts(context), initial);
      assert.equal((await context.evidenceStore.getCandidate(context.candidate.id)).status, 'selected');
      assert.equal((await context.pool.query('SELECT status FROM operation_runs WHERE id=$1', [context.newerRunId])).rows[0].status, 'pending');
      assert.equal(context.state.posts, 0);
    }
  }));
});

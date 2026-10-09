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
import { seedImportExecutionOriginFixture, reviewImportExecutionOrigin } from '../../testing/integration/import-execution-origin-fixtures.js';
import { createImportExecutionHandoffFixtureContext, runImportExecutionHandoffFixtureWorker } from '../../testing/integration/import-execution-handoff-fixtures.js';
import { createImportExecutionPreparationClosureService } from '../../src/server/import-candidates/import-execution-preparation-closure-service.js';
import { createImportExecutionPreparationClosureStore } from '../../src/server/import-candidates/import-execution-preparation-closure-store.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createImportCandidateExecutionHeartbeat } from '../../src/server/import-candidates/import-candidate-execution-heartbeat.js';
import { hasCertifiedPreProviderRefusal } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore, pruneOperationRunsLedger } from '../../src/server/operation-run-store.js';
import { listImportExecutionRunItems, updateImportExecutionRunItem, replaceImportExecutionRunItems,
  findUnconfirmedImportExecutionHandoff } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { buildPublicImportCandidateExecution } from '../../src/server/import-candidates/import-candidate-execution-public-projection.js';
import { recordAuditEvent } from '../../src/server/audit.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let unavailable;
const gate = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; };
async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const origin = await seedImportExecutionOriginFixture(t, { getPoolFn });
    const execution = createImportExecutionHandoffFixtureContext({ getPoolFn });
    const createCloser = (options = {}) => createImportExecutionPreparationClosureService({
      store: createImportExecutionPreparationClosureStore({ getPoolFn }), withTransaction: origin.withTransaction, ...options });
    await callback({ ...origin, getPoolFn, execution, createCloser, closer: createCloser(),
      queue: createOperationQueueStore({ getPoolFn }), control: createOperationRunControlService({ getPoolFn }) });
  });
}
const owner = (c) => ({ operationRunId: c.newerRunId, importCandidateId: c.candidate.id });
async function read(c) {
  return { run: (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.newerRunId])).rows[0],
    item: await c.evidenceStore.getItem(owner(c)), lease: await c.executionRuns.getLease({ runId: c.newerRunId }) };
}
const certificate = (state) => hasCertifiedPreProviderRefusal({ run: { id: state.run.id, status: state.run.status, summary: state.run.summary }, item: state.item });
const close = (c, epoch, closer = c.closer) => closer.closeAbandonedPreparation({ ...owner(c), expectedEpoch: epoch });
async function prepare(c, { staged = false, keepOlder = false } = {}) {
  if (!keepOlder) await c.pool.query('DELETE FROM import_execution_run_items WHERE operation_run_id=$1', [c.sourceRunId]);
  const lease = await c.executionRuns.acquireLease({ runId: c.newerRunId });
  await c.executionRuns.markRunStarted({ runId: c.newerRunId });
  const requestedFiles = c.candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  const started = await c.execution.preparation.beginPreparation({ runId: c.newerRunId, importCandidateId: c.candidate.id,
    requestedFiles, sourceObservation: captureRecoveryObservation(c.candidate), lease });
  assert.equal(started.allowPreparation, true);
  let attempt;
  if (staged) {
    const dispatch = await c.provider.prepareDownloadDispatch();
    const result = await c.execution.handoff.prepareDownloadHandoff({ ...owner(c), requestedFiles, username: c.candidate.username,
      sourceObservation: captureRecoveryObservation(c.candidate), providerBinding: dispatch.binding, preProviderEpochId: started.epochId, lease });
    assert.equal(result.dispatchAllowed, true); attempt = result.attempt;
  }
  return { lease, epoch: (await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch, attempt };
}
async function strand(c, { cancel = false } = {}) {
  if (cancel) await c.control.requestOperationRunCancellation({ runId: c.newerRunId, requestedByUserId: c.owner.actorUserId });
  await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`import_candidate_execution_planning:${c.newerRunId}`]);
  const recovery = createOperationStrandedRunRecoveryService({ operationQueueStore: c.queue,
    jobLeaseStore: createJobLeaseStore({ getPoolFn: c.getPoolFn }) });
  await recovery.recoverStrandedRuns({ operationTypes: ['import_candidate_execution_planning'] });
}
function summaryOwner(c) {
  return createImportCandidateExecutionSummaryService({ importCandidateExecutionRunStore: c.executionRuns,
    listImportExecutionRunItemsFn: (id) => listImportExecutionRunItems(id, c.pool),
    buildTransferSnapshot: async () => ({ getTransfer: () => null }) });
}

suite('Idle future preparation closure with real PostgreSQL and native provider fences', () => {
  before(async () => { try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('real cancellation and stranded recovery let heartbeat close R2 and existing administrator proof restore R1', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await prepare(c, { keepOlder: true }); await strand(c, { cancel: true });
    const cancelled = await read(c); assert.equal(cancelled.run.status, 'cancelled'); assert.equal(certificate(cancelled), false);
    const confirmations = [];
    const reconcile = createImportCandidateExecutionReconciliationService({ ...c.execution.handoff,
      closeAbandonedPreparation: c.closer.closeAbandonedPreparation,
      confirmDownloadHandoff: async (value) => { confirmations.push(value.operationRunId); return c.execution.handoff.confirmDownloadHandoff(value); } });
    const heartbeat = createImportCandidateExecutionHeartbeat({ buildImportCandidateExecutionSummary: summaryOwner(c).buildImportCandidateExecutionSummary,
      reconcileImportCandidateExecutionState: reconcile.reconcileImportCandidateExecutionState });
    assert.equal((await heartbeat.tick()).skipped, false);
    assert.equal(certificate(await read(c)), true); assert.equal(confirmations.includes(c.newerRunId), false);
    assert.equal((await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch.epochId, input.epoch.epochId);
    const wanted = (await createLibraryWantedReleaseStore({ getPoolFn: c.getPoolFn }).listWantedReleasesWithMetadata({ wantedReleaseId: c.fixture.wantedId }))[0];
    assert.equal(wanted.discoveryRequest.importReviewSummary.currentDownloadHandoff.operationRunId, c.sourceRunId);
    const publicSummary = buildPublicImportCandidateExecution(await summaryOwner(c).buildImportCandidateExecutionSummary());
    assert.equal(publicSummary.currentRun.status, 'cancelled');
    assert.doesNotMatch(JSON.stringify(publicSummary), /downloadPreparationClosure|preProviderEpoch|epochId|preparation-closure:/u);
    const command = await reviewImportExecutionOrigin(c);
    assert.equal((await c.service.resolveDownloadOrigin({ ...c.owner, command })).downloadOriginResolution.outcome, 'restored');
    assert.equal((await c.evidenceStore.getCandidate(c.candidate.id)).status, 'downloading'); assert.equal(c.state.posts, 0);
  }));

  test('an actual staged native beforeSend callback released after closure cannot cross or POST', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await c.pool.query('DELETE FROM import_execution_run_items WHERE operation_run_id=$1', [c.sourceRunId]);
    const entered = gate(); const resume = gate();
    const worker = runImportExecutionHandoffFixtureWorker(c.execution, owner(c), {
      prepareDownloadDispatch: c.provider.prepareDownloadDispatch,
      markDispatchPossible: async (value) => { entered.release(); await resume.promise; return c.execution.preparation.markDispatchPossible(value); },
    });
    await entered.promise;
    const epoch = (await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch;
    assert.equal(epoch.phase, 'preparing'); assert.ok(epoch.attemptId);
    await strand(c); assert.equal((await close(c, epoch)).closed, true);
    resume.release(); await worker;
    assert.equal(c.state.posts, 0); assert.equal(certificate(await read(c)), true);
    assert.equal((await read(c)).run.status, 'cancelled');
    assert.equal((await c.evidenceStore.getCandidate(c.candidate.id)).status, 'selected');
  }));

  test('crossing first prevents closure and closure first prevents an old owner crossing', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const first of ['cross', 'close']) await scenario(t, async (c) => {
      const input = await prepare(c, { staged: true });
      const dispatch = () => c.execution.preparation.markDispatchPossible({ runId: c.newerRunId, importCandidateId: c.candidate.id,
        epochId: input.epoch.epochId, attemptId: input.attempt.attemptId, lease: input.lease });
      if (first === 'cross') await dispatch();
      await strand(c); const result = await close(c, input.epoch);
      assert.equal(result.closed, first === 'close');
      if (first === 'close') await assert.rejects(dispatch(), { code: 'import_execution_preparation_stale' });
      else assert.equal(certificate(await read(c)), false);
      assert.equal(c.state.posts, 0);
    });
  });

  test('required audit failure and expiry during that audit roll back lease takeover, item, parent fence and audit', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await prepare(c, { staged: true }); await strand(c);
    const original = await read(c);
    for (const failure of ['audit', 'expiry']) {
      await c.pool.query(`CREATE OR REPLACE FUNCTION reject_closure_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='import_execution_preparation_closed' THEN
          ${failure === 'audit' ? "RAISE EXCEPTION 'Controlled closure audit failure';" : "UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key='import_candidate_execution_planning:'||NEW.entity_id;"}
        END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_closure_commit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_closure_commit()`);
      await assert.rejects(close(c, input.epoch), failure === 'audit' ? /Controlled closure audit failure/u : { code: 'import_execution_preparation_closure_stale' });
      assert.deepEqual(await read(c), original); assert.equal(certificate(await read(c)), false);
      assert.equal((await c.pool.query("SELECT COUNT(*)::integer count FROM audit_events WHERE event_type='import_execution_preparation_closed'")).rows[0].count, 0);
      await c.pool.query('DROP TRIGGER reject_closure_commit ON audit_events');
    }
    assert.equal(c.state.posts, 0);
  }));

  test('current running work, live claims, live leases and changed source cannot be inferred abandoned', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await prepare(c); assert.equal((await close(c, input.epoch)).closed, false);
    await strand(c); const original = await read(c);
    for (const mutation of ['claim', 'live_lease', 'source', 'malformed']) {
      if (mutation === 'claim') await c.pool.query("UPDATE operation_runs SET claimed_at=NOW(),claimed_by_instance_id='other-worker' WHERE id=$1", [c.newerRunId]);
      if (mutation === 'live_lease') await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '1 minute',released_at=NULL WHERE lease_key=$1", [original.lease.leaseKey]);
      if (mutation === 'source') await c.pool.query("UPDATE import_candidates SET username='changed-provider' WHERE id=$1", [c.candidate.id]);
      if (mutation === 'malformed') await c.pool.query("UPDATE import_execution_run_items SET planning_snapshot=jsonb_set(planning_snapshot,'{execution,handoff,preProviderEpoch}','null'::jsonb) WHERE operation_run_id=$1", [c.newerRunId]);
      assert.equal((await close(c, input.epoch)).closed, false, mutation);
      assert.equal(certificate(await read(c)), false);
      await c.pool.query('UPDATE operation_runs SET claimed_at=NULL,claimed_by_instance_id=NULL WHERE id=$1', [c.newerRunId]);
      await c.pool.query('UPDATE job_leases SET expires_at=$2,released_at=$3 WHERE lease_key=$1', [original.lease.leaseKey, original.lease.expiresAt, original.lease.releasedAt]);
      await c.pool.query('UPDATE import_candidates SET username=$2 WHERE id=$1', [c.candidate.id, c.candidate.username]);
      await c.pool.query('UPDATE import_execution_run_items SET planning_snapshot=$2::jsonb WHERE operation_run_id=$1', [c.newerRunId, JSON.stringify(original.item.planningSnapshot)]);
    }
    assert.equal((await close(c, input.epoch)).closed, true); assert.equal(c.state.posts, 0);
  }));

  test('queue claim first denies closure; closure first fences claim, start, retry, lease and stale item writes', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await prepare(c); await strand(c);
    await c.pool.query("UPDATE operation_runs SET status='pending',next_attempt_at=NOW(),max_attempts=10 WHERE id=$1", [c.newerRunId]);
    assert.equal((await c.queue.claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] })).id, c.newerRunId);
    assert.equal((await close(c, input.epoch)).closed, false);
    await c.pool.query('UPDATE operation_runs SET claimed_at=NULL,claimed_by_instance_id=NULL WHERE id=$1', [c.newerRunId]);
    const entered = gate(); const finish = gate();
    const closer = c.createCloser({ recordAuditEventFn: async (event, queryable) => {
      await recordAuditEvent(event, queryable); entered.release(); await finish.promise;
    } });
    const result = close(c, input.epoch, closer); await entered.promise;
    assert.equal(await c.queue.claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] }), null);
    finish.release(); assert.equal((await result).closed, true);
    assert.equal(await c.queue.claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] }), null);
    await assert.rejects(c.control.requestOperationRunRetry({ runId: c.newerRunId }), { code: 'operation_run_not_retryable' });
    await assert.rejects(c.executionRuns.acquireLease({ runId: c.newerRunId }), { code: 'operation_run_lease_unavailable' });
    await c.executionRuns.markRunStarted({ runId: c.newerRunId, summary: { downloadPreparationClosure: null } });
    assert.equal((await read(c)).run.status, 'cancelled');
    assert.equal(await updateImportExecutionRunItem({ ...input, ...owner(c), itemStatus: 'ready', planningSnapshot: { execution: {} }, statusMessage: 'Stale overwrite' }, c.pool), null);
    await assert.rejects(replaceImportExecutionRunItems(c.newerRunId, [], c.pool), { code: 'import_execution_origin_resolution_stale' });
    const auditCount = (await c.pool.query("SELECT COUNT(*)::integer count FROM audit_events WHERE event_type='import_execution_preparation_closed'")).rows[0].count;
    assert.equal((await close(c, input.epoch)).closed, false); assert.equal(auditCount, 1);
    assert.equal(c.state.posts, 0);
  }));

  test('reciprocal closure survives retention; orphan or malformed records remain unresolved rather than unused', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await prepare(c); await strand(c); assert.equal((await close(c, input.epoch)).closed, true);
    await c.pool.query("UPDATE operation_runs SET finished_at=NOW()-INTERVAL '100 days' WHERE id=$1", [c.newerRunId]);
    await createOperationRunStore({ getPoolFn: c.getPoolFn, operationType: 'import_candidate_execution_planning' }).pruneOldRuns({ retainCount: 1 });
    await pruneOperationRunsLedger({ getPoolFn: c.getPoolFn, olderThanIso: new Date().toISOString(), retainCountPerType: 1 });
    assert.equal(certificate(await read(c)), true);
    for (const value of [null, {}]) {
      await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{downloadPreparationClosure}',$2::jsonb) WHERE id=$1", [c.newerRunId, JSON.stringify(value)]);
      assert.equal(certificate(await read(c)), false);
      assert.equal((await findUnconfirmedImportExecutionHandoff(c.pool)).operationRunId, c.newerRunId);
      assert.equal((await c.executionRuns.listUnconfirmedExecutionRuns()).runIds.includes(c.newerRunId), true);
      assert.equal(await c.evidenceStore.findUnresolvedOtherHandoff({ operationRunId: c.sourceRunId, importCandidateId: c.candidate.id }) != null, true);
      await assert.rejects(c.control.requestOperationRunRetry({ runId: c.newerRunId }), { code: 'operation_run_not_retryable' });
    }
  }));
});

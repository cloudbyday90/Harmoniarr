/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { seedImportExecutionOriginFixture, reviewImportExecutionOrigin } from '../../testing/integration/import-execution-origin-fixtures.js';
import { createImportExecutionPreProviderService } from '../../src/server/import-candidates/import-execution-pre-provider-service.js';
import { createImportExecutionPreProviderStore } from '../../src/server/import-candidates/import-execution-pre-provider-store.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { hasCertifiedPreProviderRefusal, isUnresolvedPreProviderPreparation } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { initializeImportExecutionRunItems, listImportExecutionRunItems, replaceImportExecutionRunItems,
  updateImportExecutionRunItem, findUnconfirmedImportExecutionHandoff } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createOperationRunStore, pruneOperationRunsLedger } from '../../src/server/operation-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { buildPublicImportCandidateExecution } from '../../src/server/import-candidates/import-candidate-execution-public-projection.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let unavailable;
async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const context = await seedImportExecutionOriginFixture(t, { getPoolFn });
    context.preparation = createImportExecutionPreProviderService({ store: createImportExecutionPreProviderStore({ getPoolFn }),
      withTransaction: context.withTransaction });
    context.currentHandoff = createImportExecutionHandoffService({ store: context.evidenceStore, withTransaction: context.withTransaction,
      transferLinkStore: createImportExecutionTransferLinkStore({ getPoolFn }), preProviderService: context.preparation });
    context.getPoolFn = getPoolFn;
    await callback(context);
  });
}
const owner = (c) => ({ runId: c.newerRunId, importCandidateId: c.candidate.id });
const files = (candidate) => candidate.files.filter((file) => !file.isLocked)
  .map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
async function read(c) {
  return { run: (await c.pool.query('SELECT id,summary,status FROM operation_runs WHERE id=$1', [c.newerRunId])).rows[0],
    item: await c.evidenceStore.getItem({ operationRunId: c.newerRunId, importCandidateId: c.candidate.id }) };
}
async function start(c, overrides = {}) {
  let finish; const completed = new Promise((resolve) => { finish = resolve; });
  const worker = createImportCandidateExecutionWorker({ ...c.executionRuns, ...c.currentHandoff, ...c.preparation,
    releaseLease: async (input) => { await c.executionRuns.releaseLease(input); finish(); },
    getImportCandidate: ({ importCandidateId }) => c.evidenceStore.getCandidate(importCandidateId),
    buildSelectedImportCandidateSummary: async () => ({ counts: { ready: 1, blocked: 0, totalSelected: 1 },
      selectedCandidates: [{ ...await c.evidenceStore.getCandidate(c.candidate.id), planning: {},
        executionStatus: { code: 'ready', message: 'Ready for download.' } }] }),
    initializeImportExecutionRunItems: (id, proposed) => initializeImportExecutionRunItems(id, proposed, c.pool),
    listImportExecutionRunItems: (id) => listImportExecutionRunItems(id, c.pool),
    updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, c.pool),
    prepareDownloadDispatch: c.provider.prepareDownloadDispatch, ...overrides });
  worker.startWorkerRun({ runId: c.newerRunId, requestedCandidateCount: 1, selectedCandidateId: c.candidate.id,
    triggerSource: 'missing_music_manual', sourceSearchId: c.candidate.sourceSearchId });
  await completed;
}
async function begin(c, { detach = true } = {}) {
  if (detach) await c.pool.query('DELETE FROM import_execution_run_items WHERE operation_run_id=$1', [c.sourceRunId]);
  const lease = await c.executionRuns.acquireLease({ runId: c.newerRunId });
  await c.executionRuns.markRunStarted({ runId: c.newerRunId });
  const candidate = await c.evidenceStore.getCandidate(c.candidate.id);
  const preparation = await c.preparation.beginPreparation({ ...owner(c), lease, requestedFiles: files(candidate),
    sourceObservation: captureRecoveryObservation(candidate) });
  assert.equal(preparation.allowPreparation, true);
  return { ...owner(c), lease, epochId: preparation.epochId, candidate, preparation };
}
async function stage(c, input) {
  return c.currentHandoff.prepareDownloadHandoff({ operationRunId: input.runId, importCandidateId: input.importCandidateId,
    requestedFiles: files(input.candidate), username: input.candidate.username, sourceObservation: captureRecoveryObservation(input.candidate),
    providerBinding: (await c.provider.prepareDownloadDispatch()).binding, preProviderEpochId: input.epochId, lease: input.lease });
}

suite('Future-only preparation refusal in real PostgreSQL and native controlled HTTP', () => {
  before(async () => { try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a real leased version refusal restores the older exact batch without sending another request', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const claimed = await createOperationQueueStore({ getPoolFn: c.getPoolFn }).claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] });
    assert.equal(claimed.id, c.newerRunId);
    c.state.version = '0.99.0';
    await start(c);
    const stopped = await read(c);
    assert.equal(stopped.run.status, 'failed');
    assert.equal(stopped.item.planningSnapshot.execution.handoff.preProviderEpoch.refusal.reasonCode, 'provider_version_unsupported');
    assert.equal(hasCertifiedPreProviderRefusal(stopped), true);
    assert.equal((await c.executionRuns.getLease({ runId: c.newerRunId })).releasedAt != null, true);
    c.state.version = '0.26.0';
    const wanted = (await createLibraryWantedReleaseStore({ getPoolFn: c.getPoolFn }).listWantedReleasesWithMetadata({
      wantedReleaseId: c.fixture.wantedId }))[0];
    assert.equal(wanted.discoveryRequest.importReviewSummary.currentDownloadHandoff.operationRunId, c.sourceRunId);
    const summary = await createImportCandidateExecutionSummaryService({ importCandidateExecutionRunStore: c.executionRuns,
      listImportExecutionRunItemsFn: (id) => listImportExecutionRunItems(id, c.pool),
      buildTransferSnapshot: async () => ({ getTransfer: () => null }) }).buildImportCandidateExecutionSummary();
    assert.equal(summary.unconfirmedRuns[0].id, c.sourceRunId);
    assert.doesNotMatch(JSON.stringify(buildPublicImportCandidateExecution(summary)), /preProviderEpoch|downloadPreparationProtocol|epochId/u);
    const command = await reviewImportExecutionOrigin(c);
    assert.equal((await c.service.resolveDownloadOrigin({ ...c.owner, command })).downloadOriginResolution.outcome, 'restored');
    assert.equal((await c.evidenceStore.getCandidate(c.candidate.id)).status, 'downloading');
    assert.equal(c.state.posts, 0);
  }));

  test('older uncertainty produces an explicit refusal rather than absent checkpoint inference', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await start(c);
    assert.equal((await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch.refusal.reasonCode, 'prior_handoff_unresolved');
    assert.equal(hasCertifiedPreProviderRefusal(await read(c)), true);
    const command = await reviewImportExecutionOrigin(c);
    assert.equal((await c.service.resolveDownloadOrigin({ ...c.owner, command })).downloadOriginResolution.outcome, 'restored');
    assert.equal(c.state.posts, 0);
  }));

  test('actual planning and no-unlocked-files stops seal only their own future epoch', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const reason of ['planning_blocked', 'no_unlocked_files']) await scenario(t, async (c) => {
      if (reason === 'no_unlocked_files') await c.pool.query('UPDATE import_candidate_files SET is_locked=true WHERE import_candidate_id=$1', [c.candidate.id]);
      await start(c, reason === 'planning_blocked' ? { buildSelectedImportCandidateSummary: async () => ({
        counts: { blocked: 1, totalSelected: 1 }, selectedCandidates: [{ ...c.candidate, planning: {},
          executionStatus: { code: 'blocked', message: 'Controlled unavailable preparation.' } }] }) } : {});
      const stopped = await read(c);
      assert.equal(hasCertifiedPreProviderRefusal(stopped), true);
      assert.equal(stopped.item.planningSnapshot.execution.handoff.preProviderEpoch.refusal.reasonCode, reason);
      assert.equal(stopped.item.planningSnapshot.execution.handoff.attempt, undefined);
      assert.equal(c.state.posts, 0);
    });
  });

  test('seal and dispatch crossing serialize; crossed work can never acquire a refusal certificate', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await begin(c); const prepared = await stage(c, input);
    const results = await Promise.allSettled([
      c.preparation.markDispatchPossible({ ...input, attemptId: prepared.attempt.attemptId }),
      c.preparation.refusePreparation({ ...input, reasonCode: 'operation_paused' }),
    ]);
    const current = await read(c); const epoch = current.item.planningSnapshot.execution.handoff.preProviderEpoch;
    assert.ok(['refused', 'may_have_dispatched'].includes(epoch.phase));
    assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value === true).length, 1);
    assert.equal(await c.preparation.refusePreparation({ ...input, reasonCode: 'preparation_refused' }), false);
    assert.equal(hasCertifiedPreProviderRefusal(current), epoch.phase === 'refused');
    assert.equal(c.state.posts, 0);
  }));

  test('required refusal and crossing audits roll back the epoch; a worker does not retry a failed seal', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await begin(c); const prepared = await stage(c, input);
    for (const kind of ['import_execution_preparation_refused', 'import_execution_dispatch_possible']) {
      await c.pool.query(`CREATE OR REPLACE FUNCTION reject_preparation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='${kind}' THEN RAISE EXCEPTION 'Controlled preparation audit failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_preparation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_preparation_audit()`);
      await assert.rejects(kind === 'import_execution_preparation_refused'
        ? c.preparation.refusePreparation({ ...input, reasonCode: 'planning_blocked' })
        : c.preparation.markDispatchPossible({ ...input, attemptId: prepared.attempt.attemptId }), /Controlled preparation audit failure/u);
      assert.equal((await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch.phase, 'preparing');
      assert.equal(hasCertifiedPreProviderRefusal(await read(c)), false);
      await c.pool.query('DROP TRIGGER reject_preparation_audit ON audit_events');
    }
    assert.equal(c.state.posts, 0);
  }));

  test('a fresh lease invalidates refusal before retry; old callbacks and stale snapshots cannot erase the new generation', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await begin(c); const preparing = (await read(c)).item;
    assert.equal(await c.preparation.refusePreparation({ ...first, reasonCode: 'planning_blocked' }), true);
    assert.equal((await c.preparation.beginPreparation({ ...first, requestedFiles: files(first.candidate),
      sourceObservation: captureRecoveryObservation(first.candidate) })).allowPreparation, false);
    await c.executionRuns.releaseLease({ runId: c.newerRunId, status: 'failed' });
    const secondLease = await c.executionRuns.acquireLease({ runId: c.newerRunId });
    const second = await c.preparation.beginPreparation({ ...owner(c), lease: secondLease,
      requestedFiles: files(first.candidate), sourceObservation: captureRecoveryObservation(first.candidate) });
    assert.equal(second.allowPreparation, true); assert.equal(second.epoch.generation, 2);
    assert.equal(hasCertifiedPreProviderRefusal(await read(c)), false);
    assert.equal(await c.preparation.refusePreparation({ ...first, reasonCode: 'preparation_refused' }), false);
    assert.equal(await updateImportExecutionRunItem({ ...preparing, statusMessage: 'Stale overwrite' }, c.pool), null);
    await assert.rejects(replaceImportExecutionRunItems(c.newerRunId, [], c.pool), { code: 'import_execution_origin_resolution_stale' });
    assert.equal((await read(c)).item.planningSnapshot.execution.handoff.preProviderEpoch.epochId, second.epochId);
    assert.equal(await c.evidenceStore.findUnresolvedOtherHandoff({ operationRunId: c.sourceRunId, importCandidateId: c.candidate.id }, c.pool) != null, true);
    assert.equal((await findUnconfirmedImportExecutionHandoff(c.pool)).operationRunId, c.newerRunId);
    const wanted = (await createLibraryWantedReleaseStore({ getPoolFn: c.getPoolFn }).listWantedReleasesWithMetadata({
      wantedReleaseId: c.fixture.wantedId }))[0];
    assert.equal(wanted.discoveryRequest.importReviewSummary.currentDownloadHandoff.operationRunId, c.newerRunId);
  }));

  test('a failed worker planning seal never retries its required audit under a different reason', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await c.pool.query(`CREATE FUNCTION reject_worker_refusal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='import_execution_preparation_refused' AND NEW.details->>'reasonCode'='planning_blocked'
        THEN RAISE EXCEPTION 'Controlled planning seal failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_worker_refusal_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_worker_refusal_audit()`);
    await start(c, { buildSelectedImportCandidateSummary: async () => ({ counts: { blocked: 1, totalSelected: 1 },
      selectedCandidates: [{ ...c.candidate, planning: {}, executionStatus: { code: 'blocked', message: 'Controlled blocked plan.' } }] }) });
    const current = await read(c);
    assert.equal(current.run.status, 'failed');
    assert.equal(current.item.planningSnapshot.execution.handoff.preProviderEpoch.phase, 'preparing');
    assert.equal(hasCertifiedPreProviderRefusal(current), false);
    assert.equal((await c.pool.query("SELECT COUNT(*)::integer count FROM audit_events WHERE event_type='import_execution_preparation_refused'")).rows[0].count, 0);
    assert.equal(c.state.posts, 0);
  }));

  test('a post-boundary native HTTP error remains uncertain without a second POST or certificate', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await c.pool.query('DELETE FROM import_execution_run_items WHERE operation_run_id=$1', [c.sourceRunId]);
    await start(c); const unknown = await read(c);
    assert.equal(c.state.posts, 1);
    assert.equal(unknown.item.planningSnapshot.execution.handoff.preProviderEpoch.phase, 'may_have_dispatched');
    assert.equal(hasCertifiedPreProviderRefusal(unknown), false);
    assert.equal(isUnresolvedPreProviderPreparation(unknown), true);
    await start(c); assert.equal(c.state.posts, 1);
    assert.equal(hasCertifiedPreProviderRefusal(await read(c)), false);
  }));

  test('lifecycle writers preserve the protocol and both retention paths keep a refused epoch fence', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const input = await begin(c);
    assert.equal(await c.preparation.refusePreparation({ ...input, reasonCode: 'planning_blocked' }), true);
    await c.executionRuns.releaseLease({ runId: c.newerRunId, status: 'completed' });
    await c.executionRuns.markRunCompleted({ runId: c.newerRunId, summary: { downloadPreparationProtocol: null } });
    assert.equal(hasCertifiedPreProviderRefusal(await read(c)), true);
    await c.pool.query("UPDATE operation_runs SET finished_at=NOW()-INTERVAL '100 days' WHERE id=$1", [c.newerRunId]);
    const runStore = createOperationRunStore({ getPoolFn: c.getPoolFn, operationType: 'import_candidate_execution_planning' });
    await runStore.pruneOldRuns({ retainCount: 0 });
    await pruneOperationRunsLedger({ getPoolFn: c.getPoolFn, olderThanIso: new Date(Date.now() - 86_400_000).toISOString(), retainCountPerType: 0 });
    assert.equal(hasCertifiedPreProviderRefusal(await read(c)), true);
  }));
});

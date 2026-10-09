/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';
import { createImportExecutionHandoffStore } from '../../src/server/import-candidates/import-execution-handoff-store.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createMusicQueueExecutionObservationService } from '../../src/server/import-candidates/music-queue-execution-observation-service.js';
import { createMusicQueueRecoveryStore } from '../../src/server/import-candidates/music-queue-recovery-store.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { initializeImportExecutionRunItems, upsertImportExecutionRunItem, listImportExecutionRunItems,
  updateImportExecutionRunItem, findUnconfirmedImportExecutionHandoff } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;
async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const store = createImportExecutionHandoffStore({ getPoolFn });
    const links = createImportExecutionTransferLinkStore({ getPoolFn });
    const runs = createImportCandidateExecutionRunStore({ getPoolFn });
    const handoff = createImportExecutionHandoffService({ store, transferLinkStore: links,
      withTransaction: createDatabaseTransactionRunner({ getPoolFn }) });
    await run({ pool: getPoolFn(), getPoolFn, store, links, runs, handoff });
  });
}
async function seed(context, { files = 1, candidate = null } = {}) {
  const stored = candidate ?? await seedImportCandidateFixture({ queryable: context.pool,
    candidateOverrides: { status: 'selected', username: 'handoff-peer' },
    files: Array.from({ length: files }, (_, index) => ({ filename: `${index + 1}.flac`, extension: 'flac', sizeBytes: 1000 + index, isLocked: false })) });
  const run = await context.runs.createOperationRun({ status: 'running', requestedCandidateCount: 1,
    summary: { executionMode: 'download_enqueue', selectedCandidateId: stored.id, triggerSource: 'manual', sourceSearchId: stored.sourceSearchId } });
  // Existing causal confirmation scenarios model historical checkpoints;
  // future leased preparation is exercised by the dedicated epoch suite.
  await context.pool.query("UPDATE operation_runs SET summary=summary-'downloadPreparationProtocol' WHERE id=$1", [run.id]);
  await initializeImportExecutionRunItems(run.id, [{ importCandidateId: stored.id, itemStatus: 'ready', position: 1,
    statusMessage: 'Controlled initial download planning', planningSnapshot: { candidate: { id: stored.id, username: 'handoff-peer' } } }], context.pool);
  const current = await context.store.getCandidate(stored.id);
  return { importCandidateId: stored.id, operationRunId: run.id, candidate: current,
    sourceObservation: captureRecoveryObservation(current), username: current.username,
    requestedFiles: current.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes })) };
}
const receipt = (attempt, requestedFiles = attempt.requestedFiles) => ({ enqueued: requestedFiles.map((file) => ({ ...file, id: randomUUID(), username: attempt.username })), failed: [] });
const confirm = (context, f, attempt, enqueueResult) => context.handoff.confirmDownloadHandoff({ importCandidateId: f.importCandidateId,
  operationRunId: f.operationRunId, attemptId: attempt.attemptId, ...(enqueueResult === undefined ? {} : { enqueueResult }) });
const counts = async (context) => ({ links: (await context.pool.query('SELECT count(*)::int count FROM import_execution_transfer_links')).rows[0].count,
  audits: (await context.pool.query('SELECT count(*)::int count FROM audit_events')).rows[0].count });

suite('Attempt-owned download checkpoint and confirmation transactions in PostgreSQL', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('one exact full receipt atomically links its owning item, confirms its checkpoint and advances its source once', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context, { files: 2 });
      const prepared = await context.handoff.prepareDownloadHandoff(f);
      assert.equal(prepared.dispatchAllowed, true);
      const result = await confirm(context, f, prepared.attempt, receipt(prepared.attempt));
      assert.equal(result.confirmed, true); assert.equal(result.phaseAdvanced, true);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'downloading');
      assert.equal((await counts(context)).links, 2);
      const item = await context.store.getItem(f);
      assert.equal(item.planningSnapshot.execution.handoff.attempt.attemptId, prepared.attempt.attemptId);
      assert.equal(item.planningSnapshot.execution.handoff.state, 'confirmed');
      assert.equal(item.planningSnapshot.execution.acceptedCandidateObservation.status, 'downloading');
      const beforeReplay = await counts(context);
      const resumed = await confirm(context, f, prepared.attempt);
      assert.equal(resumed.alreadyConfirmed, true);
      assert.deepEqual(await counts(context), beforeReplay);
    });
  });

  test('partial, malformed, lost and legacy evidence remain guarded and never imply complete acceptance', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const kind of ['partial','malformed','lost','legacy']) {
        const f = await seed(context, { files: 2 });
        if (kind === 'legacy') {
          await context.pool.query("UPDATE import_execution_run_items SET item_status='awaiting_confirmation',planning_snapshot=jsonb_build_object('execution',jsonb_build_object('handoff',jsonb_build_object('state','dispatching'))) WHERE operation_run_id=$1", [f.operationRunId]);
          assert.equal((await context.handoff.confirmDownloadHandoff({ ...f, attemptId: null })).confirmed, false);
          assert.equal((await context.handoff.prepareDownloadHandoff(f)).dispatchAllowed, false);
          continue;
        }
        const prepared = await context.handoff.prepareDownloadHandoff(f);
        const result = await confirm(context, f, prepared.attempt, kind === 'lost' ? undefined : kind === 'partial'
          ? receipt(prepared.attempt, [prepared.attempt.requestedFiles[0]]) : { enqueued: [{ ...prepared.attempt.requestedFiles[0], id: 'historical-opaque', username: f.username }], failed: [] });
        assert.equal(result.confirmed, false, kind);
        assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected', kind);
        assert.equal((await context.store.getItem(f)).itemStatus, 'awaiting_confirmation', kind);
        assert.equal((await context.handoff.prepareDownloadHandoff(f)).dispatchAllowed, false, kind);
      }
      assert.equal((await counts(context)).links, 1, 'Only the consistent partial receipt was linked');
    });
  });

  test('required audit and mixed foreign receipt conflicts roll back links, phase and confirmation together', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const foreign = await seed(context); const foreignPrepared = await context.handoff.prepareDownloadHandoff(foreign);
      const foreignReceipt = receipt(foreignPrepared.attempt);
      await confirm(context, foreign, foreignPrepared.attempt, foreignReceipt);
      const f = await seed(context, { files: 2 }); const prepared = await context.handoff.prepareDownloadHandoff(f);
      const mixed = receipt(prepared.attempt); mixed.enqueued[0].id = foreignReceipt.enqueued[0].id;
      const beforeConflict = await counts(context);
      await assert.rejects(confirm(context, f, prepared.attempt, mixed), { code: 'import_execution_transfer_link_conflict' });
      assert.deepEqual(await counts(context), beforeConflict);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
      await context.pool.query(`CREATE FUNCTION reject_handoff_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='import_execution_handoff_confirmed' THEN RAISE EXCEPTION 'controlled handoff audit fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_handoff_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_handoff_audit()`);
      await assert.rejects(confirm(context, f, prepared.attempt, receipt(prepared.attempt)), /controlled handoff audit fault/);
      assert.deepEqual(await counts(context), beforeConflict);
      assert.equal((await context.store.getItem(f)).planningSnapshot.execution.handoff.attempt.receipts.length, 0);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
    });
  });

  test('concurrent initializers and stale ordinary writes cannot replace a committed attempt or immutable manifest', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context);
      const preparations = await Promise.all([context.handoff.prepareDownloadHandoff(f), context.handoff.prepareDownloadHandoff(f)]);
      assert.equal(preparations.filter((prepared) => prepared.dispatchAllowed).length, 1, 'One concurrent initializer owns dispatch');
      const prepared = preparations.find((proposal) => proposal.dispatchAllowed);
      await Promise.all([initializeImportExecutionRunItems(f.operationRunId, [{ importCandidateId: f.importCandidateId, position: 2,
        itemStatus: 'ready', statusMessage: 'Stale initializer', planningSnapshot: {} }], context.pool),
      upsertImportExecutionRunItem({ importCandidateId: f.importCandidateId, operationRunId: f.operationRunId, position: 3,
        itemStatus: 'ready', statusMessage: 'Another stale initializer', planningSnapshot: {} }, context.pool)]);
      assert.equal(await updateImportExecutionRunItem({ ...f, planningSnapshot: {}, itemStatus: 'completed', statusMessage: 'Stale observation' }, context.pool), null);
      const item = await context.store.getItem(f);
      assert.equal(item.planningSnapshot.execution.handoff.attempt.attemptId, prepared.attempt.attemptId);
      assert.deepEqual(item.planningSnapshot.execution.handoff.attempt.requestedFiles, prepared.attempt.requestedFiles);
      assert.equal(item.itemStatus, 'awaiting_confirmation');
      const changed = { ...prepared.attempt, attemptId: randomUUID() };
      assert.equal((await confirm(context, f, changed, receipt(changed))).stale, true);
      assert.equal((await counts(context)).links, 0);
    });
  });

  test('two different runs cannot dispatch one candidate while its older handoff is unresolved, and receipt allocation drift remains visible', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const first = await context.handoff.prepareDownloadHandoff(f);
      const second = await seed(context, { candidate: f.candidate });
      const newer = await context.handoff.prepareDownloadHandoff(second);
      assert.equal(newer.dispatchAllowed, false);
      const oldReceipt = await confirm(context, f, first.attempt, receipt(first.attempt));
      assert.equal(oldReceipt.confirmed, false); assert.equal(oldReceipt.disposition, 'confirmed');
      assert.equal((await counts(context)).links, 1);
      assert.equal((await context.store.getItem(f)).itemStatus, 'awaiting_confirmation');
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
      assert.equal((await context.handoff.prepareDownloadHandoff(second)).dispatchAllowed, false);
      assert.ok(await findUnconfirmedImportExecutionHandoff(context.pool));
    });
  });

  test('paused jobs and changed physical evidence refuse the last pre-provider guard without advancing a newer source', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const prepared = await context.handoff.prepareDownloadHandoff(f);
      await context.runs.markRunPaused({ runId: f.operationRunId, summary: { pauseCode: 'controlled_pause' } });
      assert.equal((await context.runs.getRunById(f.operationRunId)).status, 'pending');
      await assert.rejects(context.handoff.assertDownloadHandoffCurrent({ ...f, attemptId: prepared.attempt.attemptId }), { code: 'import_execution_handoff_stale' });
      await context.pool.query("UPDATE operation_runs SET status='running' WHERE id=$1", [f.operationRunId]);
      await context.pool.query('UPDATE import_candidate_files SET size_bytes=size_bytes+1 WHERE import_candidate_id=$1', [f.importCandidateId]);
      await assert.rejects(context.handoff.assertDownloadHandoffCurrent({ ...f, attemptId: prepared.attempt.attemptId }), { code: 'import_execution_handoff_stale' });
      const recorded = await confirm(context, f, prepared.attempt, receipt(prepared.attempt));
      assert.equal(recorded.confirmed, false);
      assert.equal((await counts(context)).links, 0);
      assert.equal((await context.store.getItem(f)).planningSnapshot.execution.handoff.attempt.receipts.length, 1, 'The causal receipt itself remains durable for review');
    });
  });

  test('the actual worker emits no second POST after a lost response or a partial explicit response', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const kind of ['lost','partial']) {
        const f = await seed(context, { files: 2 }); let posts = 0;
        async function runWorker() {
          let finish; const done = new Promise((resolve) => { finish = resolve; });
          const worker = createImportCandidateExecutionWorker({ ...context.runs, ...context.handoff,
            getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
            buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ ...(await context.store.getCandidate(f.importCandidateId)),
              executionStatus: { code: 'ready', message: 'Controlled valid planning' } }], counts: { totalSelected: 1, ready: 1 } }),
            listImportExecutionRunItems: (id) => listImportExecutionRunItems(id, context.pool),
            initializeImportExecutionRunItems: (id, items) => initializeImportExecutionRunItems(id, items, context.pool),
            upsertImportExecutionRunItem: (input) => upsertImportExecutionRunItem(input, context.pool),
            updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool),
            enqueueDownloads: async ({ files, username }) => { posts += 1; if (kind === 'lost') throw new Error('Controlled lost response');
              return { enqueued: [{ ...files[0], username, id: randomUUID() }], failed: [] }; },
            releaseLease: async (input) => { await context.runs.releaseLease(input); finish(); },
          });
          await worker.startWorkerRun({ runId: f.operationRunId, requestedCandidateCount: 1, selectedCandidateId: f.importCandidateId });
          await done;
        }
        await runWorker(); await runWorker();
        assert.equal(posts, 1, kind);
        assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
        assert.equal((await context.store.getItem(f)).itemStatus, 'awaiting_confirmation');
      }
    });
  });

  test('new generic receipts use the guarded phase adapter and stale completion emits no completion or auto-add effects', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const prepared = await context.handoff.prepareDownloadHandoff(f);
      await confirm(context, f, prepared.attempt, receipt(prepared.attempt));
      let activity = 0; let autoAdd = 0;
      const recoveryStore = createMusicQueueRecoveryStore({ getPoolFn: context.getPoolFn });
      const phase = createMusicQueueExecutionObservationService({ store: recoveryStore,
        withTransaction: createDatabaseTransactionRunner({ getPoolFn: context.getPoolFn }) });
      const service = createImportCandidateExecutionReconciliationService({
        getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
        isCurrentExecutionObservation: ({ candidateId, operationRunId }) => context.store.isCurrentOrigin({ importCandidateId: candidateId, operationRunId }),
        transitionOwnedExecutionCandidate: phase.transitionOwnedExecutionCandidate,
        updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool),
        startSafeApplyRunAfterDownloadCompleted: async () => { autoAdd += 1; return { started: false }; },
        recordActivityEventFn: async () => { activity += 1; },
      });
      const item = await context.store.getItem(f);
      const summary = { currentRun: { id: f.operationRunId, status: 'completed', items: [{ ...item,
        liveTransferSummary: { status: 'completed', message: 'Controlled exact-ID transfer completion' } }] } };
      await context.pool.query('UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [f.importCandidateId, 'Different later physical source']);
      const stale = await service.reconcileImportCandidateExecutionSummary({ executionSummary: summary });
      assert.equal(stale.summary.transitioned, 0); assert.equal(activity, 0); assert.equal(autoAdd, 0);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'downloading');
      await context.pool.query('UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [f.importCandidateId, f.candidate.folderPath]);
      const current = await service.reconcileImportCandidateExecutionSummary({ executionSummary: summary });
      assert.equal(current.summary.transitioned, 1); assert.equal(autoAdd, 1);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'import_pending');
    });
  });
});

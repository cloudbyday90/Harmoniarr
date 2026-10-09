/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdTransferSnapshotService } from '../../src/server/slskd/slskd-transfer-snapshot-service.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createMusicQueueExecutionObservationService } from '../../src/server/import-candidates/music-queue-execution-observation-service.js';
import { createMusicQueueRecoveryStore } from '../../src/server/import-candidates/music-queue-recovery-store.js';
import { listImportExecutionRunItems, updateImportExecutionRunItem } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createImportExecutionHandoffFixtureContext, seedImportExecutionHandoffFixture, runImportExecutionHandoffFixtureWorker }
  from '../../testing/integration/import-execution-handoff-fixtures.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;
async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    await run(createImportExecutionHandoffFixtureContext({ getPoolFn }));
  });
}
async function provider(t, { response = 'direct', version = '0.26.0' } = {}) {
  const state = { posts: 0, legacyPosts: 0, batchReads: 0, detailReads: 0, batch: null, response, version };
  const server = createServer(async (request, reply) => {
    const send = (payload, status = 200) => { reply.writeHead(status, { 'Content-Type': 'application/json' }); reply.end(JSON.stringify(payload)); };
    if (request.url === '/api/v0/application/version') return send(state.version);
    if (request.method === 'POST' && request.url === '/api/v0/transfers/downloads/batches') {
      state.posts += 1;
      let raw = ''; for await (const part of request) raw += part;
      const input = JSON.parse(raw);
      state.batch = { id: input.id, username: input.username, direction: 'Download', transfers: input.files.map((file) => ({ ...file,
        id: randomUUID(), username: input.username, direction: 'Download', batchId: input.id, state: 'InProgress', exception: '' })) };
      if (state.response === 'lost') { reply.destroy(); return; }
      if (state.response === 'conflict') return send({ message: 'Already exists' }, 409);
      return send({ batch: state.batch, failures: [] }, 201);
    }
    if (request.method === 'POST') { state.legacyPosts += 1; return send({}, 400); }
    if (request.url?.startsWith('/api/v0/transfers/downloads/batches/')) { state.batchReads += 1; return state.batch ? send(state.batch) : send({}, 404); }
    const id = request.url?.split('/').at(-1);
    const transfer = state.batch?.transfers.find((row) => row.id === id);
    if (transfer) { state.detailReads += 1; return send(transfer); }
    return send({}, 404);
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const settings = { baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'controlled-key', requestTimeoutMs: 2000 };
  const service = createSlskdService({ getClientConfig: async () => settings });
  const matching = createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: service.getDownloadBatchEvidence });
  return { state, settings, service, matching, worker: { prepareDownloadDispatch: service.prepareDownloadDispatch,
    findMatchingTransfers: matching.findMatchingTransfers } };
}

suite('Caller-owned batch handoffs through real PostgreSQL and a controlled HTTP provider', () => {
  before(async () => { try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('the actual pinned batch POST atomically confirms its exact UUID and exact removed receipt completion reaches the guarded phase owner', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const f = await seedImportExecutionHandoffFixture(context, { files: 2 });
    const remote = await provider(t);
    await runImportExecutionHandoffFixtureWorker(context, f, remote.worker);
    const item = await context.store.getItem(f);
    assert.equal(item.planningSnapshot.execution.handoff.attempt.version, 2);
    assert.equal(item.planningSnapshot.execution.handoff.attempt.attemptId, remote.state.batch.id);
    assert.equal(item.planningSnapshot.execution.handoff.state, 'confirmed');
    assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'downloading');
    assert.equal(remote.state.posts, 1); assert.equal(remote.state.legacyPosts, 0);
    for (const transfer of remote.state.batch.transfers) { transfer.state = 'Completed, Succeeded'; transfer.removed = true; transfer.bytesTransferred = transfer.size; }
    const summaryService = createImportCandidateExecutionSummaryService({ importCandidateExecutionRunStore: context.runs,
      listImportExecutionRunItemsFn: (id) => listImportExecutionRunItems(id, context.pool),
      findMatchingTransfers: remote.matching.findMatchingTransfers,
      buildTransferSnapshot: createSlskdTransferSnapshotService({ getDownloads: remote.service.getDownloads,
        getBoundDownloads: remote.service.getBoundDownloads }).buildTransferSnapshot });
    const summary = await summaryService.buildImportCandidateExecutionSummary();
    assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'completed');
    assert.equal(remote.state.detailReads, 2);
    const observationOwner = createMusicQueueExecutionObservationService({ store: createMusicQueueRecoveryStore({ getPoolFn: context.getPoolFn }),
      withTransaction: context.withTransaction });
    const reconcile = createImportCandidateExecutionReconciliationService({ ...context.handoff,
      getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
      transitionOwnedExecutionCandidate: observationOwner.transitionOwnedExecutionCandidate,
      isCurrentExecutionObservation: ({ candidateId, operationRunId }) => context.store.isCurrentOrigin({ importCandidateId: candidateId, operationRunId }),
      updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool) });
    await reconcile.reconcileImportCandidateExecutionSummary({ executionSummary: summary });
    assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'import_pending');
    assert.equal(remote.state.posts, 1);
  }));

  test('a lost response recovers only the complete progressed same batch and never dispatches again', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const f = await seedImportExecutionHandoffFixture(context, { files: 2 }); const remote = await provider(t, { response: 'lost' });
    await runImportExecutionHandoffFixtureWorker(context, f, remote.worker);
    assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
    const id = (await context.store.getItem(f)).planningSnapshot.execution.handoff.attempt.attemptId;
    await runImportExecutionHandoffFixtureWorker(context, f, remote.worker);
    assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'downloading');
    assert.equal((await context.store.getItem(f)).planningSnapshot.execution.handoff.attempt.attemptId, id);
    assert.equal(remote.state.posts, 1); assert.equal(remote.state.legacyPosts, 0); assert.equal(remote.state.batchReads, 1);
  }));

  test('409, local-only and incomplete batches remain unresolved, including after endpoint changes', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    for (const kind of ['conflict', 'local', 'partial', 'endpoint']) {
      const f = await seedImportExecutionHandoffFixture(context, { files: 2 }); const remote = await provider(t, { response: kind === 'conflict' ? 'conflict' : 'lost' });
      await runImportExecutionHandoffFixtureWorker(context, f, remote.worker);
      if (kind === 'local') remote.state.batch.transfers.forEach((transfer) => { transfer.state = 'Queued, Locally'; });
      if (kind === 'partial') remote.state.batch.transfers.pop();
      if (kind === 'conflict') remote.state.batch = null;
      if (kind === 'endpoint') remote.settings.baseUrl = 'http://127.0.0.1:1';
      await runImportExecutionHandoffFixtureWorker(context, f, remote.worker);
      assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected', kind);
      assert.equal((await context.store.getItem(f)).itemStatus, 'awaiting_confirmation', kind);
      assert.equal(remote.state.posts, 1, kind); assert.equal(remote.state.legacyPosts, 0, kind);
    }
  }));

  test('a required confirmation audit failure rolls back batch receipt links, phase and checkpoint; source drift can retain no phase', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (context) => {
    const f = await seedImportExecutionHandoffFixture(context); const remote = await provider(t);
    const dispatch = await remote.service.prepareDownloadDispatch();
    const prepared = await context.handoff.prepareDownloadHandoff({ ...f, providerBinding: dispatch.binding });
    const result = await dispatch.enqueue({ attempt: prepared.attempt });
    await context.pool.query(`CREATE FUNCTION reject_batch_confirmation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='import_execution_handoff_confirmed' THEN RAISE EXCEPTION 'Controlled required audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_batch_confirmation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_batch_confirmation_audit()`);
    await assert.rejects(context.handoff.confirmDownloadHandoff({ ...f, attemptId: prepared.attempt.attemptId, enqueueResult: result }), /Controlled required audit failure/u);
    assert.equal((await context.pool.query('SELECT COUNT(*)::int count FROM import_execution_transfer_links')).rows[0].count, 0);
    assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
    assert.equal((await context.store.getItem(f)).planningSnapshot.execution.handoff.attempt.receipts.length, 0);
    await context.pool.query('DROP TRIGGER reject_batch_confirmation_audit ON audit_events');
    await context.pool.query('UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [f.importCandidateId, 'New physical source']);
    const stale = await context.handoff.confirmDownloadHandoff({ ...f, attemptId: prepared.attempt.attemptId, providerEvidence: remote.state.batch });
    assert.equal(stale.confirmed, false); assert.equal((await context.store.getCandidate(f.importCandidateId)).status, 'selected');
    assert.equal(remote.state.posts, 1);
  }));
});

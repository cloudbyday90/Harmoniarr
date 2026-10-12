/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createApp } from '../../src/server/app.js';
import { seedTrackDeliveryRecoveryFixture, runTrackDeliveryApply } from '../../testing/integration/operator-track-delivery-recovery-fixture.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withLibraryScanCatalogueScenario, snapshotCatalogueFixture } from '../../testing/integration/library-scan-catalogue-scenario.js';
import { createScopedFixtureGate } from '../../testing/integration/fixture-work-scope.js';
import { seedScanReceiptFixture, startScanReceiptWorker } from '../../testing/integration/library-scan-receipt-fixture.js';
import { createOperatorTrackReceiptStore } from '../../src/server/metadata/operator-track-receipt-store.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { createLibraryScanReceiptStore } from '../../src/server/library/library-scan-receipt-store.js';
import { captureScanReceipt } from '../../src/server/library/library-scan-receipt-policy.js';
import { seedTrackReceiptCandidate } from '../../testing/integration/operator-track-receipt-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const negatives = async c => (await c.pool.query('SELECT * FROM operator_track_receipt_invalidations ORDER BY app_user_id')).rows;
const scenario = (t, run) => withLibraryScanCatalogueScenario(runtime, t, async context => run(await seedScanReceiptFixture(context)));

suite('Original scan acquisition owns negative private receipt observations', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('actual worker records one missing revision and retains history, peer and bounded event', { timeout: config.scenarioTimeoutMs }, async t => scenario(t, async c => {
    await rm(c.privateFiles[0]); const job = await startScanReceiptWorker(c); await job.done;
    const saved = await negatives(c); assert.equal(saved.length, 1);
    assert.equal(saved[0].app_user_id, c.receipts[0].ownerId); assert.equal(saved[0].scan_run_id, c.run.id);
    assert.equal(saved[0].scan_acquisition_id, job.lease().acquisitionId);
    const parent = (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
    assert.equal(parent.status, 'completed'); assert.equal(parent.summary.missingReceiptCount, 1);
    const stored = await createOperatorTrackReceiptStore({ getPoolFn: c.getPoolFn }).listFulfillment({ ownerId: c.receipts[0].ownerId,
      metadataReleaseIds: [c.receipts[0].scope.metadataReleaseId] });
    assert.deepEqual(stored[0].files, c.receipts[0].files); assert.equal(stored[0].scanInvalidation.runId, c.run.id);
    const events = (await c.pool.query("SELECT details FROM import_candidate_events WHERE event_type='operator_track_receipt_invalidated_by_scan'")).rows;
    assert.equal(events.length, 1); assert.deepEqual(Object.keys(events[0].details).sort(), ['ownerId', 'receiptRevisionId', 'runId']);
    assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM operator_track_receipts')).rows[0].count, 2);
    // An interrupted post-DDL lineage update can replay the new migration;
    // existing revisions and their observations must remain identical.
    const migrationSql = await readFile(new URL('../../src/server/migrations/20261012_225951_scan_owned_receipt_invalidation.sql', import.meta.url), 'utf8');
    await c.pool.query(migrationSql); assert.deepEqual(await negatives(c), saved);
    // Projection replacement deletes only revision-bound negative evidence.
    const replacement = structuredClone(c.receipts); replacement[0].files[0].evidence.sha256 = 'b'.repeat(64);
    await c.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_build_object('operatorTrackFulfillment',$2::jsonb) WHERE id=$1",
      [c.candidateId, JSON.stringify({ version: 2, receipts: replacement })]);
    assert.equal((await negatives(c)).length, 0);
  }));

  test('a held old walk cannot mark a restored file or replaced receipt revision missing', { timeout: config.scenarioTimeoutMs }, async t => {
    for (const change of ['restored', 'revision', 'new_receipt']) await scenario(t, async c => {
      await rm(c.privateFiles[0]); const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope);
      const job = await startScanReceiptWorker(c, { afterWalk: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
      try {
        if (change === 'restored') await writeFile(c.privateFiles[0], c.bytes);
        else if (change === 'revision') {
          const replacement = structuredClone(c.receipts); replacement[0].files[0].evidence.sha256 = 'b'.repeat(64);
          await c.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_build_object('operatorTrackFulfillment',$2::jsonb) WHERE id=$1",
            [c.candidateId, JSON.stringify({ version: 2, receipts: replacement })]);
        } else {
          await seedTrackReceiptCandidate(c.pool, { version: 2, receipts: c.receipts });
        }
      } finally { resume.release(); }
      await job.done; const saved = await negatives(c);
      assert.equal(saved.length, change === 'new_receipt' ? 1 : 0);
      assert.ok(saved.every(row => row.import_candidate_id === c.candidateId));
      assert.equal((await c.pool.query("SELECT count(*)::integer AS count FROM import_candidate_events WHERE event_type='operator_track_receipt_invalidated_by_scan'")).rows[0].count, change === 'new_receipt' ? 1 : 0);
    });
  });

  test('required-event failure and late lease expiry roll back catalogue and negative rows together', { timeout: config.scenarioTimeoutMs }, async t => {
    for (const refusal of ['event', 'lease', 'root', 'cancel']) await scenario(t, async c => {
      await rm(c.privateFiles[0]); const priorCatalogue = await snapshotCatalogueFixture(c);
      if (['event', 'lease'].includes(refusal)) await c.pool.query(`CREATE FUNCTION refuse_negative_receipt_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN IF NEW.event_type='operator_track_receipt_invalidated_by_scan' THEN
          ${refusal === 'event' ? "RAISE EXCEPTION 'Controlled receipt event refusal';"
          : "UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key='library_scan:' || (NEW.details->>'runId');"}
        END IF; RETURN NEW; END $$;
        CREATE TRIGGER refuse_negative_receipt_event BEFORE INSERT ON import_candidate_events
        FOR EACH ROW EXECUTE FUNCTION refuse_negative_receipt_event()`);
      const job = await startScanReceiptWorker(c, { afterWalk: async () => {
        if (refusal === 'root') await c.pool.query("UPDATE app_users SET managed_library_relative_root='changed-after-walk' WHERE id=$1", [c.receipts[0].ownerId]);
        if (refusal === 'cancel') await c.pool.query('UPDATE operation_runs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [c.run.id]);
      } }); await job.done;
      assert.deepEqual(await snapshotCatalogueFixture(c), priorCatalogue); assert.equal((await negatives(c)).length, 0);
      assert.equal((await c.pool.query("SELECT count(*)::integer AS count FROM import_candidate_events WHERE event_type='operator_track_receipt_invalidated_by_scan'")).rows[0].count, 0);
    });
  });

  test('snapshot bootstrap installs revision identity and scan invalidation constraints', { timeout: config.scenarioTimeoutMs }, async () => runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    assert.equal((await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn })).bootstrapped, true);
    const pool = getPoolFn();
    const constraints = (await pool.query("SELECT conname FROM pg_constraint WHERE conrelid='operator_track_receipt_invalidations'::regclass")).rows;
    assert.ok(constraints.some(row => row.conname === 'operator_track_receipt_invalidations_revision_fkey'));
    assert.equal((await pool.query("SELECT status FROM schema_migrations WHERE filename='20261012_225951_scan_owned_receipt_invalidation.sql'")).rows[0].status, 'applied');
  }));

  test('production module scan reopens only the lost delivery source with bounded scan correlation', { timeout: config.scenarioTimeoutMs }, async () => {
    let module;
    await withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver }),
      createAppFn: options => { const application = createApp(options); module = application.libraryModule; return application; },
      run: async ({ workspaceDir }) => {
        const c = await seedTrackDeliveryRecoveryFixture(workspaceDir);
        await runTrackDeliveryApply(c, createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection }));
        const applied = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
        assert.equal(applied.status, 'applied'); const lost = applied.normalizedPayload.operatorTrackFulfillment.receipts[0];
        const scanRoot = await realpath(c.paths.music);
        const eligible = await createLibraryScanReceiptStore().listForRoot({ root: scanRoot, queryable: c.pool });
        assert.equal(eligible.length, 2, 'Both production receipt paths must be in scan scope');
        for (const row of eligible) assert.ok(captureScanReceipt(row, scanRoot), JSON.stringify({
          ownerValid: row.app_user_id === row.receipt.ownerId, wantedReleaseId: row.receipt.wantedReleaseId,
          scope: row.receipt.scope, file: { ...row.receipt.files[0], libraryPath: undefined } }));
        const deliveredBytes = await readFile(lost.files[0].libraryPath); await rm(lost.files[0].libraryPath);
        const run = await module.libraryScanRunStore.createOperationRun({ libraryRoot: c.paths.music });
        const accepted = await module.libraryScanWorker.startWorkerRun({ runId: run.id, libraryRoot: c.paths.music });
        await accepted.completion;
        const state = (await c.pool.query('SELECT status,summary,error_message FROM operation_runs WHERE id=$1', [run.id])).rows[0];
        assert.equal(state.status, 'completed', state.error_message); assert.equal(state.summary.missingReceiptCount, 1);
        const sources = (await c.pool.query('SELECT requested_for_user_id,request_state FROM media_requests ORDER BY requested_for_user_id')).rows;
        assert.equal(sources.find(row => row.requested_for_user_id === lost.ownerId).request_state, 'needs_fetch');
        assert.equal(sources.filter(row => row.request_state === 'already_exists').length, 1);
        const wanted = (await c.pool.query('SELECT app_user_id FROM library_wanted_releases')).rows;
        assert.deepEqual(wanted.map(row => row.app_user_id), [lost.ownerId]);
        const event = (await c.pool.query("SELECT details FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows;
        assert.equal(event.length, 1); assert.equal(event[0].details.negativeScanRunId, run.id);
        // Negative history cannot suppress current verified media or claim a
        // later direct reconciliation was caused by this completed scan.
        await writeFile(lost.files[0].libraryPath, deliveredBytes);
        await module.libraryWantedReleaseService.reconcileWantedReleases();
        assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM library_wanted_releases')).rows[0].count, 0);
        await rm(lost.files[0].libraryPath); await module.libraryWantedReleaseService.reconcileWantedReleases();
        const repeated = (await c.pool.query("SELECT details FROM media_request_events WHERE event_type='operator_track_source_reopened' ORDER BY occurred_at,id")).rows;
        assert.equal(repeated.length, 2); assert.equal(Object.hasOwn(repeated[1].details, 'negativeScanRunId'), false);
        assert.equal((await c.pool.query("SELECT count(*)::integer AS count FROM operation_runs WHERE operation_type='import_candidate_execution_planning'")).rows[0].count, 0);
      } });
  });
});

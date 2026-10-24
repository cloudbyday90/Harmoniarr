/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewScanRows } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { advanceBoundedSearch } from '../../testing/integration/bounded-quality-review-search-fixture.js';
import { createQualityReviewSearchService } from '../../src/server/import-candidates/quality-review-search-service.js';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const path = id => `/api/v1/missing-music/decisions/${id}`;
const post = (client, id, key = 'bounded-search') => client.requestJson(`${path(id)}/search-again`, { method: 'POST', json: {}, headers: { 'Idempotency-Key': key } });
const searchAudits = async pool => (await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count;
const runState = async f => (await f.pool.query("SELECT * FROM operation_runs WHERE operation_type='quality_review_search' ORDER BY created_at DESC LIMIT 1")).rows[0];
suite('Bounded quality-review restart through existing operation runs', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('large exhaustion coalesces, yields one bounded window per claim and commits intent/audit/completion once', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f, { weakCount: 600 });
      const response = await post(context.client, f.wantedId); assert.equal(response.response.status, 200, JSON.stringify(response.payload));
      assert.equal(response.payload.action.checkingMatches, true); assert.equal(response.payload.action.searchPreparationStarted, false);
      assert.equal(await searchAudits(f.pool), 0); assert.equal((await runState(f)).summary.progress.steps, 1);
      assert.deepEqual((await post(context.client, f.wantedId)).payload, response.payload);
      assert.equal((await post(context.client, f.wantedId, 'coalesced')).payload.action.checkingMatches, true);
      const detail = (await context.client.requestJson(path(f.wantedId))).payload;
      assert.equal(detail.decision.status.code, 'checking_matches'); assert.equal(detail.permissions.canSearchAgain, false);
      for (let step = 2; step <= 3; step++) {
        await advanceBoundedSearch(f); const run = await runState(f);
        assert.equal(run.status, 'pending', run.error_message); assert.equal(run.summary.progress.steps, step); assert.equal(run.attempt_count, 0);
        assert.equal(await searchAudits(f.pool), 0);
      }
      await advanceBoundedSearch(f); const run = await runState(f); assert.equal(run.status, 'completed'); assert.equal(run.summary.progress.state, 'consumed');
      assert.equal(run.summary.progress.steps, 4); assert.equal(await searchAudits(f.pool), 1);
      assert.equal((await context.client.requestJson(path(f.wantedId))).payload.decision.status.code, 'queued_for_search');
      assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM job_leases WHERE job_type='quality_review_search' AND released_at IS NULL")).rows[0].count, 0);
    });
  });
  test('a new eligible candidate behind saved progress resets the walk and prevents provider intent', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f, { weakCount: 400 });
      assert.equal((await post(context.client, f.wantedId)).payload.action.checkingMatches, true);
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{extensions}','["flac"]') WHERE id='00000000-0000-4000-8000-000000000001'`);
      await advanceBoundedSearch(f); const run = await runState(f);
      assert.equal(run.status, 'completed', run.error_message); assert.equal(run.summary.progress.state, 'found'); assert.equal(run.summary.progress.invalidations, 1);
      assert.equal(await searchAudits(f.pool), 0);
      assert.equal((await context.client.requestJson(path(f.wantedId))).payload.matchChoices[0].id, '00000000-0000-4000-8000-000000000001');
    });
  });
  test('current recipient authority, cancellation and fixed expiry stop queued qualification without intent', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['disabled', 'actor', 'fulfilled', 'cancelled', 'expired']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); await seedQualityReviewScanRows(f);
      await post(context.client, f.wantedId);
      if (drift === 'disabled') await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      if (drift === 'actor') await f.pool.query("UPDATE app_users SET role='requester' WHERE id=$1", [f.admin.id]);
      if (drift === 'fulfilled') await f.pool.query('UPDATE library_wanted_releases SET missing_track_count=0 WHERE id=$1', [f.sibling.wantedId]);
      if (drift === 'cancelled') await f.pool.query("UPDATE operation_runs SET cancel_requested_at=NOW() WHERE operation_type='quality_review_search'");
      if (drift === 'expired') await f.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{progress,expiresAt}','1') WHERE operation_type='quality_review_search'");
      await advanceBoundedSearch(f); assert.equal((await runState(f)).status, drift === 'cancelled' ? 'cancelled' : 'failed'); assert.equal(await searchAudits(f.pool), 0);
    });
  });
  test('current policy resets a saved anchor and a retired lease cannot publish using a replacement acquisition', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f, { weakCount: 400 }); await post(context.client, f.wantedId);
      await f.pool.query("UPDATE app_users SET user_preferences=jsonb_set(user_preferences,'{preferredFormat}','\"alac\"') WHERE id=$1", [f.owner.id]);
      await advanceBoundedSearch(f); const reset = await runState(f);
      assert.equal(reset.status, 'pending', reset.error_message); assert.equal(reset.summary.progress.invalidations, 1);
      assert.equal(reset.summary.progress.anchor, '00000000-0000-4000-8000-000000000200');
      const service = f.libraryModule.libraryMusicQueueRediscoveryService.qualityReviewSearch;
      const oldLease = await service.runStore.acquireLease({ runId: reset.id }); assert.ok(oldLease);
      await service.runStore.releaseLease({ runId: reset.id, expectedLease: oldLease, status: 'paused' });
      const replacement = await service.runStore.acquireLease({ runId: reset.id }); assert.notEqual(replacement.acquisitionId, oldLease.acquisitionId);
      try {
        await assert.rejects(service.executeStep({ runId: reset.id, expectedLease: oldLease }), { code: 'operation_run_lease_lost' });
        assert.equal((await runState(f)).summary.progress.steps, 2); assert.equal(await searchAudits(f.pool), 0);
      } finally { await service.runStore.releaseLease({ runId: reset.id, expectedLease: replacement, status: 'paused' }); }
    });
  });
  test('active-run admission caps total and actor work without creating another check or restart intent', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const cap of ['actor', 'global']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      await f.pool.query(`INSERT INTO operation_runs(operation_type,status,started_at,triggered_by_user_id,summary)
        SELECT 'quality_review_search','pending',NOW(),$1,jsonb_build_object('wantedReleaseId','admission-fixture-'||n)
        FROM generate_series(1,$2::int) n`, [cap === 'actor' ? f.admin.id : f.owner.id, cap === 'actor' ? 2 : 16]);
      const response = await post(context.client, f.wantedId); assert.equal(response.response.status, 429, JSON.stringify(response.payload));
      assert.equal(response.payload.error.code, 'quality_review_search_capacity'); assert.equal(await searchAudits(f.pool), 0);
      assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='quality_review_search'")).rows[0].count, cap === 'actor' ? 2 : 16);
    });
  });
  test('a committed mutation during nonlocking qualification refuses before publishing any empty-search result', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f, { weakCount: 1 });
      const original = f.module.importCandidateQualityReviewScopeService;
      const scope = await original.readScope({ appUserId: f.owner.id, wantedReleaseId: f.wantedId });
      const service = createQualityReviewSearchService({ scopeService: { ...original, scanAlternativeWindow: async (current, options) => {
        const scan = await original.scanAlternativeWindow(current, options);
        await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{extensions}','["flac"]') WHERE id='00000000-0000-4000-8000-000000000001'`);
        return scan;
      } }, commitIntent: async () => assert.fail('A changed revision cannot publish intent'), recordCheckRequested: async () => assert.fail('No incomplete check is accepted') });
      await assert.rejects(service.request({ appUserId: f.owner.id, metadataReleaseId: scope.release.metadataReleaseId,
        intent: { wantedReleaseId: f.wantedId, requestedByUserId: f.admin.id } }), { code: 'quality_review_search_busy' });
      assert.equal(await searchAudits(f.pool), 0); assert.equal(await runState(f), undefined);
    });
  });
  test('required check audit failure rolls back operation-run admission', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      await f.pool.query(`CREATE FUNCTION qualification_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'check audit refused'; END $$;
        CREATE TRIGGER qualification_reject_audit BEFORE INSERT ON audit_events FOR EACH ROW
        WHEN (NEW.event_type='missing_music_match_check_requested') EXECUTE FUNCTION qualification_reject_audit()`);
      assert.equal((await post(context.client, f.wantedId)).response.status, 500);
      assert.equal(await runState(f), undefined); assert.equal(await searchAudits(f.pool), 0);
    });
  });
  test('completion failure rolls back the rediscovery intent and required audit together', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      await post(context.client, f.wantedId);
      const originalDiscovery = (await f.pool.query('SELECT evidence,request_status FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0];
      await f.pool.query(`CREATE FUNCTION qualification_reject_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'owned completion refused'; END $$;
        CREATE TRIGGER qualification_reject_completion BEFORE UPDATE ON operation_runs FOR EACH ROW
        WHEN (NEW.operation_type='quality_review_search' AND NEW.status='completed') EXECUTE FUNCTION qualification_reject_completion()`);
      await advanceBoundedSearch(f); const stopped = await runState(f); assert.equal(stopped.status, 'failed');
      assert.match(stopped.error_message, /owned completion refused/u); assert.equal(await searchAudits(f.pool), 0);
      assert.deepEqual((await f.pool.query('SELECT evidence,request_status FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0], originalDiscovery);
    });
  });
  test('stranded-run recovery preserves bounded progress and resumes with a replacement lease after process loss', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f, { weakCount: 400 }); await post(context.client, f.wantedId);
      const service = f.libraryModule.libraryMusicQueueRediscoveryService.qualityReviewSearch;
      const run = await runState(f); const lease = await service.runStore.acquireLease({ runId: run.id });
      await service.runStore.markRunStarted({ runId: run.id, expectedLease: lease, summary: {} });
      await f.pool.query("UPDATE job_leases SET expires_at=NOW()-INTERVAL '1 second' WHERE lease_key=$1", [lease.leaseKey]);
      const recovery = createOperationStrandedRunRecoveryService({ operationQueueStore: createOperationQueueStore({ getPoolFn: () => f.pool }),
        jobLeaseStore: createJobLeaseStore({ getPoolFn: () => f.pool }) });
      const recovered = await recovery.recoverStrandedRuns({ operationTypes: ['quality_review_search'] });
      assert.equal(recovered.retriedCount, 1); assert.equal((await runState(f)).summary.progress.anchor, run.summary.progress.anchor);
      await advanceBoundedSearch(f); assert.equal((await runState(f)).summary.progress.steps, 2); assert.equal(await searchAudits(f.pool), 0);
      await advanceBoundedSearch(f); assert.equal((await runState(f)).summary.progress.state, 'consumed'); assert.equal(await searchAudits(f.pool), 1);
    });
  });
});

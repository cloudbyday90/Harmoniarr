/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig();
let runtime;
const detailPath = id => `/api/v1/missing-music/decisions/${id}`;
const actionPath = id => `${detailPath(id)}/recheck-library-add`;
async function counts(pool) {
  return (await pool.query(`SELECT (SELECT COUNT(*)::int FROM operation_runs WHERE operation_type='import_candidate_apply') AS runs,
    (SELECT COUNT(*)::int FROM import_candidate_events WHERE event_type='import_candidate_import_blocked') AS events,
    (SELECT COUNT(*)::int FROM audit_events WHERE event_type='import_candidate_import_blocked') AS audits,
    (SELECT COUNT(*)::int FROM source_user_outcome_events) AS outcomes`)).rows[0];
}
suite('Initial quality review through current PostgreSQL and Missing Music HTTP', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('shared refusal survives fresh reads with bounded review guidance, retained bytes and one atomic stop', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); const bytes = await readFile(f.sourcePath);
      assert.equal((await f.start()).started, false);
      assert.equal((await context.client.requestJson(detailPath(f.wantedId))).payload.decision.status.code, 'needs_help_adding');
      for (const wantedId of [f.wantedId, f.sibling.wantedId]) {
        const detail = (await context.client.requestJson(detailPath(wantedId))).payload;
        assert.equal(detail.decision.status.code, 'needs_help_adding');
        assert.equal(detail.libraryAddReview.reasonCode, 'suspicious_lossless');
        assert.equal(detail.decision.status.nextAction, 'review_add_plan'); assert.equal(detail.permissions.canAddToLibrary, false);
        assert.equal(detail.permissions.canRecheckLibraryAdd, false);
        assert.doesNotMatch(JSON.stringify(detail), /private\/provider|raw tool|qualityGate|file\.flac/u);
      }
      assert.equal((await context.client.requestJson(actionPath(f.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'not_available');
      await f.start();
      assert.deepEqual(await counts(f.pool), { runs: 0, events: 1, audits: 1, outcomes: 0 });
      const saved = (await f.pool.query('SELECT status,download_attempt_count FROM import_candidates WHERE id=$1', [f.candidateId])).rows[0];
      assert.deepEqual(saved, { status: 'failed', download_attempt_count: 0 });
      assert.deepEqual(await readFile(f.sourcePath), bytes);
    });
  });

  test('unfinished audio checks expose the existing authenticated recheck and queue only after a fresh passing gate', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); fixture.controls.code = 'safe_auto_spectral_proof_unavailable';
      await f.start();
      let detail = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.equal(detail.libraryAddRecovery.reasonCode, 'audio_check_failed'); assert.equal(detail.permissions.canRecheckLibraryAdd, true);
      await context.client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      assert.equal((await context.client.requestJson(actionPath(f.wantedId), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      const otherClient = createSessionHttpClient(context.baseUrl);
      await loginWithPassword(otherClient, { username: f.owner.username, password: 'InitialPass123!' });
      assert.equal((await otherClient.requestJson(detailPath(f.sibling.wantedId))).response.status, 404);
      assert.equal((await context.client.requestJson(actionPath(f.wantedId), { method: 'POST', json: { candidateId: f.candidateId } })).response.status, 400);
      assert.equal((await context.client.requestJson(actionPath(f.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'still_needs_review');
      // This SQL/HTTP case qualifies acceptance; real tooling and worker bytes have separate packaged coverage.
      fixture.controls.eligible = true;
      const prepared = await f.module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: f.owner.id, wantedReleaseId: f.wantedId });
      assert.equal(prepared.libraryAddRecoveryFacts.recoveryReasonCode, 'audio_check_failed');
      const options = { method: 'POST', json: {}, headers: { 'Idempotency-Key': 'preflight-repaired-audio' } };
      const accepted = (await context.client.requestJson(actionPath(f.wantedId), options)).payload;
      assert.equal(accepted.action.outcome, 'queued'); assert.ok(accepted.action.runId);
      assert.deepEqual((await context.client.requestJson(actionPath(f.wantedId), options)).payload, accepted);
      assert.equal((await context.client.requestJson(actionPath(f.wantedId), { ...options,
        headers: { 'Idempotency-Key': 'preflight-repaired-again' } })).payload.action.outcome, 'already_queued');
      const run = await f.module.importCandidateApplyRunStore.getRunById(accepted.action.runId);
      assert.deepEqual(run.importCandidateIds, [f.candidateId]); assert.equal(run.applySafetyMode, 'safe_auto');
      detail = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.equal(detail.permissions.canRecheckLibraryAdd, false); assert.equal(detail.decision.status.code, 'adding_to_library');
    });
  });

  test('required event and audit rejection roll back the candidate review and preserve original publication failures', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context);
      for (const table of ['import_candidate_events', 'audit_events']) {
        await f.pool.query(`CREATE FUNCTION refuse_preflight_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type='import_candidate_import_blocked' THEN RAISE EXCEPTION 'Controlled preflight rejection'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refuse_preflight_review BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION refuse_preflight_review()`);
        try {
          await assert.rejects(f.start(), /Controlled preflight rejection/u);
          assert.deepEqual(await counts(f.pool), { runs: 0, events: 0, audits: 0, outcomes: 0 });
          assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId })).status, 'import_pending');
        } finally { await f.pool.query(`DROP TRIGGER refuse_preflight_review ON ${table}; DROP FUNCTION refuse_preflight_review()`); }
      }
    });
  });

  test('owner, scope, quality and candidate changes during measurement cannot publish a stale review', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['disabled', 'missing', 'quality', 'source']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context);
      fixture.controls.beforeGateReturns = async () => {
        if (drift === 'disabled') await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.owner.id]);
        if (drift === 'missing') await f.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.wantedId]);
        if (drift === 'quality') await f.pool.query("UPDATE app_users SET user_preferences='{}'::jsonb WHERE id=$1", [f.owner.id]);
        if (drift === 'source') await f.pool.query("UPDATE import_candidates SET source_search_id='newer-search' WHERE id=$1", [f.candidateId]);
      };
      if (drift === 'disabled') await assert.rejects(f.start(), error => error.code === 'missing_music_decision_read_only');
      else assert.equal((await f.start()).started, false);
      assert.deepEqual(await counts(f.pool), { runs: 0, events: 0, audits: 0, outcomes: 0 }, drift);
    });
  });

  test('concurrent measured refusals commit a single transition after shared ownership locks', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); let arrivals = 0; const ready = Promise.withResolvers();
      fixture.controls.beforeGateReturns = () => { if (++arrivals === 2) ready.resolve(); return ready.promise; };
      const results = await Promise.allSettled([f.start(), f.start()]);
      for (const result of results) { assert.equal(result.status, 'fulfilled'); assert.equal(result.value.started, false); }
      assert.deepEqual(await counts(f.pool), { runs: 0, events: 1, audits: 1, outcomes: 0 });
    });
  });
});

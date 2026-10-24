/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { before, after, suite, test } from 'node:test';
import pg from 'pg';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const detailPath = id => `/api/v1/missing-music/decisions/${id}`;
const selectionPath = (wanted, match) => `${detailPath(wanted)}/matches/${match}/select`;
async function select(context, f, candidateId, key = 'review-selection') {
  return context.client.requestJson(selectionPath(f.wantedId, candidateId), {
    method: 'POST', json: {}, headers: { 'Idempotency-Key': key },
  });
}
async function publication(pool) {
  return (await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM import_candidate_events WHERE event_type='import_candidate_selected') AS events,
    (SELECT COUNT(*)::int FROM audit_events WHERE event_type='import_candidate_selected') AS audits,
    (SELECT COUNT(*)::int FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')) AS runs`)).rows[0];
}
suite('Recipient-owned replacement after measured quality review', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('current shared alternatives are bounded, selected atomically and replayed without transfer or consent changes', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const candidate = await seedQualityReviewAlternative(f); const bytes = await readFile(f.sourcePath);
      const weak = await seedQualityReviewAlternative(f, { extension: 'mp3', context: { profileCode: 'any_available', wantedReleaseId: f.wantedId } });
      const detail = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.equal(detail.permissions.canChooseAnotherMatch, true);
      assert.deepEqual(detail.matchChoices.map(choice => choice.id), [candidate.id]);
      assert.doesNotMatch(JSON.stringify(detail), /source-user|folderPath|normalizedPayload/u);
      assert.deepEqual(Object.keys(detail.matchChoices[0]).sort(), ['fileCount', 'formats', 'id', 'totalSizeBytes']);
      assert.notEqual((await select(context, f, weak.id, 'weak')).response.status, 200);
      const response = await select(context, f, candidate.id);
      assert.equal(response.response.status, 200, JSON.stringify(response.payload));
      assert.equal(response.payload.action.downloadStarted, false);
      assert.deepEqual((await select(context, f, candidate.id)).payload, response.payload);
      assert.deepEqual(await publication(f.pool), { events: 1, audits: 1, runs: 0 });
      assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId })).status, 'failed');
      const selected = await f.module.importCandidateService.getImportCandidate({ importCandidateId: candidate.id });
      assert.equal(selected.status, 'selected'); assert.deepEqual(selected.normalizedPayload, candidate.normalizedPayload);
      assert.deepEqual(await readFile(f.sourcePath), bytes);
      const refreshed = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.equal(refreshed.permissions.canChooseAnotherMatch, false); assert.deepEqual(refreshed.matchChoices, []);
      assert.equal(refreshed.decision.status.nextAction, 'download_now'); assert.equal(refreshed.permissions.canStartDownload, true);
    });
  });

  test('requesters select only their own current release and required CSRF remains enforced', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); const candidate = await seedQualityReviewAlternative(f);
      await context.client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      assert.equal((await context.client.requestJson(selectionPath(f.wantedId, candidate.id), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      const owner = createSessionHttpClient(context.baseUrl);
      await loginWithPassword(owner, { username: f.owner.username, password: 'InitialPass123!' });
      assert.equal((await owner.requestJson(selectionPath(f.sibling.wantedId, candidate.id), { method: 'POST', json: {} })).response.status, 404);
      assert.equal((await owner.requestJson(selectionPath(f.wantedId, candidate.id), { method: 'POST', json: {} })).response.status, 200);
      assert.deepEqual(await publication(f.pool), { events: 1, audits: 1, runs: 0 });
    });
  });

  test('current search, participants, candidate policy and active work fail closed after an offered choice', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['search', 'link', 'disabled', 'fulfilled', 'candidate_policy', 'consent', 'scope', 'track_scope', 'active']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); const candidate = await seedQualityReviewAlternative(f);
      assert.equal((await context.client.requestJson(detailPath(f.wantedId))).payload.permissions.canChooseAnotherMatch, true);
      if (drift === 'search') await f.pool.query(`UPDATE library_discovery_requests SET evidence=jsonb_build_object('lastSearchId','newer') WHERE id=$1`, [f.discoveryId]);
      if (drift === 'link') await f.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.sibling.wantedId]);
      if (drift === 'disabled') await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      if (drift === 'fulfilled') await f.pool.query('UPDATE library_wanted_releases SET missing_track_count=0 WHERE id=$1', [f.sibling.wantedId]);
      if (drift === 'candidate_policy') await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,profileCode}','"any_available"') WHERE id=$1`, [candidate.id]);
      if (drift === 'consent') await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,qualityOverride}',$2::jsonb) WHERE id=$1`,
        [candidate.id, JSON.stringify({ mode: 'allow_fallback_quality', wantedReleaseId: f.wantedId })]);
      if (drift === 'scope') await f.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload #- '{musicQueue,wantedReleaseIds}' WHERE id=$1`, [candidate.id]);
      if (drift === 'track_scope') {
        await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,operatorTrackScopes}','[]') WHERE id=$1`, [f.candidateId]);
        const stale = await context.client.requestJson(detailPath(f.wantedId));
        assert.equal(stale.response.status, 200); assert.deepEqual(stale.payload.matchChoices, []);
      }
      if (drift === 'active') await seedQualityReviewAlternative(f).then(other => f.pool.query("UPDATE import_candidates SET status='selected' WHERE id=$1", [other.id]));
      const response = await select(context, f, candidate.id);
      assert.notEqual(response.response.status, 200, drift);
      assert.deepEqual(await publication(f.pool), { events: 0, audits: 0, runs: 0 }, drift);
      assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: candidate.id })).status, 'pending');
    });
  });

  test('event or audit failure rolls back selection and required evidence together', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); const candidate = await seedQualityReviewAlternative(f);
      for (const table of ['import_candidate_events', 'audit_events']) {
        await f.pool.query(`CREATE FUNCTION refuse_review_selection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type='import_candidate_selected' THEN RAISE EXCEPTION 'Controlled selection rejection'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refuse_review_selection BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION refuse_review_selection()`);
        try {
          assert.equal((await select(context, f, candidate.id, table)).response.status, 500);
          assert.deepEqual(await publication(f.pool), { events: 0, audits: 0, runs: 0 });
          assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: candidate.id })).status, 'pending');
        } finally { await f.pool.query(`DROP TRIGGER refuse_review_selection ON ${table}; DROP FUNCTION refuse_review_selection()`); }
      }
    });
  });

  test('concurrent alternatives serialize to one selection with no second active acquisition', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const first = await seedQualityReviewAlternative(f); const second = await seedQualityReviewAlternative(f);
      const responses = await Promise.all([select(context, f, first.id, 'first'), select(context, f, second.id, 'second')]);
      assert.deepEqual(responses.map(r => r.response.status).sort(), [200, 409]);
      assert.deepEqual(await publication(f.pool), { events: 1, audits: 1, runs: 0 });
    });
  });

  test('actual account-lock waits read committed recipient and actor changes before selecting', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['recipient', 'actor']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); const candidate = await seedQualityReviewAlternative(f);
      const lockedUserId = drift === 'recipient' ? f.sibling.id : f.admin.id;
      const blocker = await f.pool.connect(); const observer = new pg.Client(f.pool.options); let pending;
      try {
        await observer.connect();
        await blocker.query('BEGIN');
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await blocker.query('SELECT id FROM app_users WHERE id=$1 FOR NO KEY UPDATE', [lockedUserId]);
        pending = select(context, f, candidate.id, 'account-wait');
        const deadline = Date.now() + 10_000; let observed = false;
        while (Date.now() < deadline) {
          observed = (await observer.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))) AS waiting', [pid])).rows[0].waiting;
          if (observed) break;
          await delay(10);
        }
        assert.equal(observed, true, 'The selection must actually wait on the canonical account lock');
        if (drift === 'recipient') await blocker.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [lockedUserId]);
        else await blocker.query("UPDATE app_users SET role='requester' WHERE id=$1", [lockedUserId]);
        await blocker.query('COMMIT');
        assert.equal((await pending).response.status, 409);
        assert.deepEqual(await publication(f.pool), { events: 0, audits: 0, runs: 0 });
      } finally { await blocker.query('ROLLBACK'); blocker.release(); await observer.end(); await pending; }
    });
  });
});

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const detailPath = id => `/api/v1/missing-music/decisions/${id}`;
const post = (client, id, key = 'review-restart') => client.requestJson(`${detailPath(id)}/search-again`, {
  method: 'POST', json: {}, headers: { 'Idempotency-Key': key },
});
async function audits(pool) { return (await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count; }
const state = async f => (await f.pool.query('SELECT evidence,request_status,search_attempt_count,research_attempt_count FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0];

suite('Recipient-owned Search again after measured quality review', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('own scoped request preserves original quality through actual claim, query and ingestion with replay and queued refresh', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); const bytes = await readFile(f.sourcePath);
      const failed = await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId });
      await f.pool.query(`UPDATE app_users SET user_preferences='{"minimumQuality":"any","preferredFormat":"any"}' WHERE id=ANY($1::uuid[])`, [[f.owner.id, f.sibling.id]]);
      const owner = createSessionHttpClient(context.baseUrl); await loginWithPassword(owner, { username: f.owner.username, password: 'InitialPass123!' });
      assert.equal((await owner.requestJson(detailPath(f.wantedId))).payload.permissions.canSearchAgain, true);
      assert.equal((await post(owner, f.sibling.wantedId, 'foreign')).response.status, 404);
      await context.client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      assert.equal((await owner.requestJson(`${detailPath(f.wantedId)}/search-again`, { method: 'POST', json: {}, csrf: false })).response.status, 403);
      const response = await post(owner, f.wantedId); assert.equal(response.response.status, 200, JSON.stringify(response.payload));
      assert.equal(response.payload.action.searchPreparationStarted, true);
      assert.deepEqual((await post(owner, f.wantedId)).payload, response.payload);
      assert.equal((await post(owner, f.wantedId, 'repeat')).payload.action.restartAlreadyQueued, true); assert.equal(await audits(f.pool), 1);
      const queued = (await owner.requestJson(detailPath(f.wantedId))).payload;
      assert.equal(queued.permissions.canSearchAgain, false); assert.equal(queued.decision.state, 'searching');
      assert.equal(queued.decision.status.code, 'queued_for_search');
      assert.doesNotMatch(JSON.stringify(queued), /qualityReviewRequirement|failedCandidateId|sourceSearchId|wantedReleaseIds/u);
      assert.deepEqual(await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId }), failed);
      assert.deepEqual(await readFile(f.sourcePath), bytes);
      const saved = await state(f); assert.equal(saved.request_status, 'ready'); assert.equal(saved.search_attempt_count, 0);
      const requirement = saved.evidence.musicQueueRediscovery.qualityReviewRequirement;
      assert.equal(requirement.profileCode, 'lossless_archive'); assert.equal(requirement.fallbackAllowed, false);
      assert.equal(requirement.qualityOverride, undefined);
      let query; let ingestion;
      const store = createLibraryDiscoveryRequestStore({ getPoolFn: () => f.pool });
      const dispatch = createLibraryDiscoveryDispatchService({ dispatchBatchSize: 1, loadSettingsFn: async () => ({}),
        libraryDiscoveryRequestStore: store,
        slskdService: { startSearch: async input => { query = input.query; return { id: 'quality-review-new-search' }; } },
        importCandidateService: { ingestSlskdSearchResponses: async input => { ingestion = input; return { candidateCount: 1, fileCount: 1 }; } },
      });
      const result = await dispatch.dispatchReadyDiscoveryRequests();
      assert.equal(result.failedCount, 0); assert.match(query, /FLAC$/u);
      assert.equal(ingestion.musicQueueContext.profileCode, 'lossless_archive'); assert.equal(ingestion.musicQueueContext.qualityOverride, null);
      assert.equal(ingestion.formatPreferences.minimumQuality, 'lossless');
      await store.requestMusicQueueRediscovery({ metadataReleaseId: ingestion.discoveryScope.metadataReleaseId,
        wantedReleaseId: f.wantedId, requestedByUserId: f.owner.id, reasonCode: 'quality_choice_search_again', requestedAt: new Date().toISOString() });
      assert.deepEqual((await state(f)).evidence.musicQueueRediscovery.qualityReviewRequirement, requirement,
        'A later ordinary retry must retain the floor; explicit quality consent has a separate owner');
    });
  });

  test('an eligible alternative beyond the public shortlist and first keyset page prevents restart', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      for (let index = 0; index < 51; index++) {
        const weak = await seedQualityReviewAlternative(f, { extension: 'mp3' });
        await f.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload || '{"compositeScore":100}' WHERE id=$1`, [weak.id]);
      }
      const eligible = await seedQualityReviewAlternative(f);
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload || '{"compositeScore":0}' WHERE id=$1`, [eligible.id]);
      const detail = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.deepEqual(detail.matchChoices, []); assert.equal(detail.permissions.canSearchAgain, false);
      assert.equal((await post(context.client, f.wantedId)).response.status, 409); assert.equal(await audits(f.pool), 0);
      await f.pool.query("UPDATE import_candidates SET status='rejected' WHERE id=$1", [eligible.id]);
      assert.equal((await context.client.requestJson(detailPath(f.wantedId))).payload.permissions.canSearchAgain, true);
      assert.equal((await post(context.client, f.wantedId, 'exhausted')).response.status, 200);
    });
  });

  test('required audit rejection rolls back root intent and recipient marker without dispatch', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); const beforeState = await state(f);
      const links = (await f.pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.wantedId])).rows;
      await f.pool.query(`CREATE FUNCTION refuse_review_search() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='missing_music_search_again_requested' THEN RAISE EXCEPTION 'Controlled restart rejection'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER refuse_review_search BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION refuse_review_search()`);
      try {
        assert.equal((await post(context.client, f.wantedId)).response.status, 500);
        assert.deepEqual(await state(f), beforeState); assert.equal(await audits(f.pool), 0);
        assert.deepEqual((await f.pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.wantedId])).rows, links);
        assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='library_discovery'")).rows[0].count, 0);
      } finally { await f.pool.query('DROP TRIGGER refuse_review_search ON audit_events; DROP FUNCTION refuse_review_search()'); }
    });
  });

  test('two household recipients coalesce one shared intent and retain their own audit markers', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const results = await Promise.all([post(context.client, f.wantedId, 'owner'), post(context.client, f.sibling.wantedId, 'sibling')]);
      for (const response of results) assert.equal(response.response.status, 200, JSON.stringify(response.payload));
      assert.deepEqual(results.map(r => r.payload.action.restartAlreadyQueued).sort(), [false, true]);
      assert.equal(await audits(f.pool), 2);
      const links = (await f.pool.query('SELECT wanted_release_id,evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id=$1', [f.discoveryId])).rows;
      for (const link of links) assert.equal(link.evidence.musicQueueRediscovery.wantedReleaseId, link.wanted_release_id);
    });
  });

  test('current search, participant, active work and stale track scope refuse a previously offered restart', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['search', 'link', 'disabled', 'fulfilled', 'active', 'tracks']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      assert.equal((await context.client.requestJson(detailPath(f.wantedId))).payload.permissions.canSearchAgain, true);
      if (drift === 'search') await f.pool.query(`UPDATE library_discovery_requests SET evidence=jsonb_build_object('lastSearchId','newer') WHERE id=$1`, [f.discoveryId]);
      if (drift === 'link') await f.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.sibling.wantedId]);
      if (drift === 'disabled') await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      if (drift === 'fulfilled') await f.pool.query('UPDATE library_wanted_releases SET missing_track_count=0 WHERE id=$1', [f.sibling.wantedId]);
      if (drift === 'active') { const other = await seedQualityReviewAlternative(f); await f.pool.query("UPDATE import_candidates SET status='selected' WHERE id=$1", [other.id]); }
      if (drift === 'tracks') await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,operatorTrackScopes}','[]') WHERE id=$1`, [f.candidateId]);
      assert.notEqual((await post(context.client, f.wantedId)).response.status, 200, drift); assert.equal(await audits(f.pool), 0, drift);
    });
  });

  test('actual account-lock waits revalidate disabled recipients and revoked actor privileges', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['recipient', 'actor']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const blocker = await f.pool.connect(); const observer = new pg.Client(f.pool.options); let pending;
      try {
        await observer.connect(); await blocker.query('BEGIN');
        const userId = drift === 'recipient' ? f.sibling.id : f.admin.id;
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await blocker.query('SELECT id FROM app_users WHERE id=$1 FOR NO KEY UPDATE', [userId]);
        pending = post(context.client, f.wantedId);
        let waiting = false; const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          waiting = (await observer.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting', [pid])).rows[0].waiting;
          if (waiting) break; await delay(10);
        }
        assert.equal(waiting, true);
        await blocker.query(drift === 'recipient' ? 'UPDATE app_users SET is_disabled=TRUE WHERE id=$1' : "UPDATE app_users SET role='requester' WHERE id=$1", [userId]);
        await blocker.query('COMMIT'); assert.equal((await pending).response.status, 409); assert.equal(await audits(f.pool), 0);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); await observer.end(); await pending; }
    });
  });

  test('post-queue recipient drift and malformed floors block actual claims before provider work without stopping a replacement claim', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const drift of ['fulfilled', 'owner', 'corrupt']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      assert.equal((await post(context.client, f.wantedId)).response.status, 200);
      if (drift === 'fulfilled') await f.pool.query('UPDATE library_wanted_releases SET missing_track_count=0 WHERE id=$1', [f.sibling.wantedId]);
      if (drift === 'owner') await f.pool.query('UPDATE library_wanted_releases SET app_user_id=$2 WHERE id=$1', [f.sibling.wantedId, f.admin.id]);
      if (drift === 'corrupt') await f.pool.query(`UPDATE library_discovery_requests SET evidence=jsonb_set(evidence,'{musicQueueRediscovery,qualityReviewRequirement,minimumBitrateKbps}','-1') WHERE id=$1`, [f.discoveryId]);
      const store = createLibraryDiscoveryRequestStore({ getPoolFn: () => f.pool }); let lastClaim;
      const dispatch = createLibraryDiscoveryDispatchService({ dispatchBatchSize: 1, loadSettingsFn: async () => ({}),
        libraryDiscoveryRequestStore: { ...store, claimNextReadyAutomaticDiscoveryRequest: async input => {
          const claimed = await store.claimNextReadyAutomaticDiscoveryRequest(input); if (claimed) lastClaim = claimed; return claimed;
        } },
        slskdService: { startSearch: async () => assert.fail('Invalid quality scope cannot reach the provider') },
        importCandidateService: { ingestSlskdSearchResponses: async () => assert.fail('Invalid quality scope cannot ingest') },
      });
      assert.equal((await dispatch.dispatchReadyDiscoveryRequests()).failedCount, 1, drift);
      assert.equal((await state(f)).request_status, 'blocked');
      await f.pool.query(`UPDATE library_discovery_requests SET request_status='ready',evidence=jsonb_set(evidence,'{lastDispatchAttemptedAt}','"replacement"') WHERE id=$1`, [f.discoveryId]);
      await store.markDiscoveryRequestQualityReviewBlocked({ claimedRequest: lastClaim });
      assert.equal((await state(f)).request_status, 'ready', 'A stale refusal must not stop a replacement claim');
    });
  });
});

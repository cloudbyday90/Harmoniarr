/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMissingMusicPaginationRows } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { createLibraryDiscoverySearchAuthorityStore } from '../../src/server/library/library-discovery-search-authority-store.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryDiscoverySearchService } from '../../src/server/library/library-discovery-search-service.js';
import { createSlskdSearchContinuationService } from '../../src/server/slskd/slskd-search-continuation-service.js';
import { createSlskdSearchIntentStore } from '../../src/server/slskd/slskd-search-intent-store.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;
const path = (id) => `/api/v1/missing-music/decisions/${id}/search-again`;

async function createRequester(client, pool, username) {
  const result = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'TargetPass123!', role: 'requester' } });
  assert.equal(result.response.status, 201);
  await pool.query('UPDATE app_users SET must_change_password = false WHERE id = $1', [result.payload.user.id]);
  return result.payload.user;
}

async function seedStoppedRelease(pool, appUserId, count = 1) {
  const fixture = await seedMissingMusicPaginationRows({ queryable: pool, appUserId, count });
  const wantedReleaseId = fixture.rows.at(-1).id;
  const result = await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode,
      request_status, blocked_reason, search_attempt_count, research_attempt_count, evidence)
    SELECT metadata_artist_id, metadata_release_group_id, metadata_release_id, 'missing', 'automatic',
      'blocked', 'search_attempts_exhausted', 3, 2, '{"searchExhausted": {"reasonCode":"discovery_search_attempts_exhausted"}}'::jsonb
    FROM library_wanted_releases WHERE id = $1 RETURNING id, metadata_release_id`, [wantedReleaseId]);
  const discovery = result.rows[0];
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id, wanted_release_id) VALUES ($1, $2)', [discovery.id, wantedReleaseId]);
  return { wantedReleaseId, discoveryId: discovery.id, metadataReleaseId: discovery.metadata_release_id };
}

async function shareWantedRelease(pool, original, appUserId) {
  const result = await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id, metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status,
      expected_track_count, matched_track_count, missing_track_count)
    SELECT $2, metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status,
      expected_track_count, matched_track_count, missing_track_count FROM library_wanted_releases WHERE id = $1 RETURNING id`,
  [original.wantedReleaseId, appUserId]);
  const id = result.rows[0].id;
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id, wanted_release_id) VALUES ($1, $2)', [original.discoveryId, id]);
  return id;
}

suite('Missing Music Search again through PostgreSQL sessions and durable intent', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('expired and absent saved searches require explicit intent, preserve replay, and refuse a stale stop', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const authorityStore = createLibraryDiscoverySearchAuthorityStore({ getPoolFn });
      const requestStore = createLibraryDiscoveryRequestStore({ getPoolFn });
      const provider = new Map(); let posts = 0;
      const slskdService = { getSearchBinding: async () => 'a'.repeat(64),
        startSearch: async ({ id, query }) => { posts++; provider.set(id, { id, query }); return provider.get(id); },
        getSearchState: async ({ searchId }) => {
          if (!provider.has(searchId)) throw Object.assign(new Error('Private provider error'), { details: { status: 404 } });
          return provider.get(searchId);
        } };
      for (const code of ['slskd_search_continuation_expired', 'slskd_search_continuation_unavailable']) {
        const original = await seedStoppedRelease(pool, admin.id);
        let now = new Date('2026-10-20T12:00:00Z');
        const marker = '2026-10-20T12:00:00+00:00';
        await pool.query(`UPDATE library_discovery_requests SET request_status='cooldown',blocked_reason='automatic_cooldown',
          search_attempt_count=0,research_attempt_count=0,evidence=$2::jsonb WHERE id=$1`, [original.discoveryId, JSON.stringify({
          lastDispatchAttemptedAt: marker, musicQueueRediscovery: { requestedAt: '2026-10-19T12:00:00Z' },
        })]);
        const claimedRequest = { discoveryRequestId: original.discoveryId, metadataReleaseId: original.metadataReleaseId,
          searchAttemptCount: 0, evidence: { lastDispatchAttemptedAt: marker, musicQueueRediscovery: { requestedAt: '2026-10-19T12:00:00Z' } } };
        const createSearch = () => createLibraryDiscoverySearchService({ authorityStore,
          continuationService: createSlskdSearchContinuationService({ slskdService, getNow: () => now, expiresAfterMs: 1000,
            store: createSlskdSearchIntentStore({ getPoolFn }), withTransaction: createDatabaseTransactionRunner({ getPoolFn }) }) });
        const input = { claimedRequest, query: 'Artist Album', context: { purpose: 'album' }, assertCurrent: async () => {} };
        const first = await createSearch().startSearch(input);
        if (code.endsWith('_expired')) now = new Date(now.getTime() + 1001);
        else provider.delete(first.id);
        await assert.rejects(createSearch().startSearch(input), error => error.code === code);
        assert.equal(await authorityStore.stopContinuation({ claimedRequest, errorCode: code }), true);
        const stopped = (await pool.query('SELECT * FROM library_discovery_requests WHERE id=$1', [original.discoveryId])).rows[0];
        assert.equal(stopped.request_status, 'blocked'); assert.equal(stopped.next_search_after, null);
        assert.equal(stopped.search_attempt_count, 0); assert.equal(stopped.evidence.searchContinuation, undefined);
        assert.equal(await requestStore.claimNextReadyAutomaticDiscoveryRequest({ dispatchedAt: now.toISOString(), nextSearchAfter: now.toISOString() }), null);
        const detail = await client.requestJson(`/api/v1/missing-music/decisions/${original.wantedReleaseId}`);
        assert.equal(detail.payload.permissions.canSearchAgain, true);
        assert.match(detail.payload.decision.status.message, /Choose Search again/);
        assert.equal(detail.payload.decision.state, 'action');
        assert.doesNotMatch(JSON.stringify(detail.payload), /Private provider|providerFingerprint|lastDispatchAttemptedAt/);
        const beforePosts = posts;
        const request = () => client.requestJson(path(original.wantedReleaseId), { method: 'POST', headers: { 'idempotency-key': code } });
        const accepted = await request(); assert.equal(accepted.response.status, 200, JSON.stringify(accepted.payload));
        assert.deepEqual((await request()).payload, accepted.payload);
        const reset = (await pool.query('SELECT * FROM library_discovery_requests WHERE id=$1', [original.discoveryId])).rows[0];
        assert.equal(reset.request_status, 'ready'); assert.equal(reset.evidence.lastDispatchFailure, undefined);
        assert.equal(reset.evidence.lastDispatchAttemptedAt, undefined);
        assert.equal(await authorityStore.stopContinuation({ claimedRequest, errorCode: code }), false);
        assert.equal(posts, beforePosts, 'The command queues intent without submitting provider work');
        const current = await requestStore.claimNextReadyAutomaticDiscoveryRequest({ dispatchedAt: new Date().toISOString(), nextSearchAfter: new Date(Date.now() + 3600_000).toISOString() });
        const renewed = await createSearch().startSearch({ ...input, claimedRequest: current });
        assert.notEqual(renewed.id, first.id);
        assert.equal(posts, beforePosts + 1);
        assert.equal((await createSearch().startSearch({ ...input, claimedRequest: current })).id, renewed.id);
        assert.equal(posts, beforePosts + 1, 'Reading the new reservation must not submit again');
        assert.equal((await pool.query('SELECT count(*)::int AS count FROM slskd_search_intents WHERE discovery_request_id=$1', [original.discoveryId])).rows[0].count, 2);
        // Retire this controlled request so the next case owns the only eligible claim.
        await pool.query("UPDATE library_discovery_requests SET request_status='blocked',next_search_after=NULL WHERE id=$1", [original.discoveryId]);
      }
      assert.equal(posts, 4);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count, 2);
    }, { scenarioName: 'missing_music_continuation_recovery' });
  });

  test('administrator search addresses a recipient beyond 500 rows and replay retains only that target intent', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      const pool = getPoolFn();
      const admin = (await bootstrapAdminSession(client)).payload.user;
      assert.equal((await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } })).response.status, 200);
      const recipient = await createRequester(client, pool, 'search-recipient');
      const sibling = await createRequester(client, pool, 'search-sibling');
      const original = await seedStoppedRelease(pool, recipient.id, 505);
      const siblingWantedId = await shareWantedRelease(pool, original, sibling.id);
      const outsider = createSessionHttpClient(baseUrl);
      await loginWithPassword(outsider, { username: sibling.username, password: 'TargetPass123!' });
      assert.equal((await outsider.requestJson(path(original.wantedReleaseId), { method: 'POST' })).response.status, 404);
      assert.equal((await client.requestJson(path(original.wantedReleaseId), { method: 'POST', csrf: false })).response.status, 403);
      await pool.query('UPDATE app_users SET must_change_password = true WHERE id = $1', [admin.id]);
      assert.equal((await client.requestJson(path(original.wantedReleaseId), { method: 'POST' })).payload.error.code, 'reauth_required');
      await pool.query('UPDATE app_users SET must_change_password = false WHERE id = $1', [admin.id]);
      const detail = await client.requestJson(`/api/v1/missing-music/decisions/${original.wantedReleaseId}`);
      assert.equal(detail.payload.permissions.canSearchAgain, true);
      const request = () => client.requestJson(path(original.wantedReleaseId), { method: 'POST', headers: { 'idempotency-key': 'owned-search' } });
      const first = await request();
      assert.equal(first.response.status, 200, JSON.stringify(first.payload));
      assert.deepEqual(Object.keys(first.payload).sort(), ['action', 'ok']);
      assert.equal(first.payload.action.targetUserId, recipient.id);
      assert.equal(first.payload.action.searchPreparationStarted, true);
      assert.ok(first.payload.action.discoveryRunId);
      assert.deepEqual((await request()).payload, first.payload);
      const repeated = await client.requestJson(path(original.wantedReleaseId), { method: 'POST', headers: { 'idempotency-key': 'owned-search-second' } });
      assert.equal(repeated.response.status, 200, JSON.stringify(repeated.payload));
      assert.equal(repeated.payload.action.restartAlreadyQueued, true);
      const links = (await pool.query('SELECT wanted_release_id, evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id = $1', [original.discoveryId])).rows;
      assert.equal(links.find((row) => row.wanted_release_id === original.wantedReleaseId).evidence.musicQueueRediscovery.requestedByUserId, admin.id);
      assert.equal(links.find((row) => row.wanted_release_id === siblingWantedId).evidence.musicQueueRediscovery, undefined);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_search_again_requested'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'library_discovery_dispatch'")).rows[0].count, 1);
      assert.equal((await client.requestJson(`/api/v1/missing-music/decisions/${original.wantedReleaseId}`)).payload.permissions.canSearchAgain, false);
    }, { scenarioName: 'missing_music_owned_search' });
  });

  test('current disabled, maintenance, missing-link, and active-state decisions refuse durable writes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const recipient = await createRequester(client, pool, 'search-refusal');
      const original = await seedStoppedRelease(pool, recipient.id);
      const request = () => client.requestJson(path(original.wantedReleaseId), { method: 'POST' });
      await pool.query('UPDATE app_users SET is_disabled = true WHERE id = $1', [recipient.id]);
      assert.equal((await request()).payload.error.code, 'missing_music_decision_read_only');
      await pool.query('UPDATE app_users SET is_disabled = false WHERE id = $1', [recipient.id]);
      const lock = await pool.query("INSERT INTO maintenance_locks (lock_type, status, reason, acquired_at) VALUES ('maintenance', 'active', 'Synthetic test', NOW()) RETURNING id");
      assert.equal((await request()).payload.error.code, 'recovery_lock_conflict');
      await pool.query('DELETE FROM maintenance_locks WHERE id = $1', [lock.rows[0].id]);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'cooldown', blocked_reason = 'automatic_cooldown' WHERE id = $1", [original.discoveryId]);
      assert.equal((await request()).payload.error.code, 'music_queue_retry_not_available');
      await pool.query("UPDATE library_discovery_requests SET request_status = 'blocked', blocked_reason = 'search_attempts_exhausted' WHERE id = $1", [original.discoveryId]);
      await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId]);
      assert.equal((await request()).payload.error.code, 'missing_music_decision_not_found');
      assert.equal((await pool.query('SELECT evidence FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0].evidence.musicQueueRediscovery, undefined);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_search_again_requested'")).rows[0].count, 0);
    }, { scenarioName: 'missing_music_search_refusals' });
  });

  test('simultaneous shared targets coalesce one discovery run and retain separate current-cycle retry markers', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const firstUser = await createRequester(client, pool, 'search-first');
      const secondUser = await createRequester(client, pool, 'search-second');
      const original = await seedStoppedRelease(pool, firstUser.id);
      const secondId = await shareWantedRelease(pool, original, secondUser.id);
      const firstClient = createSessionHttpClient(baseUrl);
      const secondClient = createSessionHttpClient(baseUrl);
      await loginWithPassword(firstClient, { username: firstUser.username, password: 'TargetPass123!' });
      await loginWithPassword(secondClient, { username: secondUser.username, password: 'TargetPass123!' });
      const results = await Promise.all([
        firstClient.requestJson(path(original.wantedReleaseId), { method: 'POST' }),
        secondClient.requestJson(path(secondId), { method: 'POST' }),
      ]);
      assert.ok(results.every((result) => result.response.status === 200), JSON.stringify(results.map((result) => result.payload)));
      assert.equal(results.filter((result) => result.payload.action.restartAlreadyQueued).length, 1);
      let markers = (await pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id = $1', [original.discoveryId])).rows;
      assert.equal(markers.length, 2);
      assert.ok(markers.every((row) => row.evidence.musicQueueRediscovery));
      assert.equal(markers[0].evidence.musicQueueRediscovery.requestedAt, markers[1].evidence.musicQueueRediscovery.requestedAt);
      const oldTime = markers[0].evidence.musicQueueRediscovery.requestedAt;
      await pool.query(`UPDATE library_discovery_requests SET request_status = 'blocked', blocked_reason = 'search_attempts_exhausted',
        search_attempt_count = 3, evidence = evidence || '{"searchExhausted":{"reasonCode":"discovery_search_attempts_exhausted"}}'::jsonb WHERE id = $1`, [original.discoveryId]);
      const nextFirst = await firstClient.requestJson(path(original.wantedReleaseId), { method: 'POST' });
      assert.equal(nextFirst.response.status, 200, JSON.stringify(nextFirst.payload));
      const nextSecond = await secondClient.requestJson(path(secondId), { method: 'POST' });
      assert.equal(nextSecond.response.status, 200, JSON.stringify(nextSecond.payload));
      markers = (await pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id = $1', [original.discoveryId])).rows;
      assert.notEqual(markers[0].evidence.musicQueueRediscovery.requestedAt, oldTime);
      assert.equal(markers[0].evidence.musicQueueRediscovery.requestedAt, markers[1].evidence.musicQueueRediscovery.requestedAt);
    }, { scenarioName: 'missing_music_shared_search' });
  });
});

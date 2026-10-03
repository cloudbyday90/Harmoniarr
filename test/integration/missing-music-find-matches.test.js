/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryDiscoveryRunStore } from '../../src/server/library/library-discovery-run-store.js';
import { createLibraryDiscoveryRunService } from '../../src/server/library/library-discovery-run-service.js';
import { createLibraryInitialSearchService } from '../../src/server/library/library-initial-search-service.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createLibraryMusicQueueRediscoveryStore } from '../../src/server/library/library-music-queue-rediscovery-store.js';
import { createMissingMusicFindMatchesService } from '../../src/server/missing-music/missing-music-find-matches-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMissingMusicPaginationRows } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const actionPath = (id) => `/api/v1/missing-music/decisions/${id}/find-matches`;
const detailPath = (id) => `/api/v1/missing-music/decisions/${id}`;
let runtime;
let unavailableReason;

async function createUser(client, pool, username) {
  const response = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'InitialPass123!', role: 'requester' } });
  assert.equal(response.response.status, 201);
  await pool.query('UPDATE app_users SET must_change_password = false WHERE id = $1', [response.payload.user.id]);
  return response.payload.user;
}
async function seedReady(pool, userId, count = 1) {
  const fixture = await seedMissingMusicPaginationRows({ queryable: pool, appUserId: userId, count });
  const wantedReleaseId = fixture.rows.at(-1).id;
  const result = await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode, request_status)
    SELECT metadata_artist_id, metadata_release_group_id, metadata_release_id, 'missing', 'automatic', 'ready'
    FROM library_wanted_releases WHERE id = $1 RETURNING id, metadata_release_id`, [wantedReleaseId]);
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id, wanted_release_id) VALUES ($1, $2)', [result.rows[0].id, wantedReleaseId]);
  return { wantedReleaseId, discoveryId: result.rows[0].id, metadataReleaseId: result.rows[0].metadata_release_id };
}
async function addRecipient(pool, original, userId) {
  const result = await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id, metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, expected_track_count, matched_track_count, missing_track_count)
    SELECT $2, metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, expected_track_count, matched_track_count, missing_track_count
    FROM library_wanted_releases WHERE id = $1 RETURNING id`, [original.wantedReleaseId, userId]);
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id, wanted_release_id) VALUES ($1, $2)', [original.discoveryId, result.rows[0].id]);
  return result.rows[0].id;
}
function createGuard(pool, overrides = {}) {
  const lockService = createMaintenanceLockService({ getPoolFn: () => pool });
  return createLibraryInitialSearchService({ getAppUserById: createAppUserService({ getPoolFn: () => pool }).getAppUserById,
    listWantedReleasesWithMetadata: createLibraryWantedReleaseStore({ getPoolFn: () => pool }).listWantedReleasesWithMetadata,
    assertMaintenanceWriteAllowed: createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: lockService.listActiveMaintenanceLocks }).assertNoActiveWriteLocks,
    withTransaction: createDatabaseTransactionRunner({ getPoolFn: () => pool }), ...overrides });
}
const intentArgs = (original, owner, actor) => ({ appUserId: owner.id, metadataReleaseId: original.metadataReleaseId,
  wantedReleaseId: original.wantedReleaseId, requestedByUserId: actor.id });

suite('Missing Music Find matches through PostgreSQL ownership, first-search evidence and dispatch coalescing', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('default action pagination finds an initial recipient beyond 500 rows; auth, replay and saved no-op retain bounded scoped truth', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, baseUrl, getPoolFn }) => {
      const pool = getPoolFn();
      const admin = (await bootstrapAdminSession(client)).payload.user;
      await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      const owner = await createUser(client, pool, 'initial-owner');
      const other = await createUser(client, pool, 'initial-other');
      const original = await seedReady(pool, owner.id, 505);
      const otherWanted = await addRecipient(pool, original, other.id);
      const outsider = createSessionHttpClient(baseUrl);
      await loginWithPassword(outsider, { username: other.username, password: 'InitialPass123!' });
      assert.equal((await outsider.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} })).response.status, 404);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: { targetUserId: other.id } })).response.status, 400);
      await pool.query('UPDATE app_users SET must_change_password = true WHERE id = $1', [admin.id]);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} })).payload.error.code, 'reauth_required');
      await pool.query('UPDATE app_users SET must_change_password = false WHERE id = $1', [admin.id]);
      const beforeDetail = await client.requestJson(detailPath(original.wantedReleaseId));
      assert.equal(beforeDetail.payload.permissions.canFindMatches, true);
      assert.equal(beforeDetail.payload.decision.state, 'action');
      let page = await client.requestJson(`/api/v1/missing-music/decisions?state=action&scope=all&requestedForUserId=${owner.id}`);
      while (!page.payload.decisions.length && page.payload.page.nextCursor) {
        page = await client.requestJson(`/api/v1/missing-music/decisions?state=action&scope=all&requestedForUserId=${owner.id}&cursor=${encodeURIComponent(page.payload.page.nextCursor)}`);
      }
      assert.ok(page.payload.decisions.some((decision) => decision.decisionId === original.wantedReleaseId));
      const post = () => client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {}, headers: { 'idempotency-key': 'initial-owned' } });
      const first = await post();
      assert.equal(first.response.status, 200, JSON.stringify(first.payload));
      assert.equal(first.payload.action.targetUserId, owner.id);
      assert.equal(first.payload.action.searchAlreadyQueued, true);
      assert.equal(first.payload.action.intentAlreadyRecorded, false);
      assert.equal(first.payload.action.searchPreparationStarted, true);
      assert.deepEqual((await post()).payload.action, first.payload.action);
      const again = await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      assert.equal(again.payload.action.intentAlreadyRecorded, true);
      assert.equal(again.payload.action.searchPreparationStarted, false);
      const afterDetail = await client.requestJson(detailPath(original.wantedReleaseId));
      assert.equal(afterDetail.payload.permissions.canFindMatches, false);
      assert.equal(afterDetail.payload.decision.state, 'searching');
      assert.equal(afterDetail.payload.decision.status.nextAction, null);
      const afterPage = await client.requestJson(`/api/v1/missing-music/decisions?state=action&scope=all&requestedForUserId=${owner.id}`);
      assert.equal(afterPage.payload.decisions.length, 0);
      const links = (await pool.query('SELECT wanted_release_id, evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id = $1', [original.discoveryId])).rows;
      assert.equal(links.find((row) => row.wanted_release_id === original.wantedReleaseId).evidence.musicQueueInitialSearch.requestedByUserId, admin.id);
      assert.equal(links.find((row) => row.wanted_release_id === otherWanted).evidence.musicQueueInitialSearch, undefined);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'cooldown', last_search_at = NOW(), blocked_reason = 'automatic_cooldown' WHERE id = $1", [original.discoveryId]);
      const historical = await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      assert.equal(historical.payload.action.searchAlreadyQueued, false);
      assert.equal(historical.payload.action.searchPreparationStarted, false);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_initial_search_requested'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'library_discovery_dispatch'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_initial_scope' });
  });

  test('concurrent recipients save independent intent without changing shared queue and create one immediate dispatch', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, baseUrl, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const first = await createUser(client, pool, 'initial-first');
      const second = await createUser(client, pool, 'initial-second');
      const original = await seedReady(pool, first.id);
      const secondWanted = await addRecipient(pool, original, second.id);
      const beforeRequest = (await pool.query('SELECT * FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0];
      const clients = [createSessionHttpClient(baseUrl), createSessionHttpClient(baseUrl)];
      await Promise.all(clients.map((sessionClient, index) => loginWithPassword(sessionClient, { username: [first, second][index].username, password: 'InitialPass123!' })));
      const responses = await Promise.all(clients.map((sessionClient, index) => sessionClient.requestJson(actionPath([original.wantedReleaseId, secondWanted][index]), { method: 'POST', json: {} })));
      assert.ok(responses.every((response) => response.response.status === 200), JSON.stringify(responses.map((response) => response.payload)));
      assert.equal(responses.filter((response) => response.payload.action.dispatchAlreadyActive).length, 1);
      assert.deepEqual((await pool.query('SELECT * FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0], beforeRequest);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'library_discovery_dispatch' AND status = 'pending'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_initial_search_requested'")).rows[0].count, 2);
    }, { scenarioName: 'missing_music_initial_concurrency' });
  });

  test('current disabled, maintenance, future, manual, historical, candidate and missing-link states refuse writes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'initial-refused');
      const original = await seedReady(pool, owner.id);
      const post = () => client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      await pool.query('UPDATE app_users SET is_disabled = true WHERE id = $1', [owner.id]);
      assert.equal((await post()).payload.error.code, 'missing_music_decision_read_only');
      await pool.query('UPDATE app_users SET is_disabled = false WHERE id = $1', [owner.id]);
      const lock = await pool.query("INSERT INTO maintenance_locks (lock_type, status, reason, acquired_at) VALUES ('maintenance', 'active', 'Controlled initial refusal', NOW()) RETURNING id");
      assert.equal((await post()).payload.error.code, 'recovery_lock_conflict');
      await pool.query('DELETE FROM maintenance_locks WHERE id = $1', [lock.rows[0].id]);
      for (const update of ["search_mode = 'manual'", 'search_attempt_count = 1', 'research_attempt_count = 1', 'last_search_at = NOW()',
        "next_search_after = NOW() + INTERVAL '1 day'", "blocked_reason = 'release_date_pending'", "evidence = '{\"lastSearchResult\":{}}'::jsonb"]) {
        await pool.query(`UPDATE library_discovery_requests SET ${update} WHERE id = $1`, [original.discoveryId]);
        assert.equal((await post()).response.status, 409);
        await pool.query("UPDATE library_discovery_requests SET search_mode = 'automatic', search_attempt_count = 0, research_attempt_count = 0, last_search_at = NULL, next_search_after = NULL, blocked_reason = NULL, evidence = '{}'::jsonb WHERE id = $1", [original.discoveryId]);
      }
      await pool.query("UPDATE library_wanted_releases SET release_date = CURRENT_DATE + INTERVAL '1 day' WHERE id = $1", [original.wantedReleaseId]);
      assert.equal((await post()).response.status, 409);
      await pool.query('UPDATE library_wanted_releases SET release_date = NULL WHERE id = $1', [original.wantedReleaseId]);
      await pool.query(`INSERT INTO import_candidates (source_provider, source_search_id, source_response_key, username, folder_path, candidate_type, raw_payload, normalized_payload, discovered_at)
        VALUES ('slskd', 'orphan-initial-search', 'controlled-orphan', 'controlled', 'controlled', 'manual_search', '{}'::jsonb, jsonb_build_object('discoveryScope', jsonb_build_object('metadataReleaseId', $1::text)), NOW())`, [original.metadataReleaseId]);
      assert.equal((await client.requestJson(detailPath(original.wantedReleaseId))).payload.permissions.canFindMatches, false);
      assert.equal((await post()).response.status, 409);
      await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId]);
      assert.equal((await post()).response.status, 404);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_initial_search_requested'")).rows[0].count, 0);
    }, { scenarioName: 'missing_music_initial_refusals' });
  });

  test('required audits roll back intent and dispatcher creation; post-commit failure leaves accepted ready work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'initial-atomic');
      const original = await seedReady(pool, owner.id);
      const failure = async () => { throw new Error('Controlled required audit failure'); };
      await assert.rejects(createGuard(pool, { recordAuditEventFn: failure }).requestInitialMusicSearch(intentArgs(original, owner, admin)), /Controlled required audit/);
      assert.equal((await pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId])).rows[0].evidence.musicQueueInitialSearch, undefined);
      const runStore = createLibraryDiscoveryRunStore({ getPoolFn: () => pool });
      const runService = createLibraryDiscoveryRunService({ createOperationRun: runStore.createOperationRun, getActiveRun: runStore.getActiveRun,
        recordAuditEventFn: failure, withTransaction: createDatabaseTransactionRunner({ getPoolFn: () => pool }) });
      await assert.rejects(runService.startLibraryDiscoveryRun({ triggeredByUserId: admin.id }), /Controlled required audit/);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'library_discovery_dispatch'")).rows[0].count, 0);
      const service = createMissingMusicFindMatchesService({ requestInitialMusicSearch: createGuard(pool).requestInitialMusicSearch,
        resolveMissingMusicDecisionTarget: async () => ({ decisionId: original.wantedReleaseId, targetUser: { id: owner.id, isDisabled: false }, release: { metadataReleaseId: original.metadataReleaseId } }),
        startLibraryDiscoveryRun: async () => { throw new Error('Controlled post-commit dispatch failure'); } });
      const accepted = await service.findMissingMusicDecisionMatches({ actorUser: admin, decisionId: original.wantedReleaseId });
      assert.equal(accepted.action.searchPreparationStarted, true);
      assert.equal(accepted.action.searchAlreadyQueued, true);
      assert.equal(accepted.action.discoveryRunId, null);
    }, { scenarioName: 'missing_music_initial_atomicity' });
  });

  test('worker-first refuses new initial intent; intent-first serializes against the real claim and persists its scoped audit', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'initial-race');
      const first = await seedReady(pool, owner.id);
      const requestStore = createLibraryDiscoveryRequestStore({ getPoolFn: () => pool });
      const claim = () => requestStore.claimNextReadyAutomaticDiscoveryRequest({ dispatchedAt: new Date().toISOString(), nextSearchAfter: new Date(Date.now() + 60_000).toISOString() });
      assert.equal((await claim()).metadataReleaseId, first.metadataReleaseId);
      await assert.rejects(createGuard(pool).requestInitialMusicSearch(intentArgs(first, owner, admin)), { code: 'missing_music_initial_search_not_available' });
      await pool.query("UPDATE library_discovery_requests SET request_status = 'ready', blocked_reason = NULL, last_search_at = NULL, next_search_after = NULL, evidence = '{}'::jsonb WHERE id = $1", [first.discoveryId]);
      let locksAcquired;
      let releaseLocks;
      const acquired = new Promise((resolve) => { locksAcquired = resolve; });
      const held = new Promise((resolve) => { releaseLocks = resolve; });
      const owned = createLibraryMusicQueueRediscoveryStore();
      const guard = createGuard(pool, { ownedReleaseStore: { lockOwnedWantedRelease: async (input) => {
        const result = await owned.lockOwnedWantedRelease(input); locksAcquired(); await held; return result;
      } } });
      const saving = guard.requestInitialMusicSearch(intentArgs(first, owner, admin));
      await acquired;
      const skipped = await claim();
      assert.equal(skipped, null); // SKIP LOCKED cannot claim the held request.
      releaseLocks();
      assert.equal((await saving).intentAlreadyRecorded, false);
      assert.equal((await claim()).metadataReleaseId, first.metadataReleaseId);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_initial_search_requested'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_initial_worker_race' });
  });
});

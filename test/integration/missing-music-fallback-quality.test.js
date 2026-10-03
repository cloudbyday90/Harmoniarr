/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { createAcquisitionPipelineService } from '../../src/server/acquisition/acquisition-pipeline-service.js';
import { createAcquisitionPipelineStore } from '../../src/server/acquisition/acquisition-pipeline-store.js';
import { createAcquisitionQualityPolicyService } from '../../src/server/acquisition/acquisition-quality-policy-service.js';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidateAutoSelectionService } from '../../src/server/import-candidates/import-candidate-auto-selection-service.js';
import { createImportCandidateRecoveryService } from '../../src/server/import-candidates/import-candidate-recovery-service.js';
import { findNextCandidateForRecovery, getImportCandidateById, incrementImportCandidateDownloadAttemptCount,
  promoteImportCandidateForRecovery } from '../../src/server/import-candidates/import-candidate-repository.js';
import { buildStageCandidateBase } from '../../src/server/import-candidates/import-candidate-stage-summary.js';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryFallbackQualityService } from '../../src/server/library/library-fallback-quality-service.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMissingMusicPaginationRows } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const strictPreferences = { minimumQuality: 'lossless', preferredFormat: 'flac' };
const actionPath = (id) => `/api/v1/missing-music/decisions/${id}/allow-fallback-quality`;
const detailPath = (id) => `/api/v1/missing-music/decisions/${id}`;
let runtime;
let unavailableReason;

async function createUser(client, pool, username, preferences = strictPreferences) {
  const response = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'QualityPass123!', role: 'requester' } });
  assert.equal(response.response.status, 201, JSON.stringify(response.payload));
  await pool.query('UPDATE app_users SET must_change_password = false, user_preferences = $2::jsonb WHERE id = $1', [response.payload.user.id, JSON.stringify(preferences)]);
  return response.payload.user;
}

async function seedReadyRelease(pool, userId) {
  const fixture = await seedMissingMusicPaginationRows({ queryable: pool, appUserId: userId, titlePrefix: 'Quality release' });
  const wantedReleaseId = fixture.rows[0].id;
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

async function runWorkerSearch(pool, { bitrate = 256, extension = 'mp3' } = {}) {
  const searchId = randomUUID();
  let observedInput;
  const slskdService = { startSearch: async ({ query }) => ({ id: searchId, query }), getSearchResponses: async () => ({ searchId, responses: [{
    username: 'controlled-quality-source', hasFreeUploadSlot: true, queueLength: 0, uploadSpeed: 1_000_000,
    files: [{ filename: `Quality release\\01 Track.${extension}`, size: 5_000_000, bitRate: bitrate, length: 180, sampleRate: 44100 }],
  }] }) };
  const importService = createImportCandidateService({ pool, slskdService, loadSettingsFn: async () => ({}),
    scoreDownloadResultFn: () => ({ compositeScore: 95, breakdown: {} }) });
  const selectionService = createImportCandidateAutoSelectionService({ listImportCandidates: importService.listImportCandidates,
    selectImportCandidate: importService.selectImportCandidate, qualityPolicyService: createAcquisitionQualityPolicyService() });
  const discoveryService = createLibraryDiscoveryDispatchService({ loadSettingsFn: async () => ({ library: { discoveryBatchSize: 1 } }),
    libraryDiscoveryRequestStore: createLibraryDiscoveryRequestStore({ getPoolFn: () => pool }), slskdService,
    importCandidateAutoSelectionService: selectionService,
    importCandidateService: { ingestSlskdSearchResponses: async (input) => { observedInput = input; return importService.ingestSlskdSearchResponses(input); } } });
  const result = await discoveryService.dispatchReadyDiscoveryRequests();
  assert.equal(result.failedCount, 0, JSON.stringify(result));
  assert.equal(result.dispatchedCount, 1);
  return { input: observedInput, result, searchId };
}

function createGuard(pool, overrides = {}) {
  const store = createLibraryWantedReleaseStore({ getPoolFn: () => pool });
  const maintenance = createMaintenanceLockService({ getPoolFn: () => pool });
  const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
  return createLibraryFallbackQualityService({ allowMusicQueueFallbackQuality: createLibraryDiscoveryRequestStore({ getPoolFn: () => pool }).allowMusicQueueFallbackQuality,
    assertMaintenanceWriteAllowed: guard.assertNoActiveWriteLocks, getAppUserById: createAppUserService({ getPoolFn: () => pool }).getAppUserById,
    listWantedReleasesWithMetadata: store.listWantedReleasesWithMetadata, ...overrides });
}

suite('Missing Music quality fallback through PostgreSQL ownership and actual worker consumers', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('real worker below-minimum evidence enables scoped consent, replay and terminal no-op without leaking provider evidence', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      const pool = getPoolFn();
      const admin = (await bootstrapAdminSession(client)).payload.user;
      assert.equal((await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } })).response.status, 200);
      const target = await createUser(client, pool, 'quality-target');
      const sibling = await createUser(client, pool, 'quality-outsider');
      const original = await seedReadyRelease(pool, target.id);
      const initial = await runWorkerSearch(pool);
      assert.equal(initial.result.dispatchedSearches[0].autoSelection.skippedReason, 'quality_below_minimum');
      const detail = await client.requestJson(detailPath(original.wantedReleaseId));
      assert.equal(detail.payload.decision.status.code, 'quality_choice_needed');
      assert.equal(detail.payload.qualityEvidence.bitrateKbps, 256);
      assert.equal(detail.payload.permissions.canAllowFallbackQuality, true);
      assert.doesNotMatch(JSON.stringify(detail.payload), /controlled-quality-source|Quality release\\|allowedByUserId|explanation/);
      const outsider = createSessionHttpClient(baseUrl);
      await loginWithPassword(outsider, { username: sibling.username, password: 'QualityPass123!' });
      assert.equal((await outsider.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} })).response.status, 404);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: { targetUserId: sibling.id } })).response.status, 400);
      await pool.query('UPDATE app_users SET must_change_password = true WHERE id = $1', [admin.id]);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} })).payload.error.code, 'reauth_required');
      await pool.query('UPDATE app_users SET must_change_password = false WHERE id = $1', [admin.id]);
      const request = () => client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {}, headers: { 'idempotency-key': 'quality-owned-choice' } });
      const first = await request();
      assert.equal(first.response.status, 200, JSON.stringify(first.payload));
      assert.equal(first.payload.action.targetUserId, target.id);
      assert.equal(first.payload.action.searchPreparationStarted, true);
      assert.deepEqual(Object.keys(first.payload).sort(), ['action', 'ok']);
      assert.deepEqual((await request()).payload, first.payload);
      const repeat = await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      assert.equal(repeat.payload.action.overrideAlreadyAllowed, true);
      assert.equal(repeat.payload.action.restartAlreadyQueued, true);
      const refreshed = await client.requestJson(detailPath(original.wantedReleaseId));
      assert.equal(refreshed.payload.decision.status.code, 'queued_for_search');
      assert.equal(refreshed.payload.qualityEvidence.fallbackOverrideActive, true);
      assert.equal(refreshed.payload.permissions.canAllowFallbackQuality, false);
      const marker = (await pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId])).rows[0].evidence;
      assert.equal(marker.musicQueueQualityOverride.allowedByUserId, admin.id);
      assert.equal(marker.musicQueueQualityOverride.wantedReleaseId, original.wantedReleaseId);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'blocked', blocked_reason = 'search_attempts_exhausted' WHERE id = $1", [original.discoveryId]);
      const terminal = await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      assert.equal(terminal.payload.action.overrideAlreadyAllowed, true);
      assert.equal(terminal.payload.action.searchPreparationStarted, false);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_fallback_quality_allowed'")).rows[0].count, 1);
      assert.equal((await pool.query('SELECT request_status FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0].request_status, 'blocked');
    }, { scenarioName: 'missing_music_fallback_owned' });
  });

  test('disabled, maintenance, verification, active-candidate and missing-link states refuse fallback writes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const target = await createUser(client, pool, 'quality-refusals');
      const original = await seedReadyRelease(pool, target.id);
      const first = await runWorkerSearch(pool);
      const request = () => client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} });
      await pool.query('UPDATE app_users SET is_disabled = true WHERE id = $1', [target.id]);
      assert.equal((await request()).payload.error.code, 'missing_music_decision_read_only');
      await pool.query('UPDATE app_users SET is_disabled = false WHERE id = $1', [target.id]);
      const lock = await pool.query("INSERT INTO maintenance_locks (lock_type, status, reason, acquired_at) VALUES ('maintenance', 'active', 'Controlled quality test', NOW()) RETURNING id");
      assert.equal((await request()).payload.error.code, 'recovery_lock_conflict');
      await pool.query('DELETE FROM maintenance_locks WHERE id = $1', [lock.rows[0].id]);
      await pool.query("UPDATE import_candidates SET status = 'selected' WHERE source_search_id = $1", [first.searchId]);
      assert.equal((await request()).payload.error.code, 'music_queue_fallback_not_available');
      await pool.query("UPDATE import_candidates SET status = 'pending' WHERE source_search_id = $1", [first.searchId]);
      await pool.query(`UPDATE library_discovery_requests SET evidence = jsonb_set(evidence, '{lastSearchResult,autoSelection,quality,formats}', '["flac"]'::jsonb) WHERE id = $1`, [original.discoveryId]);
      assert.equal((await client.requestJson(detailPath(original.wantedReleaseId))).payload.qualityEvidence.code, 'needs_verification');
      assert.equal((await request()).payload.error.code, 'music_queue_fallback_not_available');
      await pool.query(`UPDATE library_discovery_requests SET evidence = jsonb_set(evidence, '{lastSearchResult,autoSelection,quality,formats}', '["mp3"]'::jsonb) WHERE id = $1`, [original.discoveryId]);
      await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId]);
      assert.equal((await request()).payload.error.code, 'missing_music_decision_not_found');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_fallback_quality_allowed'")).rows[0].count, 0);
      assert.equal((await pool.query('SELECT evidence FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0].evidence.musicQueueRediscovery, undefined);
    }, { scenarioName: 'missing_music_fallback_refusals' });
  });

  test('audit failure rolls back both target consent and retry; dispatch failure after commit retains durable pending work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const target = await createUser(client, pool, 'quality-atomicity');
      const original = await seedReadyRelease(pool, target.id);
      await runWorkerSearch(pool);
      const intent = { appUserId: target.id, metadataReleaseId: original.metadataReleaseId, wantedReleaseId: original.wantedReleaseId,
        allowedAt: new Date().toISOString(), allowedByUserId: admin.id };
      const broken = createGuard(pool, { recordAuditEventFn: async () => { throw new Error('Controlled audit failure'); } });
      await assert.rejects(() => broken.allowGuardedMusicQueueFallbackQuality(intent), /Controlled audit failure/);
      assert.equal((await pool.query('SELECT evidence FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [original.wantedReleaseId])).rows[0].evidence.musicQueueQualityOverride, undefined);
      assert.equal((await pool.query('SELECT evidence FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0].evidence.musicQueueRediscovery, undefined);
      const wantedStore = createLibraryWantedReleaseStore({ getPoolFn: () => pool });
      const pipeline = createAcquisitionPipelineService({ acquisitionPipelineStore: createAcquisitionPipelineStore({
        buildLibraryWantedReleases: async () => ({}), listWantedReleasesWithMetadata: wantedStore.listWantedReleasesWithMetadata }),
        allowMusicQueueFallbackQuality: createGuard(pool).allowGuardedMusicQueueFallbackQuality,
        startLibraryDiscoveryRun: async () => { throw new Error('Controlled post-commit dispatch failure'); } });
      const accepted = await pipeline.allowMusicQueueReleaseFallbackQuality({ appUserId: target.id, actorUserId: admin.id,
        wantedReleaseId: original.wantedReleaseId, includeRelease: false });
      assert.equal(accepted.action.overrideAlreadyAllowed, false);
      assert.equal(accepted.action.discoveryRunId, null);
      assert.equal((await pool.query('SELECT request_status FROM library_discovery_requests WHERE id = $1', [original.discoveryId])).rows[0].request_status, 'ready');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_fallback_quality_allowed'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_fallback_atomicity' });
  });

  test('concurrent target choices serialize; mixed consent stays strict and unanimous consent actually selects only 256 kbps or better', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const firstUser = await createUser(client, pool, 'quality-first');
      const secondUser = await createUser(client, pool, 'quality-second');
      const original = await seedReadyRelease(pool, firstUser.id);
      const secondId = await addRecipient(pool, original, secondUser.id);
      await runWorkerSearch(pool);
      const firstClient = createSessionHttpClient(baseUrl);
      const secondClient = createSessionHttpClient(baseUrl);
      await loginWithPassword(firstClient, { username: firstUser.username, password: 'QualityPass123!' });
      await loginWithPassword(secondClient, { username: secondUser.username, password: 'QualityPass123!' });
      const responses = await Promise.all([firstClient.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} }),
        secondClient.requestJson(actionPath(secondId), { method: 'POST', json: {} })]);
      assert.deepEqual(responses.map((response) => response.response.status).sort(), [200, 409]);
      const mixed = await runWorkerSearch(pool);
      assert.ok(mixed.result.dispatchedSearches[0].query.endsWith(' FLAC'));
      assert.equal(mixed.input.musicQueueContext.qualityOverride, null);
      assert.equal(mixed.result.dispatchedSearches[0].autoSelection.selected, false);
      const missingIndex = responses.findIndex((response) => response.response.status === 409);
      const remainingId = missingIndex === 0 ? original.wantedReleaseId : secondId;
      const remainingClient = missingIndex === 0 ? firstClient : secondClient;
      const choice = await remainingClient.requestJson(actionPath(remainingId), { method: 'POST', json: {} });
      assert.equal(choice.response.status, 200, JSON.stringify(choice.payload));
      const low = await runWorkerSearch(pool, { bitrate: 128 });
      assert.equal(low.input.musicQueueContext.profileCode, 'lossless_archive');
      assert.equal(low.input.musicQueueContext.qualityOverride.mode, 'allow_fallback_quality');
      assert.equal(low.result.dispatchedSearches[0].query.endsWith(' FLAC'), false);
      assert.equal(low.result.dispatchedSearches[0].autoSelection.selected, false);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'ready', blocked_reason = NULL, next_search_after = NULL WHERE id = $1", [original.discoveryId]);
      const allowed = await runWorkerSearch(pool, { bitrate: 256 });
      assert.equal(allowed.result.dispatchedSearches[0].autoSelection.selected, true);
      const selected = (await pool.query('SELECT normalized_payload FROM import_candidates WHERE source_search_id = $1', [allowed.searchId])).rows[0].normalized_payload;
      assert.equal(selected.bitrateKbps, 256);
      assert.equal(selected.musicQueue.profileCode, 'lossless_archive');
      assert.equal(selected.musicQueue.wantedReleaseIds.length, 2);
      const links = (await pool.query('SELECT wanted_release_id, evidence FROM library_discovery_request_wanted_release_links WHERE discovery_request_id = $1', [original.discoveryId])).rows;
      assert.ok(links.every((row) => row.evidence.musicQueueQualityOverride.wantedReleaseId === row.wanted_release_id));
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'missing_music_fallback_quality_allowed'")).rows[0].count, 2);
    }, { scenarioName: 'missing_music_fallback_shared' });
  });

  test('shared fallback retains an unconsented High minimum of 320 through real candidate selection and public evidence', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const strict = await createUser(client, pool, 'quality-strict');
      const high = await createUser(client, pool, 'quality-high', { minimumQuality: 'high', preferredFormat: 'any' });
      const original = await seedReadyRelease(pool, strict.id);
      const highId = await addRecipient(pool, original, high.id);
      await runWorkerSearch(pool);
      assert.equal((await client.requestJson(actionPath(original.wantedReleaseId), { method: 'POST', json: {} })).response.status, 200);
      const below = await runWorkerSearch(pool, { bitrate: 256 });
      assert.equal(below.input.musicQueueContext.minimumBitrateKbps, 320);
      assert.equal(below.input.musicQueueContext.qualityOverride.minimumBitrateKbps, 320);
      assert.equal(below.result.dispatchedSearches[0].autoSelection.selected, false);
      const detail = await client.requestJson(detailPath(highId));
      assert.equal(detail.payload.qualityEvidence.minimumBitrateKbps, 320);
      assert.equal(detail.payload.qualityEvidence.code, 'below_minimum');
      assert.equal(detail.payload.permissions.canAllowFallbackQuality, false);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'ready', blocked_reason = NULL, next_search_after = NULL WHERE id = $1", [original.discoveryId]);
      const accepted = await runWorkerSearch(pool, { bitrate: 320 });
      assert.equal(accepted.result.dispatchedSearches[0].autoSelection.selected, true);
      const context = (await pool.query('SELECT normalized_payload FROM import_candidates WHERE source_search_id = $1', [accepted.searchId])).rows[0].normalized_payload.musicQueue;
      assert.equal(context.minimumBitrateKbps, 320);
      assert.equal(context.qualityOverride.minimumBitrateKbps, 320);
    }, { scenarioName: 'missing_music_fallback_high_minimum' });
  });

  test('recovery retains recipient scope, numeric floor and strict verification across actual PostgreSQL promotion and staging', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'quality-recovery', { minimumQuality: 'high' });
      const original = await seedReadyRelease(pool, owner.id);
      const oldSearch = await runWorkerSearch(pool, { bitrate: 320 });
      const old = (await pool.query('SELECT id, normalized_payload FROM import_candidates WHERE source_search_id = $1', [oldSearch.searchId])).rows[0];
      const currentContext = old.normalized_payload.musicQueue;
      const weakContext = { ...currentContext };
      delete weakContext.minimumBitrateKbps;
      await pool.query("UPDATE import_candidates SET status = 'pending', normalized_payload = jsonb_set(normalized_payload, '{musicQueue}', $2::jsonb) WHERE id = $1", [old.id, JSON.stringify(weakContext)]);
      await pool.query("UPDATE library_discovery_requests SET request_status = 'ready', next_search_after = NULL WHERE id = $1", [original.discoveryId]);
      const newSearch = await runWorkerSearch(pool, { bitrate: 320 });
      const failed = (await pool.query('SELECT id FROM import_candidates WHERE source_search_id = $1', [newSearch.searchId])).rows[0];
      const recovery = createImportCandidateRecoveryService({
        getImportCandidate: ({ importCandidateId }) => getImportCandidateById(importCandidateId, pool),
        findNextCandidateForRecoveryFn: (input) => findNextCandidateForRecovery(input, pool),
        incrementImportCandidateDownloadAttemptCountFn: (input) => incrementImportCandidateDownloadAttemptCount(input, pool),
        promoteImportCandidateForRecoveryFn: (input) => promoteImportCandidateForRecovery(input, pool),
        qualityPolicyService: createAcquisitionQualityPolicyService(),
      });
      const weak = await recovery.handleImportCandidateDownloadFailure({ failedCandidateId: failed.id });
      assert.equal(weak.recovered, false);
      assert.equal(weak.skippedCandidates[0].reason, 'recovery_quality_context_incompatible');
      await pool.query("UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload, '{musicQueue}', $2::jsonb) WHERE id = $1", [failed.id,
        JSON.stringify({ profileCode: 'lossless_archive', wantedReleaseId: original.wantedReleaseId })]);
      await pool.query("UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload, '{extensions}', '[\"flac\"]'::jsonb) WHERE id = $1", [old.id]);
      const strict = await recovery.handleImportCandidateDownloadFailure({ failedCandidateId: failed.id });
      assert.equal(strict.recovered, false);
      assert.equal(strict.skippedCandidates[0].reason, 'recovery_quality_context_incompatible');
      await pool.query("UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload, '{musicQueue}', $2::jsonb) WHERE id = ANY($1::uuid[])", [[old.id, failed.id], JSON.stringify(currentContext)]);
      const changed = await promoteImportCandidateForRecovery({ importCandidateId: old.id, maxDownloadAttemptCount: 3,
        triggeredByFailedCandidateId: failed.id, expectedMusicQueueContext: weakContext }, pool);
      assert.equal(changed, null);
      const compatible = await recovery.handleImportCandidateDownloadFailure({ failedCandidateId: failed.id });
      assert.equal(compatible.recovered, true);
      assert.equal(compatible.nextCandidateId, old.id);
      const staged = buildStageCandidateBase(await getImportCandidateById(old.id, pool));
      assert.equal(staged.musicQueueContext.minimumBitrateKbps, 320);
      const measured = await createImportCandidateSafeAutoAddQualityGateService().evaluateSafeAutoAddQuality({ summaryCandidate: staged,
        applyPreview: { files: [{ filename: 'Track.mp3', status: { code: 'ready' }, inspection: { warnings: [], metadata: {
          primaryAudioCodec: 'mp3', containerFormatName: 'mp3', bitRate: 256000,
        } } }] } });
      assert.equal(measured.eligible, false);
      assert.equal(measured.checkedFileCount, 1);
    }, { scenarioName: 'missing_music_fallback_recovery' });
  });

  test('existing empty and partial preference objects preserve account defaults while invalid saved requirements remain conservative', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const target = await createUser(client, pool, 'quality-defaults', {});
      const original = await seedReadyRelease(pool, target.id);
      const worker = await runWorkerSearch(pool, { bitrate: 128 });
      assert.equal(worker.input.musicQueueContext.profileCode, 'any_available');
      for (const [saved, profile, minimum] of [[{}, 'any_available', null], [{ notificationPreferences: {} }, 'any_available', null],
        [{ minimumQuality: 'high' }, 'high_quality', 320], [{ preferredFormat: 'flac' }, 'lossless_archive', null],
        [{ minimumQuality: 'invalid' }, 'lossless_archive', null]]) {
        await pool.query('UPDATE app_users SET user_preferences = $2::jsonb WHERE id = $1', [target.id, JSON.stringify(saved)]);
        const detail = await client.requestJson(detailPath(original.wantedReleaseId));
        assert.equal(detail.payload.qualityEvidence.profileCode, profile);
        assert.equal(detail.payload.qualityEvidence.minimumBitrateKbps, minimum);
      }
    }, { scenarioName: 'missing_music_fallback_defaults' });
  });
});

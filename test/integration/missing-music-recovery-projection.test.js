/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { createMusicQueueRecoveryStore } from '../../src/server/import-candidates/music-queue-recovery-store.js';
import { buildAutomaticLibraryAddAuthority } from '../../src/server/import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createMissingMusicDecisionService } from '../../src/server/missing-music/missing-music-decision-service.js';
import { createImportCandidateExecutionConfirmationWorklistStore } from '../../src/server/import-candidates/import-candidate-execution-confirmation-worklist-store.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
const privateFacts = /attemptId|currentDownloadHandoff|musicQueueRecovery|recoveryExecution|recoveryDiscovery|recoverySelectionNeedsReview|legacyRecoverySelection|reservationRetained|authority|participant|episode|baselineRequirement|private-provider|private-path|sourceSearchId|currentConfirmedTransferCount|currentExecutionStatusCounts/u;

async function seed(pool) {
  const owner = (await pool.query(`INSERT INTO app_users (username,password_hash,role,user_preferences)
    VALUES ($1,'test-owned-read-fixture','requester',$2::jsonb) RETURNING id,username,role`,
  [`projection-${randomUUID()}`, JSON.stringify({ minimumQuality: 'high', preferredFormat: 'any' })])).rows[0];
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: 'Read projection fixture' });
  const wanted = (await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
    VALUES ($1,$2,$3,$4,'missing',1,0,1) RETURNING id`,
  [owner.id, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId])).rows[0];
  const searchId = `current-${wanted.id}`;
  const discovery = (await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,blocked_reason,search_attempt_count,evidence)
    VALUES ($1,$2,$3,'missing','automatic','blocked','download_recovery_exhausted',3,$4::jsonb) RETURNING id`,
  [metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId, JSON.stringify({ lastSearchId: searchId,
    lastDispatchAttemptedAt: '2026-10-08T00:00:00Z', lastSearchResult: { observedAt: '2026-10-08T00:01:00Z' } })])).rows[0];
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id,wanted_release_id) VALUES ($1,$2)', [discovery.id, wanted.id]);
  const payload = { extensions: ['mp3'], bitrateKbps: 320, musicQueue: { profileCode: 'high_quality', minimumBitrateKbps: 320, wantedReleaseId: wanted.id },
    requestOwnership: { metadataReleaseId: metadata.metadataReleaseId, sourceRequestedForUserId: owner.id } };
  const files = [{ filename: 'Track.mp3', extension: 'mp3', sizeBytes: 1000, bitRateKbps: 320, isLocked: false }];
  const failed = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status: 'failed', sourceSearchId: searchId, normalizedPayload: payload }, files });
  const candidate = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status: 'selected', sourceSearchId: `older-${wanted.id}`,
    selectionReason: 'recovery_cascade', username: 'private-provider', folderPath: 'private-path', normalizedPayload: payload }, files });
  await pool.query("UPDATE import_candidates SET selection_reason='recovery_cascade' WHERE id=$1", [candidate.id]);
  const full = await createMusicQueueRecoveryStore({ getPoolFn: () => pool }).getCandidate(candidate.id);
  const record = { metadataReleaseId: metadata.metadataReleaseId, failedCandidateId: failed.id, failedSourceSearchId: searchId,
    authority: buildAutomaticLibraryAddAuthority(full), selectedObservation: captureRecoveryObservation(full),
    baselineRequirement: { profileCode: 'high_quality', minimumBitrateKbps: 320 } };
  const run = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'pending',
    summary: { executionMode: 'download_enqueue', triggerSource: 'music_queue_fallback_recovery', selectedCandidateId: candidate.id,
      sourceSearchId: candidate.sourceSearchId, sourceWantedReleaseId: wanted.id, musicQueueRecovery: record } } });
  const wantedStore = createLibraryWantedReleaseStore({ getPoolFn: () => pool });
  const service = createMissingMusicDecisionService({
    listWantedReleaseIdentityPage: wantedStore.listWantedReleaseIdentityPage,
    listWantedReleasesWithMetadata: wantedStore.listWantedReleasesWithMetadata,
    listAppUsers: async () => (await pool.query('SELECT id,username,is_disabled AS "isDisabled" FROM app_users')).rows,
  });
  return { owner, metadata, wantedId: wanted.id, discoveryId: discovery.id, searchId, failed, candidate, record, run,
    read: async (state = 'all') => {
      const actorUser = { ...owner, role: 'admin' };
      const detail = await service.getMissingMusicDecisionDetail({ actorUser, decisionId: wanted.id });
      const list = await service.listMissingMusicDecisions({ actorUser, state });
      if (detail.decision.requestedFor.accountStatus === 'disabled') assert.equal(list.decisions.length, 0, 'disabled recipients are excluded by the normal worklist filter');
      else assert.deepEqual(list.decisions[0]?.status, detail.decision.status);
      assert.doesNotMatch(JSON.stringify({ detail, list }), privateFacts);
      return detail;
    } };
}

async function receipt(pool, candidateId, runId, providerId = randomUUID()) {
  await pool.query(`INSERT INTO import_execution_run_items
    (operation_run_id,import_candidate_id,position,item_status,planning_snapshot,status_message)
    VALUES ($1,$2,1,'queued',$3::jsonb,'Test-owned confirmed receipt')
    ON CONFLICT (operation_run_id,import_candidate_id) DO UPDATE SET item_status='queued',planning_snapshot=EXCLUDED.planning_snapshot`,
  [runId, candidateId, JSON.stringify({ execution: { handoff: { state: 'confirmed' }, enqueuedTransfers: [{ id: providerId }] } })]);
  await createImportExecutionTransferLinkStore({ getPoolFn: () => pool }).recordConfirmedTransfers({ importCandidateId: candidateId,
    operationRunId: runId, transfers: [{ id: providerId, username: 'private-provider' }] });
}

suite('Missing Music recovery read projection with PostgreSQL', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config, createAppFn: () => ({ app: express() }) }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('older child stages and exact provider receipts compose into canonical facts without rewriting discovery or publishing private authority', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      assert.equal((await fixture.read('searching')).decision.status.message, 'A previous match did not work. The next eligible match is queued for download preparation.');
      await pool.query("UPDATE operation_runs SET status='running' WHERE id=$1", [fixture.run.id]);
      assert.equal((await fixture.read('searching')).decision.status.message, 'Harmoniarr is preparing the next eligible match for download.');
      await pool.query("UPDATE operation_runs SET status='completed' WHERE id=$1", [fixture.run.id]);
      const completed = await fixture.read('action');
      assert.equal(completed.decision.status.code, 'needs_help_adding');
      assert.equal(completed.permissions.canStartDownload, false, 'completion without a receipt is not a new explicit selection');
      await receipt(pool, fixture.candidate.id, fixture.run.id);
      assert.equal((await fixture.read('downloading')).decision.status.code, 'downloading');
      await pool.query("UPDATE import_candidates SET status='downloading' WHERE id=$1", [fixture.candidate.id]);
      assert.equal((await fixture.read('downloading')).decision.status.message, 'A selected match is downloading.');
      assert.equal((await pool.query("SELECT evidence->>'lastSearchId' AS id FROM library_discovery_requests WHERE id=$1", [fixture.discoveryId])).rows[0].id, fixture.searchId);
    }, { scenarioName: 'recovery_projection_older_receipts' });
  });

  test('current guards refuse lost scope or provenance, retained uncertain checkpoints and safely retired held work use existing review states', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      for (const change of ['disabled', 'unlinked', 'changed_search', 'lost_context', 'changed_file', 'lost_baseline']) {
        if (change === 'disabled') await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [fixture.owner.id]);
        if (change === 'unlinked') await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE discovery_request_id=$1', [fixture.discoveryId]);
        if (change === 'changed_search') await pool.query("UPDATE library_discovery_requests SET evidence=jsonb_set(evidence,'{lastSearchId}','\"newer\"') WHERE id=$1", [fixture.discoveryId]);
        if (change === 'lost_context') await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'musicQueue' WHERE id=$1", [fixture.candidate.id]);
        if (change === 'changed_file') await pool.query('UPDATE import_candidate_files SET size_bytes=2 WHERE import_candidate_id=$1', [fixture.candidate.id]);
        if (change === 'lost_baseline') await pool.query("UPDATE operation_runs SET summary=summary#-'{musicQueueRecovery,baselineRequirement}' WHERE id=$1", [fixture.run.id]);
        const detail = await fixture.read();
        assert.equal(detail.decision.status.code, 'needs_help_adding', change);
        assert.equal(detail.permissions.canStartDownload, false);
        if (change === 'disabled') await pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [fixture.owner.id]);
        if (change === 'unlinked') await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id,wanted_release_id) VALUES ($1,$2)', [fixture.discoveryId, fixture.wantedId]);
        if (change === 'changed_search') await pool.query("UPDATE library_discovery_requests SET evidence=jsonb_set(evidence,'{lastSearchId}',to_jsonb($2::text)) WHERE id=$1", [fixture.discoveryId, fixture.searchId]);
        if (change === 'lost_context') await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue}',$2::jsonb) WHERE id=$1", [fixture.candidate.id, JSON.stringify({ profileCode: 'high_quality', minimumBitrateKbps: 320, wantedReleaseId: fixture.wantedId })]);
        if (change === 'changed_file') await pool.query('UPDATE import_candidate_files SET size_bytes=1000 WHERE import_candidate_id=$1', [fixture.candidate.id]);
        if (change === 'lost_baseline') await pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,baselineRequirement}',$2::jsonb) WHERE id=$1", [fixture.run.id, JSON.stringify(fixture.record.baselineRequirement)]);
      }
      await pool.query(`INSERT INTO import_execution_run_items (operation_run_id,import_candidate_id,position,item_status,planning_snapshot,status_message)
        VALUES ($1,$2,1,'awaiting_confirmation',$3::jsonb,'Test-owned uncertain checkpoint')`,
      [fixture.run.id, fixture.candidate.id, JSON.stringify({ execution: { handoff: { state: 'dispatching' } } })]);
      await pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [fixture.run.id]);
      assert.equal((await fixture.read('action')).decision.status.nextAction, 'view_recovery');
      await pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,retired}','true') WHERE id=$1", [fixture.run.id]);
      await pool.query("UPDATE import_candidates SET status='held' WHERE id=$1", [fixture.candidate.id]);
      const retired = await fixture.read('action');
      assert.equal(retired.decision.status.code, 'no_matches_left');
      assert.equal(retired.permissions.canStartDownload, false);
      assert.equal(retired.permissions.canSearchAgain, true);
    }, { scenarioName: 'recovery_projection_refusal_and_retirement' });
  });

  test('historical sibling and old-attempt receipts cannot masquerade as current download preparation', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      await pool.query("UPDATE operation_runs SET status='failed',summary=jsonb_set(summary,'{musicQueueRecovery,retired}','true') WHERE id=$1", [fixture.run.id]);
      await pool.query("UPDATE import_candidates SET status='held' WHERE id=$1", [fixture.candidate.id]);
      const stale = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'running',
        summary: { executionMode: 'download_enqueue', selectedCandidateId: fixture.failed.id, sourceSearchId: fixture.searchId } } });
      await receipt(pool, fixture.failed.id, stale.id);
      assert.equal((await fixture.read('action')).decision.status.code, 'no_matches_left');
      const current = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status: 'selected', selectionReason: 'manual',
        sourceSearchId: fixture.searchId, normalizedPayload: fixture.candidate.normalizedPayload },
      files: [{ filename: 'Current.mp3', extension: 'mp3', sizeBytes: 1000, bitRateKbps: 320, isLocked: false }] });
      const oldAttempt = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'completed',
        summary: { executionMode: 'download_enqueue', selectedCandidateId: current.id, sourceSearchId: fixture.searchId } } });
      await receipt(pool, current.id, oldAttempt.id);
      await pool.query("UPDATE operation_runs SET created_at='2020-01-01' WHERE id=$1", [oldAttempt.id]);
      await pool.query("UPDATE import_execution_run_items SET created_at='2020-01-01' WHERE operation_run_id=$1", [oldAttempt.id]);
      const selected = await fixture.read('action');
      assert.equal(selected.decision.status.code, 'match_selected');
      assert.equal(selected.permissions.canStartDownload, true);
      const own = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'pending',
        summary: { executionMode: 'download_enqueue', triggerSource: 'missing_music_manual', selectedCandidateId: current.id,
          sourceWantedReleaseId: fixture.wantedId, sourceSearchId: fixture.searchId } } });
      assert.equal((await fixture.read('downloading')).decision.status.label, 'Download queued');
      await pool.query("UPDATE operation_runs SET status='running' WHERE id=$1", [own.id]);
      assert.equal((await fixture.read('downloading')).decision.status.label, 'Preparing download');
      await pool.query(`INSERT INTO import_execution_run_items (operation_run_id,import_candidate_id,position,item_status,status_message)
        VALUES ($1,$2,1,'blocked','Test-owned stopped preparation')`, [own.id, current.id]);
      assert.equal((await fixture.read('action')).decision.status.code, 'match_selected');
    }, { scenarioName: 'recovery_projection_historical_receipts' });
  });

  test('safe retirement permits a genuinely later explicit selection instead of adopting its old child', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      await pool.query("UPDATE operation_runs SET status='failed',summary=jsonb_set(summary,'{musicQueueRecovery,retired}','true') WHERE id=$1", [fixture.run.id]);
      await pool.query("UPDATE import_candidates SET selection_reason='manual' WHERE id=$1", [fixture.candidate.id]);
      const withoutNewIntent = await fixture.read('action');
      assert.equal(withoutNewIntent.decision.status.nextAction, 'view_recovery');
      assert.equal(withoutNewIntent.permissions.canStartDownload, false, 'retired but still selected is not proof of a new user intent');
      await pool.query(`INSERT INTO import_candidate_events (import_candidate_id,actor_user_id,event_type,details,occurred_at,created_at)
        VALUES ($1,$2,'import_candidate_selected','{}',NOW(),NOW()+INTERVAL '1 second')`, [fixture.candidate.id, fixture.owner.id]);
      const own = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'pending',
        summary: { executionMode: 'download_enqueue', triggerSource: 'missing_music_manual', selectedCandidateId: fixture.candidate.id,
          sourceWantedReleaseId: fixture.wantedId, sourceSearchId: fixture.candidate.sourceSearchId } } });
      const prepared = await fixture.read('downloading');
      assert.equal(prepared.decision.status.label, 'Download queued');
      await receipt(pool, fixture.candidate.id, fixture.run.id);
      assert.equal((await fixture.read('downloading')).decision.status.label, 'Download queued', 'old protected receipt cannot be adopted by the new intent');
      await pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [own.id]);
      assert.notEqual((await fixture.read()).decision.status.code, 'downloading');
    }, { scenarioName: 'recovery_projection_independent_selection' });
  });

  test('owned delayed searches distinguish a waiting child, actual claim, unresolved terminal handoff and superseded marker', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      await pool.query("UPDATE operation_runs SET status='failed',summary=jsonb_set(summary,'{musicQueueRecovery,retired}','true') WHERE id=$1", [fixture.run.id]);
      await pool.query("UPDATE import_candidates SET status='held' WHERE id=$1", [fixture.candidate.id]);
      const deadline = '2030-10-08T00:00:00.000Z';
      const record = { ...fixture.record, nextSearchAfter: deadline };
      delete record.selectedObservation;
      const search = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'library_discovery_dispatch', status: 'pending',
        summary: { triggerSource: 'music_queue_fallback_rediscovery', musicQueueRecovery: record } } });
      const marker = { owningRunId: search.id, triggeredByFailedCandidateId: fixture.failed.id, nextSearchAfter: deadline, sourceSearchId: fixture.searchId };
      await pool.query(`UPDATE library_discovery_requests SET request_status='ready',blocked_reason=NULL,next_search_after=$2,
        evidence=jsonb_set(evidence,'{downloadRecoveryRediscovery}',$3::jsonb) WHERE id=$1`, [fixture.discoveryId, deadline, JSON.stringify(marker)]);
      assert.equal((await fixture.read('searching')).decision.status.code, 'retrying_search');
      await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [fixture.owner.id]);
      assert.equal((await fixture.read()).decision.status.code, 'needs_help_adding', 'a disabled original recipient removes queued authority');
      await pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [fixture.owner.id]);
      await pool.query("UPDATE operation_runs SET status='running' WHERE id=$1", [search.id]);
      assert.equal((await fixture.read('searching')).decision.status.code, 'retrying_search', 'worker ownership alone is still waiting before a claim');
      await pool.query(`UPDATE library_discovery_requests SET request_status='cooldown',
        evidence=jsonb_set(evidence,'{lastDispatchRunId}',to_jsonb($2::text)) WHERE id=$1`, [fixture.discoveryId, search.id]);
      assert.equal((await fixture.read('searching')).decision.status.code, 'searching');
      await pool.query("UPDATE operation_runs SET status='completed',summary=summary||'{\"outcome\":\"failed\",\"failedCount\":1}'::jsonb WHERE id=$1", [search.id]);
      const uncertain = await fixture.read('action');
      assert.equal(uncertain.decision.status.code, 'needs_help_adding');
      assert.equal(uncertain.decision.status.message, 'Automatic recovery needs review before another search can start.');
      assert.equal(uncertain.decision.status.nextAction, 'view_recovery');
      assert.equal(uncertain.permissions.canSearchAgain, false);
      await pool.query(`UPDATE library_discovery_requests SET request_status='blocked',blocked_reason='recovery_scope_changed',next_search_after=NULL,
        evidence=jsonb_set(evidence,'{downloadRecoveryRediscovery,state}','"guard_refused"') WHERE id=$1`, [fixture.discoveryId]);
      assert.equal((await fixture.read('action')).decision.status.code, 'no_matches_left');
      await pool.query(`UPDATE library_discovery_requests SET request_status='ready',blocked_reason=NULL,next_search_after=$2,
        evidence=jsonb_set(evidence-'downloadRecoveryRediscovery','{lastSearchId}','"fresh-independent-search"') WHERE id=$1`, [fixture.discoveryId, deadline]);
      assert.equal((await fixture.read('searching')).decision.status.code, 'retrying_search', 'a fresh unowned automatic search retains its existing behavior');
      await pool.query(`UPDATE library_discovery_requests SET request_status='cooldown',
        evidence=jsonb_set(evidence,'{downloadRecoveryRediscovery}',$2::jsonb) WHERE id=$1`, [fixture.discoveryId, JSON.stringify({ ...marker, state: 'completed' })]);
      assert.equal((await fixture.read('searching')).decision.status.code, 'retrying_search', 'a completed private marker does not retain an uncertain search reservation');
    }, { scenarioName: 'recovery_projection_owned_search_handoff' });
  });

  test('legacy untyped Music Queue recovery selection does not advertise a download the guarded worker will refuse', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      await pool.query('DELETE FROM operation_runs WHERE id=$1', [fixture.run.id]);
      await pool.query('UPDATE import_candidates SET source_search_id=$2 WHERE id=$1', [fixture.candidate.id, fixture.searchId]);
      const legacy = await fixture.read('action');
      assert.equal(legacy.decision.status.code, 'needs_help_adding');
      assert.equal(legacy.decision.status.nextAction, 'view_recovery');
      assert.equal(legacy.permissions.canStartDownload, false);
      await pool.query("UPDATE import_candidates SET selection_reason='manual' WHERE id=$1", [fixture.candidate.id]);
      assert.equal((await fixture.read('action')).permissions.canStartDownload, true, 'an independently selected current ordinary match retains its existing command');
    }, { scenarioName: 'recovery_projection_legacy_selection' });
  });

  test('a newer execution origin supersedes old guarded progress through either command or item ownership', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      assert.equal((await fixture.read('searching')).decision.status.code, 'trying_next_match');
      const newer = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'pending',
        summary: { executionMode: 'download_enqueue', triggerSource: 'missing_music_manual', selectedCandidateId: fixture.candidate.id,
          sourceSearchId: fixture.candidate.sourceSearchId, sourceWantedReleaseId: fixture.wantedId } } });
      await receipt(pool, fixture.candidate.id, fixture.run.id);
      const superseded = await fixture.read('action');
      assert.equal(superseded.decision.status.code, 'needs_help_adding');
      assert.equal(superseded.permissions.canStartDownload, false);
      assert.equal(superseded.permissions.canViewDownloader, false, 'an old attempt receipt is not adopted as current progress');
      await pool.query(`INSERT INTO import_execution_run_items (operation_run_id,import_candidate_id,position,item_status,status_message)
        VALUES ($1,$2,1,'blocked','Test-owned newer item origin')`, [newer.id, fixture.candidate.id]);
      await pool.query("UPDATE operation_runs SET summary=summary-'selectedCandidateId' WHERE id=$1", [newer.id]);
      assert.equal((await fixture.read('action')).decision.status.nextAction, 'view_recovery');
      await pool.query('DELETE FROM operation_runs WHERE id=$1', [newer.id]);
      assert.equal((await fixture.read('downloading')).decision.status.code, 'downloading', 'the exact current child receipt remains observable when no newer origin exists');
    }, { scenarioName: 'recovery_projection_latest_origin' });
  });

  test('older interrupted attempts remain public review across a newer blocked allocation, private worklist finds them and genuine acceptance takes precedence', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const fixture = await seed(pool);
      await pool.query(`INSERT INTO import_execution_run_items (operation_run_id,import_candidate_id,position,item_status,planning_snapshot,status_message)
        VALUES ($1,$2,1,'blocked',$3::jsonb,'Test-owned stale item status after interrupted dispatch')`,
      [fixture.run.id, fixture.candidate.id, JSON.stringify({ execution: { handoff: { state: 'dispatching', attempt: { attemptId: 'private-attempt', receiptDisposition: 'partial' } } } })]);
      await pool.query("UPDATE operation_runs SET status='completed' WHERE id=$1", [fixture.run.id]);
      const newer = await seedOperationRunFixture({ queryable: pool, runOverrides: { operationType: 'import_candidate_execution_planning', status: 'completed',
        summary: { executionMode: 'download_enqueue', selectedCandidateId: fixture.candidate.id, sourceWantedReleaseId: fixture.wantedId } } });
      await pool.query(`INSERT INTO import_execution_run_items (operation_run_id,import_candidate_id,position,item_status,status_message)
        VALUES ($1,$2,1,'blocked','Test-owned blocked newer allocation')`, [newer.id, fixture.candidate.id]);
      const unknown = await fixture.read('action');
      assert.equal(unknown.decision.status.label, 'Confirming download request');
      assert.equal(unknown.permissions.canStartDownload, false);
      assert.equal(unknown.permissions.canSearchAgain, false);
      const waiting = await createImportCandidateExecutionConfirmationWorklistStore({ getPoolFn: () => pool }).listUnconfirmedExecutionRuns({ excludeRunId: newer.id });
      assert.deepEqual(waiting.runIds, [fixture.run.id]);
      assert.equal(waiting.pendingConfirmationCount, 1);
      await receipt(pool, fixture.candidate.id, newer.id);
      await pool.query("UPDATE import_candidates SET status='downloading' WHERE id=$1", [fixture.candidate.id]);
      assert.equal((await fixture.read('downloading')).decision.status.code, 'downloading', 'a genuine newer recorded acceptance has precedence over old uncertainty');
    }, { scenarioName: 'download_handoff_current_read_and_older_polling' });
  });
});

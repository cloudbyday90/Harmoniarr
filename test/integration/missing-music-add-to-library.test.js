/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';
import { buildRecheckQualityContext, getRecheckWantedReleaseIds } from '../../src/server/import-candidates/import-candidate-release-recheck-quality-policy.js';
import { listImportCandidateFileDecisions, upsertImportCandidateFileDecision } from '../../src/server/import-candidates/import-candidate-file-decision-repository.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createLibraryAddMediaFixture, createLibraryAddFixtureUser, seedOwnedLibraryAddFixture,
  runLibraryAddFixtureWorker } from '../../testing/integration/library-add-media-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const actionPath = (id) => `/api/v1/missing-music/decisions/${id}/add-to-library`;
const detailPath = (id) => `/api/v1/missing-music/decisions/${id}`;
let runtime;
let module;
let fixtureRoot;
let unavailableReason;
let mediaUnavailableReason;
let inspectionHook;
const mediaFixture = createLibraryAddMediaFixture({ getFixtureRoot: () => fixtureRoot });

async function seed(pool, owner, workspaceDir, options = {}) {
  fixtureRoot = workspaceDir; inspectionHook = null;
  return seedOwnedLibraryAddFixture({ pool, owner, workspaceDir, mediaFixture, ...options });
}
async function guardInput(fixture, owner, actor) {
  const candidate = await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
  const participants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: getRecheckWantedReleaseIds(candidate) });
  return { appUserId: owner.id, actorUserId: actor.id, wantedReleaseId: fixture.wantedId, prepared: { candidate, participants,
    decisions: await listImportCandidateFileDecisions({ importCandidateId: candidate.id }),
    qualityContext: await buildRecheckQualityContext({ candidate, participants }) } };
}
const commit = (input) => module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseLibraryAdd(input);
const runWorker = (pool, runId) => runLibraryAddFixtureWorker({ pool, module, runId });
const post = (client, id, key) => client.requestJson(actionPath(id), { method: 'POST', json: {},
  ...(key ? { headers: { 'Idempotency-Key': key } } : {}) });

suite('Canonical prepared Add to library with PostgreSQL and test-owned measured files', () => {
  before(async () => {
    mediaUnavailableReason = await mediaFixture.verifyTooling();
    try {
      runtime = await createIntegrationAppRuntime({ config, createAppFn: (options) => createApp({ ...options,
        createImportCandidateModule: (dependencies) => {
          const inspection = createMediaInspectionService({ getMediaToolingStatus: mediaFixture.getTooling,
            mediaCommandService: { runCommand: ({ binary, args }) => mediaFixture.mediaCommand(binary, args) } });
          module = createImportCandidateModule({ ...dependencies, getMediaToolingStatus: mediaFixture.getTooling,
            mediaInspectionService: { inspectSourceFile: async (input) => {
              const result = await inspection.inspectSourceFile(input); await inspectionHook?.(input, result); return result;
            } },
            importCandidateRecoveryService: { handleImportCandidateQualityFailure: async () => ({ recovered: false }),
              handleImportCandidateDownloadFailure: async () => ({ recovered: false }), handleImportCandidateImportBlocker: async () => ({ recovered: false }),
              handleImportCandidateRejectedTransfer: async () => ({ recovered: false }) },
          }); return module;
        },
      }) });
    } catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('no-stop-history prepared download appears in action paging, resolves own authority and durably adds original measured bytes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, baseUrl, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'prepared-owner');
      const outsider = await createLibraryAddFixtureUser(client, pool, 'prepared-outsider');
      const fixture = await seed(pool, owner, workspaceDir);
      // Put non-action rows ahead of the prepared decision to exercise bounded identity scanning.
      for (let index = 1; index <= 55; index += 1) {
        const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Paging filler ${index}` });
        await pool.query(`INSERT INTO library_wanted_releases
          (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count,evidence,created_at)
          VALUES($1,$2,$3,$4,'missing',1,0,1,'{"visibilityState":"ignored"}',NOW()+$5 * INTERVAL '1 second')`,
        [owner.id, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId, index]);
      }
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM import_candidate_events WHERE import_candidate_id=$1', [fixture.candidateId])).rows[0].count, 0);
      const ownClient = createSessionHttpClient(baseUrl); await loginWithPassword(ownClient, { username: owner.username, password: 'InitialPass123!' });
      const alien = createSessionHttpClient(baseUrl); await loginWithPassword(alien, { username: outsider.username, password: 'InitialPass123!' });
      assert.equal((await post(alien, fixture.wantedId)).response.status, 404);
      await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      assert.equal((await ownClient.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      assert.equal((await ownClient.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: { candidateId: fixture.candidateId } })).response.status, 400);
      const detail = (await ownClient.requestJson(detailPath(fixture.wantedId))).payload;
      assert.equal(detail.permissions.canAddToLibrary, true); assert.equal(detail.decision.state, 'action');
      const page = (await ownClient.requestJson('/api/v1/missing-music/decisions?state=action&limit=1')).payload;
      assert.equal(page.decisions[0].decisionId, fixture.wantedId);
      const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
      assert.equal(preview.files[0].inspection.metadata.primaryAudioCodec, 'pcm_s16le');
      const bytes = await readFile(fixture.sourcePath);
      const accepted = await post(ownClient, fixture.wantedId, 'prepared-own-replay'); assert.equal(accepted.payload.action.outcome, 'queued');
      assert.equal(accepted.payload.action.targetUserId, owner.id); assert.deepEqual((await post(ownClient, fixture.wantedId, 'prepared-own-replay')).payload, accepted.payload);
      assert.equal((await post(client, fixture.wantedId, 'prepared-household-coalesce')).payload.action.outcome, 'already_queued');
      assert.equal((await ownClient.requestJson(detailPath(fixture.wantedId))).payload.permissions.canAddToLibrary, false);
      assert.equal((await ownClient.requestJson(detailPath(fixture.wantedId))).payload.decision.status.code, 'adding_to_library');
      const run = await runWorker(pool, accepted.payload.action.runId); assert.equal(run.appliedCount, 1, JSON.stringify(run));
      assert.deepEqual(await readFile(preview.files[0].libraryTarget.path), bytes); await assert.rejects(stat(fixture.sourcePath), { code: 'ENOENT' });
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_apply_started'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_safe_add_recheck_queued'")).rows[0].count, 0);
    }, { scenarioName: 'missing_music_prepared_add_real_file' });
  });

  test('required start audit and queue insertion failures roll back saved context without candidate reopen or recovery history', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user; const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'prepared-atomic'); const fixture = await seed(pool, owner, workspaceDir, { audio: false });
      const input = await guardInput(fixture, owner, admin); const original = input.prepared.candidate.normalizedPayload;
      for (const [table, name, condition] of [['audit_events', 'prepared_audit', "NEW.event_type='import_candidate_apply_started'"],
        ['operation_runs', 'prepared_queue', "NEW.operation_type='import_candidate_apply'"]]) {
        await pool.query(`CREATE FUNCTION reject_${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Controlled prepared acceptance rejection'; END IF; RETURN NEW; END $$`);
        await pool.query(`CREATE TRIGGER reject_${name} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_${name}()`);
        await assert.rejects(commit(input), /Controlled prepared acceptance rejection/u);
        const row = (await pool.query('SELECT status,normalized_payload FROM import_candidates WHERE id=$1', [fixture.candidateId])).rows[0];
        assert.equal(row.status, 'import_pending'); assert.deepEqual(row.normalized_payload, original);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='import_candidate_apply'")).rows[0].count, 0);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued')")).rows[0].count, 0);
        await pool.query(`DROP TRIGGER reject_${name} ON ${table}`);
      }
      assert.equal((await commit(input)).outcome, 'queued');
    }, { scenarioName: 'missing_music_prepared_add_atomicity' });
  });

  test('current write snapshots refuse candidate, decision, account and link drift and defer unguarded work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user; const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'prepared-drift'); const fixture = await seed(pool, owner, workspaceDir, { audio: false });
      const input = await guardInput(fixture, owner, admin);
      const maintenance = (await pool.query("INSERT INTO maintenance_locks(lock_type,status,reason,acquired_at) VALUES('maintenance','active','Controlled refusal',NOW()) RETURNING id")).rows[0];
      await assert.rejects(commit(input), { code: 'recovery_lock_conflict' }); await pool.query('DELETE FROM maintenance_locks WHERE id=$1', [maintenance.id]);
      for (const [change, restore, parameters] of [
        ["UPDATE app_users SET user_preferences='{}' WHERE id=$1", "UPDATE app_users SET user_preferences='{\"minimumQuality\":\"high\",\"preferredFormat\":\"any\"}' WHERE id=$1", [owner.id]],
        ['UPDATE import_candidate_files SET size_bytes=size_bytes+1 WHERE import_candidate_id=$1', 'UPDATE import_candidate_files SET size_bytes=size_bytes-1 WHERE import_candidate_id=$1', [fixture.candidateId]],
        ["UPDATE import_candidates SET folder_path='changed' WHERE id=$1", 'UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [fixture.candidateId, input.prepared.candidate.folderPath]],
      ]) { await pool.query(change, parameters.slice(0,1)); assert.equal((await commit(input)).outcome, 'not_available'); await pool.query(restore, parameters); }
      await upsertImportCandidateFileDecision({ importCandidateId: fixture.candidateId, importCandidateFileId: input.prepared.candidate.files[0].id, decisionType: 'skip' }, pool);
      assert.equal((await commit(input)).outcome, 'not_available'); await pool.query('DELETE FROM import_candidate_file_decisions WHERE import_candidate_id=$1', [fixture.candidateId]);
      await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [owner.id]); await assert.rejects(commit(input), { code: 'missing_music_decision_read_only' });
      await pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [owner.id]);
      await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [fixture.wantedId]);
      assert.equal((await commit(input)).outcome, 'not_available');
      await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [fixture.discoveryId, fixture.wantedId]);
      for (const source of ['download_completed', 'manual', 'music_queue_manual_add']) {
        const run = await module.importCandidateApplyRunStore.createOperationRun({ applySafetyMode: source === 'manual' ? 'manual' : 'safe_auto',
          importCandidateIds: [fixture.candidateId], triggerSource: source, requestedCandidateCount: 1 });
        assert.equal((await commit(input)).outcome, 'deferred'); await pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [run.id]);
      }
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id=$1', [fixture.candidateId])).rows[0].status, 'import_pending');
    }, { scenarioName: 'missing_music_prepared_add_current_write' });
  });

  test('shared recipient acceptance races coalesce one exact guarded run while a late participant refuses old acquired scope', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user; const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'prepared-shared-one'); const other = await createLibraryAddFixtureUser(client, pool, 'prepared-shared-two');
      const fixture = await seed(pool, owner, workspaceDir, { audio: false });
      const second = (await pool.query(`INSERT INTO library_wanted_releases(app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
        SELECT $2,metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing',1,0,1 FROM library_wanted_releases WHERE id=$1 RETURNING id`, [fixture.wantedId, other.id])).rows[0];
      await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [fixture.discoveryId, second.id]);
      const invalid = await module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: owner.id, wantedReleaseId: fixture.wantedId });
      assert.equal(invalid.libraryAddFacts.hasConflictingCandidate, true);
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,wantedReleaseIds}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify([fixture.wantedId, second.id])]);
      const first = await guardInput(fixture, owner, admin); const next = { ...first, appUserId: other.id, wantedReleaseId: second.id };
      const results = await Promise.all([commit(first), commit(next)]); assert.deepEqual(results.map((result) => result.outcome).sort(), ['already_queued','queued']);
      assert.equal(results[0].runId, results[1].runId);
      const row = (await pool.query('SELECT normalized_payload FROM import_candidates WHERE id=$1', [fixture.candidateId])).rows[0];
      assert.equal(row.normalized_payload.musicQueue.wantedReleaseId, fixture.wantedId);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_apply_started'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_prepared_add_shared' });
  });

  test('actual worker refuses policy or provenance drift and an unmarked legacy job before changing original files', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      for (const [variant, username] of [['strict_current_policy', 'prepared-strict'], ['preview_provenance_drift', 'prepared-preview-drift'], ['removed_marker', 'prepared-unmarked']]) {
        const owner = await createLibraryAddFixtureUser(client, pool, username); const fixture = await seed(pool, owner, workspaceDir);
        const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
        const accepted = await post(client, fixture.wantedId); assert.equal(accepted.payload.action.outcome, 'queued', JSON.stringify(accepted.payload));
        if (variant === 'strict_current_policy') await pool.query("UPDATE app_users SET user_preferences='{\"minimumQuality\":\"lossless\",\"preferredFormat\":\"flac\"}' WHERE id=$1", [owner.id]);
        if (variant === 'removed_marker') await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload #- '{musicQueue,libraryAddRequestedForWantedReleaseId}' WHERE id=$1", [fixture.candidateId]);
        let inspections = 0;
        if (variant === 'preview_provenance_drift') inspectionHook = async () => {
          inspections += 1;
          if (inspections === 2) await pool.query("UPDATE import_candidates SET folder_path='changed-during-measured-preview' WHERE id=$1", [fixture.candidateId]);
        };
        const run = await runWorker(pool, accepted.payload.action.runId); inspectionHook = null;
        assert.equal(run.appliedCount, 0, JSON.stringify(run)); assert.ok((run.applyFailedCount ?? 0) + (run.qualityBlockedCount ?? 0) > 0);
        if (variant === 'preview_provenance_drift') assert.equal(inspections, 2);
        await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' }); assert.ok((await stat(fixture.sourcePath)).isFile());
        await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [fixture.candidateId]);
      }
    }, { scenarioName: 'missing_music_prepared_add_worker_current' });
  });

  test('real low media, collisions and differing staging or reuse bytes cannot become a prepared safe-add bypass', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      const lowOwner = await createLibraryAddFixtureUser(client, pool, 'prepared-low');
      const low = await seed(pool, lowOwner, workspaceDir, { extension: 'mp3', bitrate: 128 });
      assert.equal((await post(client, low.wantedId)).payload.action.outcome, 'still_needs_review');
      const measured = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: low.candidateId });
      assert.equal(measured.files[0].inspection.metadata.primaryAudioCodec, 'mp3'); assert.ok(measured.files[0].inspection.metadata.bitRate < 150_000);
      const raw = await module.importCandidateService.getImportCandidate({ importCandidateId: low.candidateId });
      const currentParticipants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: [low.wantedId] });
      const currentContext = await buildRecheckQualityContext({ candidate: raw, participants: currentParticipants });
      assert.equal(currentContext.minimumBitrateKbps, 320);
      const gate = await createImportCandidateSafeAutoAddQualityGateService().evaluateSafeAutoAddQuality({
        summaryCandidate: { musicQueueContext: currentContext }, applyPreview: { files: [{ ...measured.files[0], status: { code: 'ready' } }] } });
      assert.equal(gate.eligible, false); assert.equal(gate.blockers[0].code, 'safe_auto_quality_below_minimum');
      for (const variant of ['collision', 'staging', 'reuse']) {
        const owner = await createLibraryAddFixtureUser(client, pool, `prepared-alternate-${variant}`); const fixture = await seed(pool, owner, workspaceDir);
        if (variant === 'reuse') {
          await pool.query("UPDATE app_users SET managed_library_relative_root='prepared-owned-reuse' WHERE id=$1", [owner.id]);
          await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify({ sourceRequestedForUserId: owner.id })]);
        }
        const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
        const alternate = variant === 'collision' ? preview.files[0].libraryTarget.path : variant === 'staging' ? preview.files[0].stagingTarget.path
          : join(fixture.paths.music, relative(preview.preview.library.targetUser.userRootPath, preview.files[0].libraryTarget.path));
        if (variant === 'collision') {
          await mkdir(dirname(alternate), { recursive: true }); await copyFile(low.sourcePath, alternate);
          assert.equal((await post(client, fixture.wantedId)).payload.action.outcome, 'still_needs_review');
        } else {
          const accepted = await post(client, fixture.wantedId); assert.equal(accepted.payload.action.outcome, 'queued');
          await mkdir(dirname(alternate), { recursive: true }); await copyFile(low.sourcePath, alternate);
          assert.notDeepEqual(await readFile(alternate), await readFile(fixture.sourcePath));
          const run = await runWorker(pool, accepted.payload.action.runId); assert.equal(run.appliedCount, 0); assert.equal(run.applyFailedCount, 1);
          await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' });
        }
        assert.ok((await stat(fixture.sourcePath)).isFile()); assert.ok((await stat(alternate)).isFile());
        await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [fixture.candidateId]);
      }
    }, { scenarioName: 'missing_music_prepared_add_actual_refusals' });
  });
});

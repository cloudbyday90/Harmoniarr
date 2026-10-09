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
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { replaceImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { listImportCandidateFileDecisions, upsertImportCandidateFileDecision } from '../../src/server/import-candidates/import-candidate-file-decision-repository.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createLibraryAddMediaFixture, createLibraryAddFixtureUser, seedOwnedLibraryAddFixture,
  runLibraryAddFixtureWorker } from '../../testing/integration/library-add-media-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let module; let fixtureRoot; let unavailableReason; let mediaUnavailableReason;
let inspectionHook; let gateHook; let controlledGate = false; let recoveryCalls = []; let recoveryDecisions = [];
const mediaFixture = createLibraryAddMediaFixture({ getFixtureRoot: () => fixtureRoot });
const actualGate = createImportCandidateSafeAutoAddQualityGateService();
async function seed(pool, owner, workspaceDir, options = {}) {
  fixtureRoot = workspaceDir; inspectionHook = null; gateHook = null; controlledGate = false; recoveryCalls = []; recoveryDecisions = [];
  return seedOwnedLibraryAddFixture({ pool, owner, workspaceDir, mediaFixture, ...options });
}
const start = (fixture) => module.importCandidateAutoApplyRunService.startSafeApplyRunAfterDownloadCompleted({ importCandidateId: fixture.candidateId });
const runWorker = (pool, runId) => runLibraryAddFixtureWorker({ pool, module, runId });
async function preparedInput(fixture, owner) {
  const candidate = await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
  const participants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: getRecheckWantedReleaseIds(candidate) });
  return { appUserId: owner.id, wantedReleaseId: fixture.wantedId, actorUserId: owner.id, prepared: { candidate, participants,
    decisions: await listImportCandidateFileDecisions({ importCandidateId: candidate.id }), qualityContext: await buildRecheckQualityContext({ candidate, participants }) } };
}
const commit = (input) => module.importCandidateReleaseRecheckGuardService.commitPreparedAutomaticLibraryAdd(input);
async function makeShared(pool, fixture, other) {
  const row = (await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
    SELECT $2,metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing',1,0,1 FROM library_wanted_releases WHERE id=$1 RETURNING id`, [fixture.wantedId, other.id])).rows[0];
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [fixture.discoveryId, row.id]);
  return row.id;
}

suite('Automatic Music Queue library addition with PostgreSQL and test-owned measured files', () => {
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
            importCandidateSafeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async (input) => {
              const result = await actualGate.evaluateSafeAutoAddQuality(input); await gateHook?.(input, result);
              // Only the explicitly labelled revocation timing case substitutes the completed proof result.
              return controlledGate ? { eligible: true, profileCode: input.summaryCandidate.musicQueueContext?.profileCode } : result;
            } },
            importCandidateRecoveryService: { handleImportCandidateQualityFailure: async (input) => {
              recoveryCalls.push(input);
              const result = await module.musicQueueRecoveryService.handleMusicQueueRecovery({ ...input, kind: 'quality' });
              recoveryDecisions.push(result); return result;
            },
              handleImportCandidateDownloadFailure: async () => ({ recovered: false }), handleImportCandidateImportBlocker: async (input) => { recoveryCalls.push(input); return { recovered: false }; },
              handleImportCandidateRejectedTransfer: async () => ({ recovered: false }) },
          }); return module;
        },
      }) });
    } catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('completed-transfer transition queues atomic system-owned current work and the real worker moves original WAV bytes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'automatic-owner');
      const fixture = await seed(pool, owner, workspaceDir, { status: 'downloading' });
      await pool.query("UPDATE app_users SET managed_library_relative_root='automatic-owned' WHERE id=$1", [owner.id]);
      const ownership = { sourceRequestedForUserId: owner.id };
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify(ownership)]);
      const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
      const bytes = await readFile(fixture.sourcePath); assert.equal(preview.files[0].inspection.metadata.primaryAudioCodec, 'pcm_s16le');
      const observed = captureRecoveryObservation(await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId }));
      const origin = await module.importCandidateExecutionRunStore.createOperationRun({ status: 'completed', requestedCandidateCount: 1,
        summary: { triggerSource: 'missing_music_manual', selectedCandidateId: fixture.candidateId,
          sourceWantedReleaseId: fixture.wantedId, sourceSearchId: observed.sourceSearchId } });
      const planningSnapshot = { execution: { acceptedCandidateObservation: observed, handoff: { state: 'confirmed' } } };
      await replaceImportExecutionRunItems(origin.id, [{ importCandidateId: fixture.candidateId, position: 1,
        itemStatus: 'queued', statusMessage: 'Controlled accepted download completed', planningSnapshot }], pool);
      const reconciled = await module.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionSummary({
        executionSummary: { currentRun: { id: origin.id, items: [{ importCandidateId: fixture.candidateId, planningSnapshot,
          statusMessage: 'Controlled accepted download completed',
          liveTransferSummary: { status: 'completed', message: 'Controlled files complete' } }] } } });
      assert.equal(reconciled.summary.autoApplyStarted, 1, JSON.stringify(reconciled));
      const accepted = reconciled.autoApplyRuns[0]; assert.equal(accepted.triggerSource, 'download_completed');
      const runBefore = (await pool.query('SELECT summary,triggered_by_user_id FROM operation_runs WHERE id=$1', [accepted.runId])).rows[0];
      assert.equal(runBefore.summary.triggerSource, 'music_queue_download_completed'); assert.equal(runBefore.triggered_by_user_id, null);
      assert.equal(runBefore.summary.automaticLibraryAddAuthority.wantedReleaseId, fixture.wantedId);
      assert.deepEqual(runBefore.summary.automaticLibraryAddAuthority.requestOwnership, { present: true, value: ownership });
      assert.equal(Object.hasOwn(await module.importCandidateApplyRunStore.getRunById(accepted.runId), 'automaticLibraryAddAuthority'), false);
      const candidate = await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
      assert.equal(candidate.normalizedPayload.musicQueue.automaticLibraryAddForWantedReleaseId, fixture.wantedId);
      assert.equal(candidate.normalizedPayload.musicQueue.wantedReleaseId, fixture.wantedId);
      assert.deepEqual(candidate.normalizedPayload.requestOwnership, ownership);
      assert.equal((await start(fixture)).alreadyQueued, true);
      const detail = (await client.requestJson(`/api/v1/missing-music/decisions/${fixture.wantedId}`)).payload;
      assert.equal(detail.decision.status.code, 'adding_to_library'); assert.equal(detail.permissions.canAddToLibrary, false);
      assert.equal(JSON.stringify(detail).includes('automaticLibraryAddForWantedReleaseId'), false);
      assert.equal(JSON.stringify(detail).includes('automaticLibraryAddAuthority'), false);
      assert.equal((await client.requestJson(`/api/v1/missing-music/decisions/${fixture.wantedId}/add-to-library`, { method: 'POST', json: {} })).payload.action.outcome, 'already_queued');
      const completed = await runWorker(pool, accepted.runId); assert.equal(completed.appliedCount, 1, JSON.stringify(completed));
      assert.deepEqual(await readFile(preview.files[0].libraryTarget.path), bytes); await assert.rejects(stat(fixture.sourcePath), { code: 'ENOENT' });
      const audits = (await pool.query("SELECT actor_type,actor_user_id,details FROM audit_events WHERE event_type='import_candidate_apply_started'")).rows;
      assert.equal(audits.length, 1); assert.equal(audits[0].actor_type, 'system'); assert.equal(audits[0].actor_user_id, null);
      assert.equal(audits[0].details.triggerSource, 'music_queue_download_completed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_safe_add_recheck_queued'")).rows[0].count, 0);
    }, { scenarioName: 'automatic_library_add_real_transition' });
  });

  test('required audit and queue rejection roll back fresh context and automatic marker with no reopen history', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn(); const owner = await createLibraryAddFixtureUser(client, pool, 'automatic-atomic');
      const fixture = await seed(pool, owner, workspaceDir, { audio: false }); const input = await preparedInput(fixture, owner);
      for (const [table, name, condition] of [['audit_events', 'automatic_audit', "NEW.event_type='import_candidate_apply_started'"],
        ['operation_runs', 'automatic_queue', "NEW.operation_type='import_candidate_apply'"]]) {
        await pool.query(`CREATE FUNCTION reject_${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Controlled automatic rejection'; END IF; RETURN NEW; END $$`);
        await pool.query(`CREATE TRIGGER reject_${name} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_${name}()`);
        await assert.rejects(commit(input), /Controlled automatic rejection/u);
        const row = (await pool.query('SELECT status,normalized_payload FROM import_candidates WHERE id=$1', [fixture.candidateId])).rows[0];
        assert.equal(row.status, 'import_pending'); assert.deepEqual(row.normalized_payload, input.prepared.candidate.normalizedPayload);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='import_candidate_apply'")).rows[0].count, 0);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued')")).rows[0].count, 0);
        await pool.query(`DROP TRIGGER reject_${name} ON ${table}`);
      }
      assert.equal((await commit(input)).outcome, 'queued');
    }, { scenarioName: 'automatic_library_add_atomicity' });
  });

  test('fresh short acceptance refuses maintenance, account, participant, candidate, decision and policy changes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn(); const owner = await createLibraryAddFixtureUser(client, pool, 'automatic-drift');
      const fixture = await seed(pool, owner, workspaceDir, { audio: false }); const input = await preparedInput(fixture, owner);
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
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id=$1', [fixture.candidateId])).rows[0].status, 'import_pending');
    }, { scenarioName: 'automatic_library_add_current_acceptance' });
  });

  test('shared automatic and explicit starters serialize one guarded run; unrelated sources are not adopted', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn(); const owner = await createLibraryAddFixtureUser(client, pool, 'automatic-shared-one');
      const other = await createLibraryAddFixtureUser(client, pool, 'automatic-shared-two');
      const fixture = await seed(pool, owner, workspaceDir, { audio: false }); const otherWantedId = await makeShared(pool, fixture, other);
      assert.equal((await start(fixture)).skippedReason, 'music_queue_scope_not_current');
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,wantedReleaseIds}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify([fixture.wantedId, otherWantedId])]);
      const input = await preparedInput(fixture, owner);
      for (const source of ['download_completed', 'manual', 'music_queue_download_completed']) {
        const run = await module.importCandidateApplyRunStore.createOperationRun({ applySafetyMode: source === 'manual' ? 'manual' : 'safe_auto',
          importCandidateIds: [fixture.candidateId], triggerSource: source, requestedCandidateCount: 1 });
        assert.equal((await commit(input)).outcome, 'deferred'); await pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [run.id]);
      }
      const results = await Promise.all([commit(input), module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseLibraryAdd({ ...input,
        appUserId: other.id, wantedReleaseId: otherWantedId })]);
      assert.deepEqual(results.map((result) => result.outcome).sort(), ['already_queued','queued']); assert.equal(results[0].runId, results[1].runId);
      const fresh = await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
      assert.equal(fresh.normalizedPayload.musicQueue.wantedReleaseId, fixture.wantedId);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_apply_started'")).rows[0].count, 1);
    }, { scenarioName: 'automatic_library_add_shared_race' });
  });

  test('durable automatic source and authority refuse context or marker removal, owner deletion or participating-owner retargeting, and preview drift', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      for (const [variant, username] of [['context', 'auto-context'], ['marker', 'auto-marker'], ['anchor', 'auto-anchor'],
        ['owner', 'auto-owner'], ['owner_delete', 'auto-owner-delete'], ['owner_participant', 'auto-owner-participant'], ['disabled', 'auto-disabled'],
        ['legacy', 'auto-legacy'], ['preview', 'auto-preview']]) {
        const owner = await createLibraryAddFixtureUser(client, pool, username); const fixture = await seed(pool, owner, workspaceDir);
        let alternateOwner;
        if (variant === 'owner_delete' || variant === 'owner_participant') {
          await pool.query('UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1', [owner.id, `auto-original-${variant}`]);
          await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',jsonb_build_object('sourceRequestedForUserId',$2::text)) WHERE id=$1", [fixture.candidateId, owner.id]);
        }
        if (variant === 'owner_participant') {
          alternateOwner = await createLibraryAddFixtureUser(client, pool, 'auto-owner-member');
          await pool.query("UPDATE app_users SET managed_library_relative_root='auto-alternate-owner' WHERE id=$1", [alternateOwner.id]);
          const otherWanted = await makeShared(pool, fixture, alternateOwner);
          await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,wantedReleaseIds}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify([fixture.wantedId, otherWanted])]);
        }
        const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
        const accepted = await start(fixture); assert.equal(accepted.started, true, JSON.stringify(accepted));
        if (variant === 'context') await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'musicQueue' WHERE id=$1", [fixture.candidateId]);
        if (variant === 'marker') await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload #- '{musicQueue,automaticLibraryAddForWantedReleaseId}' WHERE id=$1", [fixture.candidateId]);
        if (variant === 'anchor') await pool.query("UPDATE operation_runs SET summary=summary-'automaticLibraryAddAuthority' WHERE id=$1", [accepted.runId]);
        if (variant === 'owner_delete') await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'requestOwnership' WHERE id=$1", [fixture.candidateId]);
        if (variant === 'owner_participant') await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',jsonb_build_object('sourceRequestedForUserId',$2::text)) WHERE id=$1", [fixture.candidateId, alternateOwner.id]);
        if (variant === 'owner') {
          const outsider = await createLibraryAddFixtureUser(client, pool, 'auto-owner-outsider');
          await pool.query("UPDATE app_users SET managed_library_relative_root='auto-outsider-root' WHERE id=$1", [outsider.id]);
          await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',jsonb_build_object('sourceRequestedForUserId',$2::text)) WHERE id=$1", [fixture.candidateId, outsider.id]);
        }
        if (variant === 'disabled') await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [owner.id]);
        if (variant === 'legacy') await pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{triggerSource}','\"download_completed\"') WHERE id=$1", [accepted.runId]);
        let changedPlan;
        if (variant === 'owner_delete' || variant === 'owner_participant') {
          const fresh = await module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: owner.id, wantedReleaseId: fixture.wantedId });
          assert.equal(fresh.libraryAddFacts.owningTargetMarkerValid, false);
          const explicit = await client.requestJson(`/api/v1/missing-music/decisions/${fixture.wantedId}/add-to-library`, { method: 'POST', json: {} });
          assert.equal(explicit.response.status, 200); assert.equal(explicit.payload.action.outcome, 'deferred');
          changedPlan = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
          assert.notEqual(changedPlan.files[0].libraryTarget.path, preview.files[0].libraryTarget.path);
        }
        let inspections = 0;
        if (variant === 'preview') inspectionHook = async () => { inspections += 1;
          if (inspections === 2) await pool.query("UPDATE import_candidates SET folder_path='changed-during-preview' WHERE id=$1", [fixture.candidateId]); };
        const run = await runWorker(pool, accepted.runId); inspectionHook = null;
        assert.equal(run.appliedCount, 0, JSON.stringify(run)); assert.ok((run.applyFailedCount ?? 0) + (run.qualityBlockedCount ?? 0) > 0);
        if (variant === 'preview') assert.equal(inspections, 2);
        await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' }); assert.ok((await stat(fixture.sourcePath)).isFile());
        if (changedPlan) await assert.rejects(stat(changedPlan.files[0].libraryTarget.path), { code: 'ENOENT' });
        await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [fixture.candidateId]);
      }
    }, { scenarioName: 'automatic_library_add_worker_provenance' });
  });

  test('queued current strict policy and consent revocation refuse mutation while genuine quality stops reach the owning recovery', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn();
      const owner = await createLibraryAddFixtureUser(client, pool, 'automatic-strict'); const fixture = await seed(pool, owner, workspaceDir);
      const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
      const accepted = await start(fixture); assert.equal(accepted.started, true);
      await pool.query("UPDATE app_users SET user_preferences='{\"minimumQuality\":\"lossless\",\"preferredFormat\":\"flac\"}' WHERE id=$1", [owner.id]);
      const strictRun = await runWorker(pool, accepted.runId); assert.equal(strictRun.appliedCount, 0); assert.equal(strictRun.qualityBlockedCount, 1);
      assert.equal(recoveryCalls.length, 1); assert.equal(recoveryCalls[0].operationRunId, accepted.runId);
      assert.equal(recoveryCalls[0].observation.candidateId, fixture.candidateId);
      assert.equal(recoveryDecisions[0].scopedRecovery, true); assert.equal(recoveryDecisions[0].terminalObservationRecorded, true);
      assert.equal(recoveryDecisions[0].recovered, false);
      assert.equal((await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId })).downloadAttemptCount, 0);
      await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' });
      for (const [variant, username] of [['mutation', 'auto-revoke-mutation'], ['quality_recovery', 'auto-revoke-recovery']]) {
        const recipient = await createLibraryAddFixtureUser(client, pool, username, { minimumQuality: 'lossless', preferredFormat: 'flac' });
        const current = await seed(pool, recipient, workspaceDir, { profileCode: 'lossless_archive' });
        const consent = { mode: 'allow_fallback_quality', wantedReleaseId: current.wantedId };
        await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,qualityOverride}',$2::jsonb) WHERE id=$1", [current.candidateId, JSON.stringify(consent)]);
        await pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_build_object('musicQueueQualityOverride',$2::jsonb) WHERE wanted_release_id=$1", [current.wantedId, JSON.stringify(consent)]);
        controlledGate = true;
        const queued = await start(current); assert.equal(queued.started, true, JSON.stringify(queued));
        const plan = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: current.candidateId });
        if (variant === 'quality_recovery') controlledGate = false;
        gateHook = async () => { await pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [current.wantedId]); };
        const completed = await runWorker(pool, queued.runId); gateHook = null; controlledGate = false;
        assert.equal(completed.appliedCount, 0); assert.equal(recoveryCalls.length, variant === 'quality_recovery' ? 1 : 0);
        if (variant === 'quality_recovery') {
          assert.equal(recoveryCalls[0].operationRunId, queued.runId);
          assert.equal(recoveryDecisions[0].recovered, false); assert.equal(recoveryDecisions[0].scopedRecovery, true);
          assert.equal(recoveryDecisions[0].terminalObservationRecorded, true);
          assert.equal((await module.importCandidateService.getImportCandidate({ importCandidateId: current.candidateId })).downloadAttemptCount, 0);
        }
        assert.ok((completed.applyFailedCount ?? 0) + (completed.qualityBlockedCount ?? 0) > 0);
        await assert.rejects(stat(plan.files[0].libraryTarget.path), { code: 'ENOENT' }); assert.ok((await stat(current.sourcePath)).isFile());
      }
    }, { scenarioName: 'automatic_library_add_current_consent' });
  });

  test('measured low media and collisions refuse preparation; real differing staging and reusable bytes remain untouched', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn(); const lowOwner = await createLibraryAddFixtureUser(client, pool, 'automatic-low');
      const low = await seed(pool, lowOwner, workspaceDir, { extension: 'mp3', bitrate: 128 });
      assert.equal((await start(low)).started, false);
      const measured = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: low.candidateId });
      assert.equal(measured.files[0].inspection.metadata.primaryAudioCodec, 'mp3'); assert.ok(measured.files[0].inspection.metadata.bitRate < 150_000);
      const raw = await module.importCandidateService.getImportCandidate({ importCandidateId: low.candidateId });
      const participants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: [low.wantedId] });
      const context = await buildRecheckQualityContext({ candidate: raw, participants });
      const gate = await actualGate.evaluateSafeAutoAddQuality({ summaryCandidate: { musicQueueContext: context },
        applyPreview: { files: [{ ...measured.files[0], status: { code: 'ready' } }] } });
      assert.equal(context.minimumBitrateKbps, 320); assert.equal(gate.eligible, false);
      // This isolates measured quality consumption; production lossy attention plans do not queue.
      const strictOwner = await createLibraryAddFixtureUser(client, pool, 'auto-consumer-consent', { minimumQuality: 'lossless', preferredFormat: 'flac' });
      const consentFixture = await seed(pool, strictOwner, workspaceDir, { extension: 'mp3', bitrate: 320, profileCode: 'lossless_archive', minimumBitrateKbps: 256 });
      const consent = { mode: 'allow_fallback_quality', wantedReleaseId: consentFixture.wantedId };
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,qualityOverride}',$2::jsonb) WHERE id=$1", [consentFixture.candidateId, JSON.stringify(consent)]);
      await pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_build_object('musicQueueQualityOverride',$2::jsonb) WHERE wanted_release_id=$1", [consentFixture.wantedId, JSON.stringify(consent)]);
      const consentPreview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: consentFixture.candidateId });
      assert.equal(consentPreview.files[0].inspection.metadata.primaryAudioCodec, 'mp3'); assert.ok(consentPreview.files[0].inspection.metadata.bitRate >= 320_000);
      const consentCandidate = await module.importCandidateService.getImportCandidate({ importCandidateId: consentFixture.candidateId });
      const evaluateConsent = async () => {
        const currentParticipants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: [consentFixture.wantedId] });
        const rebuilt = await buildRecheckQualityContext({ candidate: consentCandidate, participants: currentParticipants });
        return { rebuilt, result: await actualGate.evaluateSafeAutoAddQuality({ summaryCandidate: { musicQueueContext: rebuilt },
          applyPreview: { files: [{ ...consentPreview.files[0], status: { code: 'ready' } }] } }) };
      };
      const granted = await evaluateConsent(); assert.equal(granted.rebuilt.qualityOverride.wantedReleaseId, consentFixture.wantedId);
      assert.equal(granted.result.blockers.some((blocker) => blocker.code === 'safe_auto_quality_below_minimum'), false);
      await pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [consentFixture.wantedId]);
      const revoked = await evaluateConsent(); assert.equal(revoked.rebuilt.qualityOverride, null); assert.equal(revoked.result.eligible, false);
      assert.equal(revoked.result.blockers[0].code, 'safe_auto_quality_below_minimum');
      for (const variant of ['collision', 'staging', 'reuse']) {
        const owner = await createLibraryAddFixtureUser(client, pool, `auto-alternate-${variant}`); const fixture = await seed(pool, owner, workspaceDir);
        if (variant === 'reuse') {
          await pool.query("UPDATE app_users SET managed_library_relative_root='automatic-owned-reuse' WHERE id=$1", [owner.id]);
          await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',$2::jsonb) WHERE id=$1", [fixture.candidateId, JSON.stringify({ sourceRequestedForUserId: owner.id })]);
        }
        const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
        const alternate = variant === 'collision' ? preview.files[0].libraryTarget.path : variant === 'staging' ? preview.files[0].stagingTarget.path
          : join(fixture.paths.music, relative(preview.preview.library.targetUser.userRootPath, preview.files[0].libraryTarget.path));
        if (variant === 'collision') {
          await mkdir(dirname(alternate), { recursive: true }); await copyFile(low.sourcePath, alternate);
          assert.equal((await start(fixture)).started, false);
        } else {
          const accepted = await start(fixture); assert.equal(accepted.started, true);
          await mkdir(dirname(alternate), { recursive: true }); await copyFile(low.sourcePath, alternate);
          assert.notDeepEqual(await readFile(alternate), await readFile(fixture.sourcePath));
          const run = await runWorker(pool, accepted.runId); assert.equal(run.appliedCount, 0); assert.equal(run.applyFailedCount, 1);
          await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' });
        }
        assert.ok((await stat(fixture.sourcePath)).isFile()); assert.ok((await stat(alternate)).isFile());
      }
    }, { scenarioName: 'automatic_library_add_actual_unsafe_inputs' });
  });

  test('malformed raw authority never compares equal to accepted null ownership or singleton membership in read, coalescing or worker guards', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client); const pool = getPoolFn(); const owner = await createLibraryAddFixtureUser(client, pool, 'auto-authority-parity');
      const fixture = await seed(pool, owner, workspaceDir, { audio: false });
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}','null') WHERE id=$1", [fixture.candidateId]);
      const accepted = await commit(await preparedInput(fixture, owner)); assert.equal(accepted.outcome, 'queued');
      const saved = (await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId })).normalizedPayload;
      const invalidPayloads = ['invalid', []].map((value) => ({ ...saved, requestOwnership: value }));
      invalidPayloads.push({ ...saved, musicQueue: { ...saved.musicQueue, wantedReleaseIds: 'invalid' } },
        { ...saved, musicQueue: { ...saved.musicQueue, wantedReleaseIds: [fixture.wantedId, null] } },
        { ...saved, requestOwnership: { sourceType: [] } });
      for (const invalid of invalidPayloads) {
        await pool.query('UPDATE import_candidates SET normalized_payload=$2::jsonb WHERE id=$1', [fixture.candidateId, JSON.stringify(invalid)]);
        const release = await module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: owner.id, wantedReleaseId: fixture.wantedId });
        assert.equal(release.libraryAddFacts.owningTargetMarkerValid, false);
        const explicit = await client.requestJson(`/api/v1/missing-music/decisions/${fixture.wantedId}/add-to-library`, { method: 'POST', json: {} });
        assert.equal(explicit.response.status, 200); assert.equal(explicit.payload.action.outcome, 'deferred');
        await assert.rejects(module.importCandidateReleaseSafeAddRecheckService.resolveCurrentQueuedRecheckCandidate({
          summaryCandidate: { id: fixture.candidateId }, triggerSource: 'music_queue_download_completed', runId: accepted.runId }), { code: 'import_candidate_apply_not_ready' });
      }
      await pool.query('UPDATE import_candidates SET normalized_payload=$2::jsonb WHERE id=$1', [fixture.candidateId, JSON.stringify(saved)]);
      const restored = await module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: owner.id, wantedReleaseId: fixture.wantedId });
      assert.equal(restored.libraryAddFacts.owningTargetMarkerValid, true);
    }, { scenarioName: 'automatic_library_add_authority_parity' });
  });
});

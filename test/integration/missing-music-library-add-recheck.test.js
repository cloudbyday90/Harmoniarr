/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { lockExistingImportCandidateIngestionParents } from '../../src/server/import-candidates/import-candidate-ingestion-lock-store.js';
import { createImportCandidateFileDecisionService } from '../../src/server/import-candidates/import-candidate-file-decision-service.js';
import { createImportCandidateReleaseRecheckGuardService } from '../../src/server/import-candidates/import-candidate-release-recheck-guard-service.js';
import { createImportCandidateRecoveryPromotionService } from '../../src/server/import-candidates/import-candidate-recovery-promotion-service.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';
import { getRecheckWantedReleaseIds } from '../../src/server/import-candidates/import-candidate-release-recheck-quality-policy.js';
import { listImportCandidateFileDecisions, upsertImportCandidateFileDecision } from '../../src/server/import-candidates/import-candidate-file-decision-repository.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { persistSettings } from '../../src/server/settings.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const executeFile = promisify(execFile);
const config = resolveIntegrationTestRuntimeConfig();
const mediaImage = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE;
const actionPath = (id) => `/api/v1/missing-music/decisions/${id}/recheck-library-add`;
const detailPath = (id) => `/api/v1/missing-music/decisions/${id}`;
let runtime;
let unavailableReason;
let mediaUnavailableReason;
let module;
let fixtureRoot;
let toolingReady;

const getTooling = async () => ({ status: toolingReady ? 'healthy' : 'degraded',
  details: { ffprobeAvailable: toolingReady, ffmpegAvailable: toolingReady } });

const runtimePath = (value) => process.platform === 'win32' ? value.replace(/^[a-z]:/iu, '').replaceAll('\\', '/') : value;

function mountedPath(pathValue) {
  const scoped = relative(resolve(fixtureRoot), resolve(pathValue));
  assert.ok(scoped && scoped !== '..' && !scoped.startsWith(`..${sep}`) && !isAbsolute(scoped), 'media fixture must stay in the test-owned workspace');
  return `/fixtures/${scoped.split(sep).join('/')}`;
}

async function mediaCommand(binary, args, { readonly = true } = {}) {
  const mappedArgs = args.map((value) => typeof value === 'string' && isAbsolute(value) ? mountedPath(value) : value);
  if (!mediaImage) return executeFile(binary, args, { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });
  return executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', binary, '--mount',
    `type=bind,source=${resolve(fixtureRoot)},target=/fixtures${readonly ? ',readonly' : ''}`, mediaImage, ...mappedArgs],
  { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
}

async function generateAudio(pathValue, bitrate = null) {
  await mkdir(dirname(pathValue), { recursive: true });
  await mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
    '-t', '2', '-ac', '2', '-metadata', 'artist=Controlled fixture', '-metadata', 'album=Controlled release',
    '-metadata', 'title=Controlled song', '-metadata', 'track=1', ...(bitrate ? ['-c:a', 'libmp3lame', '-b:a', `${bitrate}k`] : ['-c:a', 'pcm_s16le']), pathValue], { readonly: false });
}

async function createUser(client, pool, username) {
  const response = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'InitialPass123!', role: 'requester' } });
  assert.equal(response.response.status, 201);
  await pool.query("UPDATE app_users SET must_change_password = false, user_preferences = '{\"minimumQuality\":\"high\",\"preferredFormat\":\"any\"}'::jsonb WHERE id = $1", [response.payload.user.id]);
  return response.payload.user;
}

async function seedStopped(pool, owner, workspaceDir, { audio = true, reasonCode = 'source_path_unavailable', extension = 'wav', bitrate = null } = {}) {
  fixtureRoot = workspaceDir;
  toolingReady = true;
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Controlled ${owner.id}`, trackTitle: 'Controlled song', trackLengthMs: 2000 });
  const wanted = (await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
    VALUES ($1,$2,$3,$4,'missing',1,0,1) RETURNING id`, [owner.id, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId])).rows[0];
  const searchId = `controlled-recheck-${wanted.id}`;
  const discovery = await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode, request_status, evidence)
    SELECT metadata_artist_id, metadata_release_group_id, metadata_release_id, 'missing', 'automatic', 'blocked', jsonb_build_object('lastSearchId',$2::text)
    FROM library_wanted_releases WHERE id = $1 RETURNING id`, [wanted.id, searchId]);
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id, wanted_release_id) VALUES ($1,$2)', [discovery.rows[0].id, wanted.id]);
  const folderPath = `Controlled-${wanted.id}`;
  const sourcePath = join(workspaceDir, 'downloads', folderPath, `01 Controlled.${extension}`);
  if (audio) await generateAudio(sourcePath, bitrate);
  const candidate = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: {
    status: 'failed', sourceSearchId: searchId, folderPath,
    normalizedPayload: { musicQueue: { profileCode: 'high_quality', minimumBitrateKbps: 320, wantedReleaseId: wanted.id } },
  }, files: [{ filename: `01 Controlled.${extension}`, extension, sizeBytes: audio ? (await stat(sourcePath)).size : 1,
    bitRateKbps: 320, sampleRateHz: 44_100, bitDepth: extension === 'wav' ? 16 : null, lengthSeconds: 2, isLocked: false }] });
  await pool.query(`INSERT INTO import_candidate_events (import_candidate_id,event_type,details,occurred_at)
    VALUES ($1,'import_candidate_import_blocked',$2::jsonb,NOW())`, [candidate.id,
  JSON.stringify({ addBlockerCode: reasonCode === 'audio_check_failed' ? 'media_verification' : 'source_path_unavailable', recoveryReasonCode: reasonCode })]);
  const paths = { downloads: join(workspaceDir, 'wrong-downloads'), staging: join(workspaceDir, 'staging'), music: join(workspaceDir, 'music') };
  await Promise.all(Object.values(paths).map((pathValue) => mkdir(pathValue, { recursive: true })));
  await persistSettings(Object.entries(paths).map(([settingKey, value]) => ({ namespace: 'paths', settingKey, value: runtimePath(value) })), null, pool);
  await persistSettings([{ namespace: 'paths', settingKey: 'downloadMappings', value: [{ slskdPrefix: '/controlled-downloads', harmoniarrPrefix: runtimePath(paths.downloads) }] }], null, pool);
  return { wantedId: wanted.id, candidateId: candidate.id, discoveryId: discovery.rows[0].id, sourcePath, paths };
}

async function repairFolders(pool, fixture) {
  await persistSettings([{ namespace: 'paths', settingKey: 'downloads', value: runtimePath(join(fixtureRoot, 'downloads')) }], null, pool);
  await persistSettings([{ namespace: 'paths', settingKey: 'downloadMappings', value: [{ slskdPrefix: '/controlled-downloads', harmoniarrPrefix: runtimePath(join(fixtureRoot, 'downloads')) }] }], null, pool);
  await mkdir(join(fixtureRoot, 'downloads'), { recursive: true });
  return module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
}

async function preparedGuardInput(fixture, owner, admin) {
  const candidate = await module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
  const release = await module.importCandidateReleaseRecheckStore.readOwnedRelease({ appUserId: owner.id, wantedReleaseId: fixture.wantedId });
  const participants = await module.importCandidateReleaseRecheckStore.readParticipantPolicies({ wantedReleaseIds: getRecheckWantedReleaseIds(candidate) });
  const decisions = await listImportCandidateFileDecisions({ importCandidateId: fixture.candidateId });
  return { appUserId: owner.id, wantedReleaseId: fixture.wantedId, actorUserId: admin.id, prepared: {
    candidate, participants, decisions, qualityContext: candidate.normalizedPayload.musicQueue,
    stop: { addBlockerCode: release.libraryAddRecoveryFacts.addBlockerCode, recoveryReasonCode: release.libraryAddRecoveryFacts.recoveryReasonCode },
  } };
}

async function runQueuedWorker(pool, runId) {
  const claimed = await createOperationQueueStore({ getPoolFn: () => pool }).claimNextRunnableRun({ operationTypes: ['import_candidate_apply'] });
  assert.equal(claimed.id, runId);
  module.importCandidateApplyWorker.startWorkerRun({ ...claimed.summary, runId });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const run = await module.importCandidateApplyRunStore.getRunById(runId);
    if (['completed', 'failed', 'paused', 'cancelled'].includes(run.status)) return run;
    await new Promise((complete) => { setTimeout(complete, 100); });
  }
  assert.fail('The real apply worker did not persist a terminal result');
}

suite('Missing Music library-add recheck through PostgreSQL and local measured file application', () => {
  before(async () => {
    toolingReady = true;
    try {
      if (mediaImage) {
        const identity = await executeFile('docker', ['image', 'inspect', mediaImage, '--format', '{{.Id}}']);
        const version = await executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'ffprobe', mediaImage, '-version']);
        console.log(`Local media fixture: ${mediaImage} ${identity.stdout.trim()}; ${version.stdout.split('\n')[0]}`);
      } else await executeFile('ffprobe', ['-version']);
    } catch { mediaUnavailableReason = 'Local ffmpeg/ffprobe fixture unavailable; configure HARMONIARR_INTEGRATION_MEDIA_IMAGE or install local tools'; }
    try {
      runtime = await createIntegrationAppRuntime({ config, createAppFn: (options) => createApp({ ...options,
        createImportCandidateModule: (dependencies) => {
          module = createImportCandidateModule({ ...dependencies, getMediaToolingStatus: getTooling,
            mediaInspectionService: createMediaInspectionService({ getMediaToolingStatus: getTooling,
              mediaCommandService: { runCommand: ({ binary, args }) => mediaCommand(binary, args) } }),
            importCandidateRecoveryService: { handleImportCandidateQualityFailure: async () => ({ recovered: false }),
              handleImportCandidateDownloadFailure: async () => ({ recovered: false }), handleImportCandidateImportBlocker: async () => ({ recovered: false }),
              handleImportCandidateRejectedTransfer: async () => ({ recovered: false }) },
          });
          return module;
        },
      }) });
    } catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('folder repair queues exact safe work, durable replay coalesces and the real worker adds measured source bytes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, baseUrl, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-owner');
      const outsider = await createUser(client, pool, 'recheck-outsider');
      const fixture = await seedStopped(pool, owner, workspaceDir);
      await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
      const otherClient = createSessionHttpClient(baseUrl);
      await loginWithPassword(otherClient, { username: outsider.username, password: 'InitialPass123!' });
      assert.equal((await otherClient.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} })).response.status, 404);
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {}, csrf: false })).response.status, 403);
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: { candidateId: fixture.candidateId } })).response.status, 400);
      const beforeDetail = await client.requestJson(detailPath(fixture.wantedId));
      assert.equal(beforeDetail.payload.permissions.canRecheckLibraryAdd, true);
      assert.equal(beforeDetail.payload.permissions.canRepairFolders, true);
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'still_needs_review');
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      const preview = await repairFolders(pool, fixture);
      assert.equal(preview.summary.status, 'ready', JSON.stringify(preview));
      const originalBytes = await readFile(fixture.sourcePath);
      const options = { method: 'POST', json: {}, headers: { 'Idempotency-Key': 'controlled-recheck-durable' } };
      const accepted = await client.requestJson(actionPath(fixture.wantedId), options);
      assert.equal(accepted.response.status, 200, JSON.stringify(accepted.payload));
      assert.equal(accepted.payload.action.outcome, 'queued');
      assert.deepEqual((await client.requestJson(actionPath(fixture.wantedId), options)).payload, accepted.payload);
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { ...options, headers: { 'Idempotency-Key': 'controlled-recheck-different' } })).payload.action.outcome, 'already_queued');
      const queuedDetail = await client.requestJson(detailPath(fixture.wantedId));
      assert.equal(queuedDetail.payload.decision.status.code, 'adding_to_library');
      assert.equal(queuedDetail.payload.libraryAddRecovery.queued, true);
      assert.equal(queuedDetail.payload.permissions.canRecheckLibraryAdd, false);
      const run = await runQueuedWorker(pool, accepted.payload.action.runId);
      assert.equal(run.appliedCount, 1, JSON.stringify(run));
      assert.deepEqual(await readFile(preview.files[0].libraryTarget.path), originalBytes);
      await assert.rejects(stat(fixture.sourcePath), { code: 'ENOENT' });
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'applied');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'import_candidate_apply'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'import_candidate_safe_add_recheck_queued'")).rows[0].count, 1);
      assert.ok(admin.id);
    }, { scenarioName: 'missing_music_recheck_real_add' });
  });

  test('actual low bitrate and existing library collision never reopen the failed download', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-measured');
      const fixture = await seedStopped(pool, owner, workspaceDir, { extension: 'mp3', bitrate: 128, reasonCode: 'audio_check_failed' });
      await repairFolders(pool, fixture);
      toolingReady = false;
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'prerequisite_not_ready');
      toolingReady = true;
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'still_needs_review');
      const measured = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
      assert.equal(measured.files[0].inspection.metadata.primaryAudioCodec, 'mp3');
      assert.ok(measured.files[0].inspection.metadata.bitRate < 150_000);
      const measuredGate = await createImportCandidateSafeAutoAddQualityGateService().evaluateSafeAutoAddQuality({
        summaryCandidate: { musicQueueContext: { profileCode: 'high_quality', minimumBitrateKbps: 320 } },
        applyPreview: { files: [{ ...measured.files[0], status: { code: 'ready' } }] },
      });
      assert.equal(measuredGate.eligible, false);
      assert.equal(measuredGate.blockers[0].code, 'safe_auto_quality_below_minimum');
      await generateAudio(fixture.sourcePath, 320);
      const ready = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: fixture.candidateId });
      await mkdir(dirname(ready.files[0].libraryTarget.path), { recursive: true });
      await copyFile(fixture.sourcePath, ready.files[0].libraryTarget.path);
      assert.equal((await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} })).payload.action.outcome, 'still_needs_review');
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'import_candidate_apply'")).rows[0].count, 0);
      assert.ok((await stat(fixture.sourcePath)).isFile());
    }, { scenarioName: 'missing_music_recheck_measured_refusal' });
  });

  test('real safe worker refuses different staging bytes and policy changes after accepted queue without source cleanup', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason || mediaUnavailableReason) { t.skip(unavailableReason || mediaUnavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-alternate');
      const fixture = await seedStopped(pool, owner, workspaceDir);
      const preview = await repairFolders(pool, fixture);
      const accepted = await client.requestJson(actionPath(fixture.wantedId), { method: 'POST', json: {} });
      assert.equal(accepted.payload.action.outcome, 'queued');
      await generateAudio(join(workspaceDir, 'low.mp3'), 128);
      await mkdir(dirname(preview.files[0].stagingTarget.path), { recursive: true });
      await copyFile(join(workspaceDir, 'low.mp3'), preview.files[0].stagingTarget.path);
      assert.notDeepEqual(await readFile(fixture.sourcePath), await readFile(preview.files[0].stagingTarget.path));
      const run = await runQueuedWorker(pool, accepted.payload.action.runId);
      assert.equal(run.appliedCount, 0);
      assert.equal(run.applyFailedCount, 1);
      await assert.rejects(stat(preview.files[0].libraryTarget.path), { code: 'ENOENT' });
      assert.ok((await stat(fixture.sourcePath)).isFile());
      assert.ok((await stat(preview.files[0].stagingTarget.path)).isFile());
      await pool.query("UPDATE import_candidates SET status = 'failed' WHERE id = $1", [fixture.candidateId]);
      const reuseOwner = await createUser(client, pool, 'recheck-reuse');
      const reuseFixture = await seedStopped(pool, reuseOwner, workspaceDir);
      await pool.query("UPDATE app_users SET managed_library_relative_root = 'controlled-recheck-reuse' WHERE id = $1", [reuseOwner.id]);
      await pool.query("UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload,'{requestOwnership}',$2::jsonb) WHERE id=$1",
        [reuseFixture.candidateId, JSON.stringify({ sourceRequestedForUserId: reuseOwner.id })]);
      const reusePreview = await repairFolders(pool, reuseFixture);
      assert.equal(reusePreview.summary.status, 'ready');
      const reusableQueued = await client.requestJson(actionPath(reuseFixture.wantedId), { method: 'POST', json: {} });
      assert.equal(reusableQueued.payload.action.outcome, 'queued');
      const reusablePath = join(reuseFixture.paths.music, relative(reusePreview.preview.library.targetUser.userRootPath, reusePreview.files[0].libraryTarget.path));
      await mkdir(dirname(reusablePath), { recursive: true });
      await copyFile(join(workspaceDir, 'low.mp3'), reusablePath);
      assert.notDeepEqual(await readFile(reuseFixture.sourcePath), await readFile(reusablePath));
      const reusableRefused = await runQueuedWorker(pool, reusableQueued.payload.action.runId);
      assert.equal(reusableRefused.appliedCount, 0);
      assert.equal(reusableRefused.applyFailedCount, 1);
      await assert.rejects(stat(reusePreview.files[0].libraryTarget.path), { code: 'ENOENT' });
      assert.ok((await stat(reuseFixture.sourcePath)).isFile());
      assert.ok((await stat(reusablePath)).isFile());
      await pool.query("UPDATE import_candidates SET status = 'failed' WHERE id = $1", [reuseFixture.candidateId]);
      const nextOwner = await createUser(client, pool, 'recheck-current');
      const next = await seedStopped(pool, nextOwner, workspaceDir);
      await repairFolders(pool, next);
      const queued = await client.requestJson(actionPath(next.wantedId), { method: 'POST', json: {} });
      assert.equal(queued.payload.action.outcome, 'queued');
      await pool.query("UPDATE app_users SET is_disabled = true WHERE id = $1", [nextOwner.id]);
      const refused = await runQueuedWorker(pool, queued.payload.action.runId);
      assert.equal(refused.appliedCount, 0);
      assert.equal(refused.applyFailedCount, 1);
      assert.ok((await stat(next.sourcePath)).isFile());
    }, { scenarioName: 'missing_music_recheck_actual_input_and_current_owner' });
  });

  test('required audit failure rolls back resume and queue; same-candidate concurrency coalesces one durable run', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-atomic');
      const fixture = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const input = await preparedGuardInput(fixture, owner, admin);
      await pool.query(`CREATE FUNCTION reject_recheck_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued') THEN RAISE EXCEPTION 'Controlled required audit rejection'; END IF; RETURN NEW; END $$`);
      await pool.query('CREATE TRIGGER reject_recheck_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_recheck_audit()');
      await assert.rejects(module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input), /Controlled required audit rejection/);
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'import_candidate_apply'")).rows[0].count, 0);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM import_candidate_events WHERE event_type = 'import_candidate_safe_add_recheck_queued'")).rows[0].count, 0);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued')")).rows[0].count, 0);
      await pool.query(`CREATE OR REPLACE FUNCTION reject_recheck_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type = 'import_candidate_apply_started' THEN RAISE EXCEPTION 'Controlled required start audit rejection'; END IF; RETURN NEW; END $$`);
      await assert.rejects(module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input), /Controlled required start audit rejection/);
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued')")).rows[0].count, 0);
      await pool.query('DROP TRIGGER reject_recheck_audit ON audit_events');
      await pool.query(`CREATE FUNCTION reject_recheck_run() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.operation_type = 'import_candidate_apply' THEN RAISE EXCEPTION 'Controlled queue creation rejection'; END IF; RETURN NEW; END $$`);
      await pool.query('CREATE TRIGGER reject_recheck_run BEFORE INSERT ON operation_runs FOR EACH ROW EXECUTE FUNCTION reject_recheck_run()');
      await assert.rejects(module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input), /Controlled queue creation rejection/);
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type IN ('import_candidate_apply_started','import_candidate_safe_add_recheck_queued')")).rows[0].count, 0);
      await pool.query('DROP TRIGGER reject_recheck_run ON operation_runs');
      const outcomes = await Promise.all([module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input),
        module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input)]);
      assert.deepEqual(outcomes.map((result) => result.outcome).sort(), ['already_queued', 'queued']);
      assert.equal(outcomes[0].runId, outcomes[1].runId);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'import_candidate_apply'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'import_candidate_safe_add_recheck_queued'")).rows[0].count, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'import_candidate_apply_started'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_recheck_atomicity' });
  });

  test('maintenance, disabled owners, changed policies and removed recipient links refuse fresh guarded writes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-refused');
      const fixture = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const input = await preparedGuardInput(fixture, owner, admin);
      const commit = () => module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(input);
      const lock = await pool.query("INSERT INTO maintenance_locks (lock_type,status,reason,acquired_at) VALUES ('maintenance','active','Controlled recheck refusal',NOW()) RETURNING id");
      await assert.rejects(commit(), { code: 'recovery_lock_conflict' });
      await pool.query('DELETE FROM maintenance_locks WHERE id = $1', [lock.rows[0].id]);
      await pool.query('UPDATE app_users SET is_disabled = true WHERE id = $1', [owner.id]);
      await assert.rejects(commit(), { code: 'missing_music_decision_read_only' });
      await pool.query('UPDATE app_users SET is_disabled = false WHERE id = $1', [owner.id]);
      const unrelated = await module.importCandidateApplyRunStore.createOperationRun({ requestedCandidateCount: 1 });
      assert.equal((await commit()).outcome, 'deferred');
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      await pool.query("UPDATE operation_runs SET status = 'failed' WHERE id = $1", [unrelated.id]);
      await pool.query('UPDATE import_candidate_files SET size_bytes = size_bytes + 1 WHERE import_candidate_id = $1', [fixture.candidateId]);
      assert.equal((await commit()).outcome, 'not_available');
      await pool.query('UPDATE import_candidate_files SET size_bytes = size_bytes - 1 WHERE import_candidate_id = $1', [fixture.candidateId]);
      await upsertImportCandidateFileDecision({ importCandidateId: fixture.candidateId,
        importCandidateFileId: input.prepared.candidate.files[0].id, decisionType: 'skip' }, pool);
      assert.equal((await commit()).outcome, 'not_available');
      await pool.query('DELETE FROM import_candidate_file_decisions WHERE import_candidate_id = $1', [fixture.candidateId]);
      await pool.query("UPDATE app_users SET is_disabled = false, user_preferences = '{\"minimumQuality\":\"lossless\",\"preferredFormat\":\"flac\"}'::jsonb WHERE id = $1", [owner.id]);
      assert.equal((await commit()).outcome, 'not_available');
      await pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id = $1', [fixture.wantedId]);
      assert.equal((await commit()).outcome, 'not_available');
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id = $1', [fixture.candidateId])).rows[0].status, 'failed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = 'import_candidate_apply' AND status IN ('pending','running')")).rows[0].count, 0);
    }, { scenarioName: 'missing_music_recheck_current_refusals' });
  });

  test('shared recipient intents coalesce and delayed decision writers serialize with the same parent lock', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-shared-one');
      const other = await createUser(client, pool, 'recheck-shared-two');
      const fixture = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const second = (await pool.query(`INSERT INTO library_wanted_releases
        (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
        SELECT $2,metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing',1,0,1 FROM library_wanted_releases WHERE id=$1 RETURNING id`, [fixture.wantedId, other.id])).rows[0];
      await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id,wanted_release_id) VALUES ($1,$2)', [fixture.discoveryId, second.id]);
      assert.equal((await client.requestJson(detailPath(fixture.wantedId))).payload.permissions.canRecheckLibraryAdd, false);
      await pool.query("UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload,'{musicQueue,wantedReleaseIds}',$2::jsonb) WHERE id = $1",
        [fixture.candidateId, JSON.stringify([fixture.wantedId, second.id])]);
      const firstInput = await preparedGuardInput(fixture, owner, admin);
      const secondInput = await preparedGuardInput({ ...fixture, wantedId: second.id }, other, admin);
      const coalesced = await Promise.all([module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(firstInput),
        module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(secondInput)]);
      assert.deepEqual(coalesced.map((result) => result.outcome).sort(), ['already_queued', 'queued']);
      assert.equal(coalesced[0].runId, coalesced[1].runId);
      await pool.query("UPDATE operation_runs SET status = 'failed' WHERE id = $1", [coalesced[0].runId]);
      const fileId = firstInput.prepared.candidate.files[0].id;
      await upsertImportCandidateFileDecision({ importCandidateId: fixture.candidateId, importCandidateFileId: fileId, decisionType: 'skip' }, pool);
      let writerPaused;
      let releaseWriter;
      const paused = new Promise((complete) => { writerPaused = complete; });
      const writerReleased = new Promise((complete) => { releaseWriter = complete; });
      const decisionService = createImportCandidateFileDecisionService({ pool: { connect: async () => {
        const connection = await pool.connect();
        return { release: () => connection.release(), query: async (sql, values) => {
          if (sql.includes('SELECT id FROM import_candidates')) { writerPaused(); await writerReleased; }
          return connection.query(sql, values);
        } };
      } } });
      const clearing = decisionService.clearImportCandidateFileDecision({ importCandidateId: fixture.candidateId, importCandidateFileId: fileId });
      await paused;
      await pool.query("UPDATE import_candidates SET status = 'failed' WHERE id = $1", [fixture.candidateId]);
      const input = await preparedGuardInput(fixture, owner, admin);
      let guardLocked;
      let releaseGuard;
      const locked = new Promise((complete) => { guardLocked = complete; });
      const guardReleased = new Promise((complete) => { releaseGuard = complete; });
      const store = module.importCandidateReleaseRecheckStore;
      const guard = createImportCandidateReleaseRecheckGuardService({ assertMaintenanceWriteAllowed: async () => {},
        recheckStore: { ...store, lockCandidate: async (args) => { await store.lockCandidate(args); guardLocked(); await guardReleased; } },
        getImportCandidate: module.importCandidateService.getImportCandidate, listFileDecisions: listImportCandidateFileDecisions,
        resumeImportCandidateForSafeAdd: module.importCandidateService.resumeImportCandidateForSafeAdd,
        queuePreparedImportCandidateApply: module.importCandidateApplyQueueService.queuePreparedImportCandidateApply,
        withTransaction: createDatabaseTransactionRunner({ getPoolFn: () => pool }),
      });
      const accepting = guard.commitPreparedReleaseRecheck(input);
      await locked;
      releaseWriter();
      releaseGuard();
      assert.equal((await accepting).outcome, 'queued');
      assert.equal((await clearing).clearedDecision.decisionType, 'skip');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM import_candidate_file_decisions WHERE import_candidate_id=$1', [fixture.candidateId])).rows[0].count, 0);
    }, { scenarioName: 'missing_music_recheck_shared_and_decision_race' });
  });

  test('reversed provider refresh and multi-candidate apply acceptance acquire existing parents in one shared ID order', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      await bootstrapAdminSession(client);
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-ingest-race');
      const first = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const second = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const ids = [first.candidateId, second.candidateId].sort();
      await pool.query("UPDATE import_candidates SET status = 'import_pending' WHERE id = ANY($1::uuid[])", [ids]);
      const candidates = await Promise.all(ids.toReversed().map((importCandidateId) => module.importCandidateService.getImportCandidate({ importCandidateId })));
      let parentsLocked;
      let releaseIngestion;
      const locked = new Promise((complete) => { parentsLocked = complete; });
      const held = new Promise((complete) => { releaseIngestion = complete; });
      const service = createImportCandidateService({ pool, loadSettingsFn: async () => ({}),
        slskdService: { getSearchResponses: async () => ({ searchId: 'controlled-refresh', responses: [{ files: [{ filename: 'controlled.wav' }] }] }) },
        normalizeSlskdResponsesFn: () => candidates,
        lockExistingIngestionParentsFn: async (input) => { await lockExistingImportCandidateIngestionParents(input); parentsLocked(); await held; },
      });
      const ingestion = service.ingestSlskdSearchResponses({ searchId: 'controlled-refresh' });
      await locked;
      const applying = module.importCandidateApplyQueueService.queuePreparedImportCandidateApply({ applySafetyMode: 'safe_auto', importCandidateIds: ids,
        preparedSummary: { counts: { ready: 2, totalImportPending: 2 }, importPendingCandidates: ids.map((id) => ({ id })) } });
      releaseIngestion();
      assert.equal((await ingestion).candidateCount, 2);
      assert.equal((await applying).accepted, true);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='import_candidate_apply'")).rows[0].count, 1);
    }, { scenarioName: 'missing_music_recheck_ingestion_queue_lock_order' });
  });

  test('default recovery promotion and recheck serialize current and older searches so the losing action refuses one active selection', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ client, getPoolFn, workspaceDir }) => {
      const admin = (await bootstrapAdminSession(client)).payload.user;
      const pool = getPoolFn();
      const owner = await createUser(client, pool, 'recheck-promotion-race');
      const fixture = await seedStopped(pool, owner, workspaceDir, { audio: false });
      const input = await preparedGuardInput(fixture, owner, admin);
      const metadataReleaseId = input.prepared.participants[0].metadataReleaseId;
      const next = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: {
        status: 'pending', sourceSearchId: input.prepared.candidate.sourceSearchId,
        normalizedPayload: { musicQueue: input.prepared.candidate.normalizedPayload.musicQueue, discoveryScope: { metadataReleaseId } },
      } });
      const promotion = createImportCandidateRecoveryPromotionService();
      const promoteInput = { importCandidateId: next.id, maxDownloadAttemptCount: 3,
        triggeredByFailedCandidateId: fixture.candidateId, expectedMusicQueueContext: next.normalizedPayload.musicQueue };
      const store = module.importCandidateReleaseRecheckStore;
      for (const scope of ['current', 'older', 'ownership_only_older', 'ownership_only_no_search']) {
        await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [fixture.candidateId]);
        await pool.query("UPDATE import_candidates SET status='pending', source_search_id=$2, normalized_payload=$3::jsonb WHERE id=$1",
          [next.id, scope === 'current' ? input.prepared.candidate.sourceSearchId : scope === 'ownership_only_no_search' ? '' : 'controlled-older-search',
            JSON.stringify({ musicQueue: next.normalizedPayload.musicQueue,
              ...(scope.startsWith('ownership_only') ? { requestOwnership: { metadataReleaseId } } : { discoveryScope: { metadataReleaseId } }) })]);
        const prepared = await preparedGuardInput(fixture, owner, admin);
        let lockedGuard;
        let releaseGuard;
        const locked = new Promise((complete) => { lockedGuard = complete; });
        const held = new Promise((complete) => { releaseGuard = complete; });
        const guard = createImportCandidateReleaseRecheckGuardService({ assertMaintenanceWriteAllowed: async () => {},
          recheckStore: { ...store, lockCandidate: async (args) => { await store.lockCandidate(args); lockedGuard(); await held; } },
          getImportCandidate: module.importCandidateService.getImportCandidate, listFileDecisions: listImportCandidateFileDecisions,
          resumeImportCandidateForSafeAdd: module.importCandidateService.resumeImportCandidateForSafeAdd,
          queuePreparedImportCandidateApply: module.importCandidateApplyQueueService.queuePreparedImportCandidateApply,
          withTransaction: createDatabaseTransactionRunner({ getPoolFn: () => pool }),
        });
        const accepting = guard.commitPreparedReleaseRecheck(prepared);
        await locked;
        let promotionSettled = false;
        const promoting = promotion.promoteRecoveryCandidate(promoteInput).then((result) => { promotionSettled = true; return result; });
        await new Promise((complete) => { setTimeout(complete, 50); });
        assert.equal(promotionSettled, false, 'recovery must wait for the held current discovery before its parent update');
        releaseGuard();
        const queued = await accepting;
        assert.equal(queued.outcome, 'queued');
        assert.equal(await promoting, null);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM import_candidates WHERE id=ANY($1::uuid[]) AND status IN ('selected','downloading','import_pending')", [[fixture.candidateId, next.id]])).rows[0].count, 1);
        await pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [queued.runId]);
        await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [fixture.candidateId]);
        const waitingRecheck = await preparedGuardInput(fixture, owner, admin);
        const selected = await promotion.promoteRecoveryCandidate(promoteInput);
        assert.equal(selected.status, 'selected');
        assert.equal((await module.importCandidateReleaseRecheckGuardService.commitPreparedReleaseRecheck(waitingRecheck)).outcome, 'not_available');
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM import_candidates WHERE id=ANY($1::uuid[]) AND status IN ('selected','downloading','import_pending')", [[fixture.candidateId, next.id]])).rows[0].count, 1);
      }
      await pool.query("UPDATE import_candidates SET status='pending', download_attempt_count=3 WHERE id=$1", [next.id]);
      assert.equal(await promotion.promoteRecoveryCandidate(promoteInput), null);
      await pool.query('UPDATE import_candidates SET download_attempt_count=0 WHERE id=$1', [next.id]);
      assert.equal(await promotion.promoteRecoveryCandidate({ ...promoteInput, expectedMusicQueueContext: { profileCode: 'any_available' } }), null);
    }, { scenarioName: 'missing_music_recheck_default_recovery_promotion_race' });
  });
});

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  buildControlledProviderFixtureFilename,
  controlledProviderFixtureCatalog,
} from './controlled-provider-fixture-catalog.mjs';
import { createAcquisitionModule } from '/app/server-dist/acquisition/acquisition-module.js';
import { createActivityModule } from '/app/server-dist/activity/activity-module.js';
import { closePool, getPool } from '/app/server-dist/database.js';
import { createImportCandidateModule } from '/app/server-dist/import-candidates/import-candidate-module.js';
import { createLibraryModule } from '/app/server-dist/library/library-module.js';
import { createSlskdService } from '/app/server-dist/slskd/slskd-service.js';
import { persistSettings } from '/app/server-dist/settings.js';

const downloadsRoot = '/data/downloads';
const musicRoot = '/data/music';
const stagingRoot = '/data/staging';
const providerApiKey = process.env.CONTROLLED_PROVIDER_API_KEY;

async function waitForRun(runStore, runId) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const run = await runStore.getRunById(runId);
    if (run?.status === 'completed') return run;
    if (['cancelled', 'failed', 'paused'].includes(run?.status)) throw new Error(`Run ${runId} ended as ${run.status}`);
    await delay(50);
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

async function waitForActiveRun(runStore) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const run = await runStore.getActiveRun();
    if (run) return run;
    await delay(50);
  }
  throw new Error('Timed out waiting for a recovery run');
}

async function listFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(rootPath, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return files.flat().sort();
}

function buildDownloadedFixturePath(fixture, { variant = 'primary' } = {}) {
  return resolve(
    downloadsRoot,
    'complete',
    `${fixture.id}-${variant}`,
    buildControlledProviderFixtureFilename(fixture, { variant }),
  );
}

async function seedAppUser(pool) {
  const user = await pool.query(
    `INSERT INTO app_users (username, password_hash, role, must_change_password)
     VALUES ($1, $2, 'admin', FALSE) RETURNING id`,
    [`controlled-provider-${randomUUID()}`, `controlled-provider-${randomUUID()}`],
  );
  return user.rows[0].id;
}

async function seedDiscoveryRequest(pool, fixture, { appUserId = null } = {}) {
  const artist = await pool.query(
    `INSERT INTO metadata_artists (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
     VALUES ('controlled_fixture', $1, $2, $3, $3) RETURNING id`,
    [`artist-${fixture.id}`, randomUUID(), fixture.artistName],
  );
  const releaseGroup = await pool.query(
    `INSERT INTO metadata_release_groups (
      metadata_artist_id, source_provider, source_release_group_id, musicbrainz_release_group_id,
      title, primary_type, first_release_date
    ) VALUES ($1, 'controlled_fixture', $2, $3, $4, 'Album', '2026-01-01') RETURNING id`,
    [artist.rows[0].id, `group-${fixture.id}`, randomUUID(), fixture.releaseTitle],
  );
  const release = await pool.query(
    `INSERT INTO metadata_releases (
      metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id,
      title, status, release_date, track_count, medium_count, is_canonical
    ) VALUES ($1, 'controlled_fixture', $2, $3, $4, 'Official', '2026-01-01', 1, 1, TRUE) RETURNING id`,
    [releaseGroup.rows[0].id, `release-${fixture.id}`, randomUUID(), fixture.releaseTitle],
  );
  const medium = await pool.query(
    `INSERT INTO metadata_media (metadata_release_id, position, format, track_count)
     VALUES ($1, 1, 'Digital Media', 1) RETURNING id`,
    [release.rows[0].id],
  );
  const recording = await pool.query(
    `INSERT INTO metadata_recordings (
      source_provider, source_recording_id, musicbrainz_recording_id, title, length_ms, artist_credit
    ) VALUES ('controlled_fixture', $1, $2, $3, 3000, $4) RETURNING id`,
    [`recording-${fixture.id}`, randomUUID(), fixture.trackTitle, fixture.artistName],
  );
  await pool.query(
    `INSERT INTO metadata_tracks (
      metadata_medium_id, metadata_recording_id, position, number_text, title, length_ms, artist_credit
    ) VALUES ($1, $2, 1, '1', $3, 3000, $4)`,
    [medium.rows[0].id, recording.rows[0].id, fixture.trackTitle, fixture.artistName],
  );
  const wantedRelease = appUserId
    ? await pool.query(
      `INSERT INTO library_wanted_releases (
        app_user_id, metadata_artist_id, metadata_release_group_id, metadata_release_id,
        wanted_status, expected_track_count, matched_track_count, missing_track_count,
        release_date, release_status, evidence
      ) VALUES ($1, $2, $3, $4, 'missing', 1, 0, 1, '2026-01-01', 'Official', $5::jsonb)
      RETURNING id`,
      [
        appUserId,
        artist.rows[0].id,
        releaseGroup.rows[0].id,
        release.rows[0].id,
        JSON.stringify({ qualityProfile: 'lossless_archive', source: 'controlled_provider_e2e' }),
      ],
    )
    : null;
  await pool.query(
    `INSERT INTO library_discovery_requests (
      metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode, request_status, evidence
    ) VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)`,
    [artist.rows[0].id, releaseGroup.rows[0].id, release.rows[0].id, JSON.stringify({ qualityProfile: 'lossless_archive' })],
  );

  return {
    appUserId,
    metadataArtistId: artist.rows[0].id,
    metadataReleaseGroupId: releaseGroup.rows[0].id,
    metadataReleaseId: release.rows[0].id,
    wantedReleaseId: wantedRelease?.rows[0]?.id ?? null,
  };
}

async function executeDownloadAndReconcile({
  importCandidateModule,
  runId,
  triggerSource,
}) {
  await importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
    requestedCandidateCount: 1,
    runId,
    triggerSource,
  });
  await waitForRun(importCandidateModule.importCandidateExecutionRunStore, runId);
  const executionSummary = await importCandidateModule.importCandidateExecutionSummaryService
    .buildImportCandidateExecutionSummary();
  return importCandidateModule.importCandidateExecutionReconciliationService
    .reconcileImportCandidateExecutionSummary({ executionSummary });
}

async function completeSafeAutoAdd({
  importCandidateModule,
  runId,
  triggerSource,
}) {
  await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
    applySafetyMode: 'safe_auto',
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId,
    triggerSource,
  });
  return waitForRun(importCandidateModule.importCandidateApplyRunStore, runId);
}

async function getSelectedCandidateForSearch(importCandidateModule, sourceSearchId) {
  const selected = await importCandidateModule.importCandidateService.listImportCandidates({
    limit: 10,
    sourceSearchId,
    status: 'selected',
  });
  assert.equal(selected.pagination.total, 1, 'recovery must select exactly one next match within its search scope');
  return selected.candidates[0];
}

async function waitForActivityEvent(activityEventService, { entityId, eventType }) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const feed = await activityEventService.buildActivityFeed({ eventType, limit: 20 });
    const event = feed.events.find((entry) => entry.entityId === entityId);
    if (event) return event;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${eventType} Activity evidence for ${entityId}`);
}

async function runVerification() {
  assert.ok(providerApiKey, 'controlled provider API key is required');
  const pool = getPool();
  const activityModule = createActivityModule();
  const slskdService = createSlskdService({
    getClientConfig: async () => ({
      apiKey: providerApiKey,
      baseUrl: 'http://controlled-provider:5030/api/v0/',
      enabled: true,
      requestTimeoutMs: 5000,
    }),
  });
  const importCandidateModule = createImportCandidateModule({
    getMediaToolingStatus: async () => ({ details: { ffmpegAvailable: true, ffprobeAvailable: true }, status: 'healthy' }),
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    recordSourceUserOutcomeEvidenceFn: async () => null,
    scheduleLibraryScan: async () => null,
    slskdService,
  });
  const libraryModule = createLibraryModule({
    importCandidateAutoDownloadRunService: importCandidateModule.importCandidateAutoDownloadRunService,
    importCandidateAutoSelectionService: importCandidateModule.importCandidateAutoSelectionService,
    importCandidateService: importCandidateModule.importCandidateService,
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    slskdService,
  });
  const acquisitionModule = createAcquisitionModule({
    buildLibraryWantedReleases: libraryModule.routeDependencies.buildLibraryWantedReleases,
  });

  await persistSettings([
    { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
    { namespace: 'paths', settingKey: 'music', value: musicRoot },
    { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
    { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
    { namespace: 'paths', settingKey: 'downloadMappings', value: [{ harmoniarrPrefix: downloadsRoot, slskdPrefix: '\\data\\downloads' }] },
    { namespace: 'library', settingKey: 'discoveryBatchSize', value: 1 },
  ], null, pool);

  const [pipelineFixture, ...catalogFixtures] = controlledProviderFixtureCatalog;
  const recoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'recovery_fallback');
  const sourceDisappearanceFixture = catalogFixtures.find((fixture) => fixture.scenario === 'completed_source_disappears');
  const qualityRecoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'quality_recovery');
  const qualityExhaustionFixture = catalogFixtures.find((fixture) => fixture.scenario === 'quality_exhausted');
  const remainingCatalogFixtures = catalogFixtures.filter((fixture) => (
    fixture.id !== recoveryFixture?.id
      && fixture.id !== sourceDisappearanceFixture?.id
      && fixture.id !== qualityRecoveryFixture?.id
      && fixture.id !== qualityExhaustionFixture?.id
  ));
  await seedDiscoveryRequest(pool, pipelineFixture);
  const dispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(dispatch.candidateCount, 1, `discovery must ingest one controlled candidate: ${JSON.stringify(dispatch)}`);
  const downloadRunId = dispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  assert.ok(downloadRunId, `lossless candidate must automatically enter download handoff: ${JSON.stringify(dispatch)}`);

  const reconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: downloadRunId,
    triggerSource: 'controlled_provider_e2e',
  });
  assert.equal(
    reconciliation.summary.transitioned,
    1,
    `completed controlled transfer must enter import processing: ${JSON.stringify(reconciliation)}`,
  );
  const applyRunId = reconciliation.autoApplyRuns[0]?.runId;
  assert.ok(applyRunId, 'completed controlled transfer must start safe automatic add');
  const applyRun = await completeSafeAutoAdd({
    importCandidateModule,
    runId: applyRunId,
    triggerSource: 'controlled_provider_e2e',
  });
  assert.equal(applyRun.appliedCount, 1, 'verified generated FLAC must be added to the isolated music root');
  const pipelineCandidateId = dispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  const appliedPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: pipelineCandidateId,
  });
  await stat(appliedPreview.files[0]?.libraryTarget?.path);

  assert.ok(recoveryFixture, 'the controlled catalog must include a recovery fixture');
  await seedDiscoveryRequest(pool, recoveryFixture);
  const recoveryDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(recoveryDispatch.candidateCount, 2, 'recovery fixture must ingest a primary and fallback candidate');
  const failedDownloadRunId = recoveryDispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  const primaryCandidateId = recoveryDispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  assert.ok(failedDownloadRunId, 'primary recovery candidate must automatically enter download handoff');
  const primaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: primaryCandidateId,
  });
  assert.equal(primaryCandidate.username, `controlled-${recoveryFixture.id}`, 'the higher-scored primary candidate must be attempted first');
  const failedReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: failedDownloadRunId,
    triggerSource: 'controlled_provider_failure_recovery',
  });
  assert.equal(failedReconciliation.summary.recovered, 1, 'terminal provider failure must promote the next candidate');
  const fallbackDownloadRunId = failedReconciliation.recoveries[0]?.recoveryRunId;
  const fallbackCandidateId = failedReconciliation.recoveries[0]?.nextCandidateId;
  assert.ok(fallbackDownloadRunId, 'recovery must schedule a follow-up download run');
  assert.notEqual(fallbackCandidateId, primaryCandidateId, 'recovery must promote a different candidate');
  const fallbackReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: fallbackDownloadRunId,
    triggerSource: 'controlled_provider_failure_recovery',
  });
  const fallbackApplyRunId = fallbackReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(fallbackApplyRunId, 'recovered transfer must continue into safe automatic add');
  const fallbackApplyRun = await completeSafeAutoAdd({
    importCandidateModule,
    runId: fallbackApplyRunId,
    triggerSource: 'controlled_provider_failure_recovery',
  });
  assert.equal(fallbackApplyRun.appliedCount, 1, 'recovery fallback must be added to the isolated library');
  const finalPrimaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: primaryCandidateId,
  });
  const finalFallbackCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: fallbackCandidateId,
  });
  assert.equal(finalPrimaryCandidate.status, 'failed', 'failed primary candidate must remain blocked from repeat selection');
  assert.equal(finalFallbackCandidate.status, 'applied', 'promoted fallback candidate must complete the full pipeline');

  assert.ok(sourceDisappearanceFixture, 'the controlled catalog must include a completed-source disappearance fixture');
  const libraryFilesBeforeSourceDisappearance = await listFiles(musicRoot);
  await seedDiscoveryRequest(pool, sourceDisappearanceFixture);
  const sourceDisappearanceDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(sourceDisappearanceDispatch.candidateCount, 2, 'completed-source disappearance fixture must ingest a primary and fallback candidate');
  const sourceDisappearanceDownloadRunId = sourceDisappearanceDispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  const sourceDisappearancePrimaryCandidateId = sourceDisappearanceDispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  assert.ok(sourceDisappearanceDownloadRunId, 'completed-source primary must automatically enter download handoff');
  const sourceDisappearancePrimaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sourceDisappearancePrimaryCandidateId,
  });
  assert.equal(
    sourceDisappearancePrimaryCandidate.username,
    `controlled-${sourceDisappearanceFixture.id}`,
    'the higher-scored completed-source primary candidate must be attempted first',
  );
  await importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: sourceDisappearanceDownloadRunId,
    triggerSource: 'controlled_provider_completed_source_disappeared',
  });
  await waitForRun(importCandidateModule.importCandidateExecutionRunStore, sourceDisappearanceDownloadRunId);
  const disappearedSourcePath = buildDownloadedFixturePath(sourceDisappearanceFixture);
  await stat(disappearedSourcePath);
  await rm(disappearedSourcePath);
  await assert.rejects(
    () => stat(disappearedSourcePath),
    { code: 'ENOENT' },
    'the completed primary source must disappear before its safe-add preview',
  );
  const sourceDisappearanceExecutionSummary = await importCandidateModule.importCandidateExecutionSummaryService
    .buildImportCandidateExecutionSummary();
  const sourceDisappearanceReconciliation = await importCandidateModule.importCandidateExecutionReconciliationService
    .reconcileImportCandidateExecutionSummary({ executionSummary: sourceDisappearanceExecutionSummary });
  assert.equal(sourceDisappearanceReconciliation.summary.transitioned, 1, 'the completed transfer must become import pending before recovery');
  assert.equal(sourceDisappearanceReconciliation.summary.autoApplyStarted, 0, 'a missing completed source must not start an apply run');
  assert.equal(sourceDisappearanceReconciliation.summary.autoApplySkipped, 1, 'a missing completed source must be classified before library add');
  assert.equal(sourceDisappearanceReconciliation.summary.recovered, 1, 'a missing completed source must promote its safe fallback');
  const sourceDisappearanceRecovery = sourceDisappearanceReconciliation.recoveries[0];
  const sourceDisappearanceFallbackDownloadRunId = sourceDisappearanceRecovery?.recoveryRunId;
  const sourceDisappearanceFallbackCandidateId = sourceDisappearanceRecovery?.nextCandidateId;
  assert.equal(sourceDisappearanceRecovery?.terminalOutcome, 'source_disappeared', 'the durable recovery outcome must not collapse into a generic failure');
  assert.ok(sourceDisappearanceFallbackDownloadRunId, 'the missing source recovery must schedule a follow-up download run');
  assert.notEqual(sourceDisappearanceFallbackCandidateId, sourceDisappearancePrimaryCandidateId, 'the missing source recovery must promote a different candidate');
  const sourceDisappearancePrimaryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sourceDisappearancePrimaryCandidateId,
  });
  assert.equal(sourceDisappearancePrimaryFinalCandidate.status, 'failed', 'the disappeared completed source must remain blocked from reselection');
  assert.deepEqual(
    await listFiles(musicRoot),
    libraryFilesBeforeSourceDisappearance,
    'the disappeared source must not write a file to the library before fallback',
  );

  await importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: sourceDisappearanceFallbackDownloadRunId,
    triggerSource: 'controlled_provider_completed_source_disappeared',
  });
  await waitForRun(importCandidateModule.importCandidateExecutionRunStore, sourceDisappearanceFallbackDownloadRunId);
  const sourceDisappearanceFallbackExecutionSummary = await importCandidateModule.importCandidateExecutionSummaryService
    .buildImportCandidateExecutionSummary();
  const sourceDisappearanceFallbackReconciliation = await importCandidateModule.importCandidateExecutionReconciliationService
    .reconcileImportCandidateExecutionSummary({ executionSummary: sourceDisappearanceFallbackExecutionSummary });
  const sourceDisappearanceFallbackApplyRunId = sourceDisappearanceFallbackReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(sourceDisappearanceFallbackApplyRunId, 'the recovered completed source fallback must continue into safe automatic add');
  await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
    applySafetyMode: 'safe_auto', executableCandidateCount: 1, requestedCandidateCount: 1, runId: sourceDisappearanceFallbackApplyRunId, triggerSource: 'controlled_provider_completed_source_disappeared',
  });
  const sourceDisappearanceFallbackApplyRun = await waitForRun(
    importCandidateModule.importCandidateApplyRunStore,
    sourceDisappearanceFallbackApplyRunId,
  );
  assert.equal(sourceDisappearanceFallbackApplyRun.appliedCount, 1, 'the missing-source fallback must be added to the isolated library');
  const sourceDisappearanceFallbackCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sourceDisappearanceFallbackCandidateId,
  });
  assert.equal(sourceDisappearanceFallbackCandidate.status, 'applied', 'the promoted missing-source fallback must complete the full pipeline');
  const sourceDisappearanceFallbackPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: sourceDisappearanceFallbackCandidateId,
  });
  await stat(sourceDisappearanceFallbackPreview.files[0]?.libraryTarget?.path);
  assert.equal(
    (await listFiles(musicRoot)).length,
    libraryFilesBeforeSourceDisappearance.length + 1,
    'only the recovered fallback may add one new library file',
  );

  assert.ok(qualityRecoveryFixture, 'the controlled catalog must include a strict-quality recovery fixture');
  const libraryFilesBeforeQualityRecovery = await listFiles(musicRoot);
  await seedDiscoveryRequest(pool, qualityRecoveryFixture);
  const qualityRecoveryDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(qualityRecoveryDispatch.candidateCount, 2, 'strict-quality recovery must ingest a primary and fallback match');
  const qualityRecoveryDownloadRunId = qualityRecoveryDispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  const qualityRecoveryPrimaryCandidateId = qualityRecoveryDispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  assert.ok(qualityRecoveryDownloadRunId, 'the strict-quality primary must automatically enter download handoff');
  const qualityRecoveryPrimaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: qualityRecoveryPrimaryCandidateId,
  });
  assert.equal(
    qualityRecoveryPrimaryCandidate.username,
    `controlled-${qualityRecoveryFixture.id}`,
    'the higher-scored spectrally limited FLAC primary must be attempted before the fallback',
  );
  const qualityRecoveryReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: qualityRecoveryDownloadRunId,
    triggerSource: 'controlled_provider_quality_recovery',
  });
  const qualityRecoveryApplyRunId = qualityRecoveryReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(qualityRecoveryApplyRunId, 'the spectrally limited FLAC primary must reach the actual safe-add quality gate');
  const qualityRecoveryApplyRun = await completeSafeAutoAdd({
    importCandidateModule,
    runId: qualityRecoveryApplyRunId,
    triggerSource: 'controlled_provider_quality_recovery',
  });
  assert.equal(qualityRecoveryApplyRun.appliedCount, 0, 'a spectrally limited FLAC primary must not be added to the library');
  assert.equal(qualityRecoveryApplyRun.qualityBlockedCount, 1, 'the quality gate must record the blocked primary');
  assert.equal(qualityRecoveryApplyRun.qualityRecoveryStartedCount, 1, 'the quality gate must start exactly one eligible fallback');
  assert.equal(qualityRecoveryApplyRun.qualityRecoveryExhaustedCount, 0, 'an eligible fallback must avoid a terminal quality stop');
  const qualityRecoveryPrimaryPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: qualityRecoveryPrimaryCandidateId,
  });
  assert.equal(
    qualityRecoveryPrimaryPreview.files[0]?.inspection?.metadata?.primaryAudioCodec,
    'flac',
    'the fixture must remain a genuine FLAC so strict quality proof, not extension mismatch, rejects it',
  );
  assert.match(
    qualityRecoveryPrimaryPreview.files[0]?.filename ?? '',
    /\.flac$/u,
    'the quality fixture must be treated as a normal FLAC before spectral proof rejects it',
  );
  const qualityRecoveryPrimaryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: qualityRecoveryPrimaryCandidateId,
  });
  assert.equal(qualityRecoveryPrimaryFinalCandidate.status, 'failed', 'the quality-failed primary must remain blocked from reselection');
  assert.deepEqual(
    await listFiles(musicRoot),
    libraryFilesBeforeQualityRecovery,
    'a quality-blocked primary must make no library write before fallback',
  );
  const qualityRecoveryFallbackDownloadRun = await waitForActiveRun(
    importCandidateModule.importCandidateExecutionRunStore,
  );
  const qualityRecoveryFallbackCandidate = await getSelectedCandidateForSearch(
    importCandidateModule,
    qualityRecoveryPrimaryCandidate.sourceSearchId,
  );
  assert.notEqual(
    qualityRecoveryFallbackCandidate.id,
    qualityRecoveryPrimaryCandidateId,
    'strict-quality recovery must select a different match',
  );
  assert.equal(
    qualityRecoveryFallbackCandidate.username,
    `controlled-${qualityRecoveryFixture.id}-fallback`,
    'strict-quality recovery must select the lower-ranked genuine FLAC fallback',
  );
  const qualityRecoveryFallbackReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: qualityRecoveryFallbackDownloadRun.id,
    triggerSource: 'controlled_provider_quality_recovery',
  });
  const qualityRecoveryFallbackApplyRunId = qualityRecoveryFallbackReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(qualityRecoveryFallbackApplyRunId, 'the quality-eligible fallback must continue into safe automatic add');
  const qualityRecoveryFallbackApplyRun = await completeSafeAutoAdd({
    importCandidateModule,
    runId: qualityRecoveryFallbackApplyRunId,
    triggerSource: 'controlled_provider_quality_recovery',
  });
  assert.equal(qualityRecoveryFallbackApplyRun.appliedCount, 1, 'the genuine FLAC fallback must be added to the isolated library');
  const qualityRecoveryFallbackFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: qualityRecoveryFallbackCandidate.id,
  });
  assert.equal(qualityRecoveryFallbackFinalCandidate.status, 'applied', 'the selected quality fallback must complete the full pipeline');
  assert.equal(
    (await listFiles(musicRoot)).length,
    libraryFilesBeforeQualityRecovery.length + 1,
    'only the verified fallback may add a file after a quality stop',
  );

  assert.ok(qualityExhaustionFixture, 'the controlled catalog must include a strict-quality exhaustion fixture');
  const libraryFilesBeforeQualityExhaustion = await listFiles(musicRoot);
  const qualityExhaustionAppUserId = await seedAppUser(pool);
  const qualityExhaustionSeed = await seedDiscoveryRequest(pool, qualityExhaustionFixture, {
    appUserId: qualityExhaustionAppUserId,
  });
  assert.ok(qualityExhaustionSeed.wantedReleaseId, 'strict-quality exhaustion must have a persisted wanted release');
  const qualityExhaustionDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(qualityExhaustionDispatch.candidateCount, 1, 'strict-quality exhaustion must ingest only the spectrally limited primary');
  const qualityExhaustionDownloadRunId = qualityExhaustionDispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  const qualityExhaustionPrimaryCandidateId = qualityExhaustionDispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  assert.ok(qualityExhaustionDownloadRunId, 'the strict-quality exhaustion primary must automatically enter download handoff');
  const qualityExhaustionReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: qualityExhaustionDownloadRunId,
    triggerSource: 'controlled_provider_quality_exhaustion',
  });
  const qualityExhaustionApplyRunId = qualityExhaustionReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(qualityExhaustionApplyRunId, 'the strict-quality exhaustion primary must reach the actual safe-add quality gate');
  const qualityExhaustionApplyRun = await completeSafeAutoAdd({
    importCandidateModule,
    runId: qualityExhaustionApplyRunId,
    triggerSource: 'controlled_provider_quality_exhaustion',
  });
  assert.equal(qualityExhaustionApplyRun.appliedCount, 0, 'strict-quality exhaustion must not add the spectrally limited FLAC');
  assert.equal(qualityExhaustionApplyRun.qualityBlockedCount, 1, 'strict-quality exhaustion must record the quality block');
  assert.equal(qualityExhaustionApplyRun.qualityRecoveryStartedCount, 0, 'strict-quality exhaustion must not invent a fallback run');
  assert.equal(qualityExhaustionApplyRun.qualityRecoveryExhaustedCount, 1, 'strict-quality exhaustion must persist one durable quality stop');
  const qualityExhaustionPrimaryPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: qualityExhaustionPrimaryCandidateId,
  });
  assert.equal(
    qualityExhaustionPrimaryPreview.files[0]?.inspection?.metadata?.primaryAudioCodec,
    'flac',
    'the exhausted fixture must remain a genuine FLAC so the strict spectral gate owns the rejection',
  );
  assert.match(
    qualityExhaustionPrimaryPreview.files[0]?.filename ?? '',
    /\.flac$/u,
    'the exhausted fixture must enter as a normal FLAC before strict spectral proof rejects it',
  );
  const qualityExhaustionPrimaryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: qualityExhaustionPrimaryCandidateId,
  });
  assert.equal(qualityExhaustionPrimaryFinalCandidate.status, 'failed', 'a strict-quality exhausted primary must remain failed');
  const qualityExhaustionFollowUpRun = await importCandidateModule.importCandidateExecutionRunStore.getActiveRun();
  assert.equal(qualityExhaustionFollowUpRun, null, 'strict-quality exhaustion must not enqueue an unsafe fallback download');
  const libraryFilesAfterQualityExhaustion = await listFiles(musicRoot);
  assert.deepEqual(
    libraryFilesAfterQualityExhaustion,
    libraryFilesBeforeQualityExhaustion,
    'strict-quality exhaustion must make no library write',
  );
  const qualityExhaustionQueue = await acquisitionModule.acquisitionPipelineService.listMusicQueueReleases({
    appUserId: qualityExhaustionAppUserId,
    limit: 10,
    offset: 0,
  });
  assert.equal(qualityExhaustionQueue.pagination.total, 1, 'the operator must see its persisted wanted release in Music Queue');
  assert.equal(qualityExhaustionQueue.summary.counts.quality_choice_needed, 1, 'strict-quality exhaustion must project one release-centred quality decision');
  const qualityExhaustionMusicQueueRelease = qualityExhaustionQueue.releases[0];
  assert.equal(qualityExhaustionMusicQueueRelease.id, qualityExhaustionSeed.wantedReleaseId, 'Music Queue must preserve the persisted wanted release ID');
  assert.equal(qualityExhaustionMusicQueueRelease.status.code, 'quality_choice_needed', 'strict-quality exhaustion must project Quality choice needed');
  assert.equal(qualityExhaustionMusicQueueRelease.status.nextAction, 'review_quality_choice', 'the projected quality stop must lead to release review');
  const qualityExhaustionReleaseDetail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
    appUserId: qualityExhaustionAppUserId,
    wantedReleaseId: qualityExhaustionSeed.wantedReleaseId,
  });
  assert.equal(qualityExhaustionReleaseDetail.release.status.code, 'quality_choice_needed', 'the direct Music Queue release read must retain the quality stop');
  await assert.rejects(
    () => acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId: randomUUID(),
      wantedReleaseId: qualityExhaustionSeed.wantedReleaseId,
    }),
    (error) => error?.status === 404 && error?.code === 'music_queue_release_not_found',
    'Music Queue must not expose a wanted release outside its operator scope',
  );
  const qualityExhaustionActivity = await waitForActivityEvent(activityModule.activityEventService, {
    entityId: qualityExhaustionSeed.wantedReleaseId,
    eventType: 'music_queue_quality_blocked',
  });
  assert.equal(qualityExhaustionActivity.entityType, 'wanted_release', 'quality Activity must be correlated to the persisted wanted release');
  assert.equal(qualityExhaustionActivity.extraPayload?.wantedReleaseId, qualityExhaustionSeed.wantedReleaseId, 'quality Activity must retain the release handoff ID');
  assert.deepEqual(qualityExhaustionActivity.extraPayload?.route, {
    name: 'music-queue-release',
    params: { wantedReleaseId: qualityExhaustionSeed.wantedReleaseId },
  }, 'quality Activity must hand the operator back to the release-centred Music Queue detail');
  assert.equal(Object.hasOwn(qualityExhaustionActivity.extraPayload ?? {}, 'folderPath'), false, 'Activity must not expose a provider folder path');
  assert.equal(Object.hasOwn(qualityExhaustionActivity.extraPayload ?? {}, 'username'), false, 'Activity must not expose the provider username');

  let catalogCandidateCount = 8;
  let noResponseCount = 0;
  for (const fixture of remainingCatalogFixtures) {
    const search = await slskdService.startSearch({ query: fixture.searchKey });
    const result = await importCandidateModule.importCandidateService.ingestSlskdSearchResponses({
      albumTitle: fixture.releaseTitle,
      expectedTrackCount: 1,
      expectedTrackTitles: [fixture.trackTitle],
      formatPreferences: { preferredFormat: fixture.format },
      musicQueueContext: { profileCode: 'lossless_archive' },
      searchId: search.id,
    });
    catalogCandidateCount += result.candidateCount;
    if (fixture.scenario === 'no_response') {
      assert.equal(result.candidateCount, 0, 'the no-response fixture must persist no candidate');
      assert.ok(result.ingestionDiagnostics?.reasonCodes?.includes('no_provider_responses'));
      noResponseCount += 1;
    } else {
      assert.equal(result.candidateCount, 1, `fixture ${fixture.id} must ingest exactly one candidate`);
    }
  }

  return {
    catalogFixtures: controlledProviderFixtureCatalog.length,
    catalogCandidates: catalogCandidateCount,
    noResponseFixtures: noResponseCount,
    pipeline: { applyRunId, downloadRunId, finalStatus: 'applied' },
    recovery: {
      fallbackApplyRunId,
      fallbackCandidateId,
      fallbackDownloadRunId,
      primaryCandidateId,
      primaryFinalStatus: finalPrimaryCandidate.status,
    },
    sourceDisappearanceRecovery: {
      fallbackApplyRunId: sourceDisappearanceFallbackApplyRunId,
      fallbackCandidateId: sourceDisappearanceFallbackCandidateId,
      fallbackDownloadRunId: sourceDisappearanceFallbackDownloadRunId,
      primaryCandidateId: sourceDisappearancePrimaryCandidateId,
      primaryFinalStatus: sourceDisappearancePrimaryFinalCandidate.status,
      terminalOutcome: sourceDisappearanceRecovery.terminalOutcome,
    },
    qualityRecovery: {
      fallbackApplyRunId: qualityRecoveryFallbackApplyRunId,
      fallbackFinalStatus: qualityRecoveryFallbackFinalCandidate.status,
      primaryAudioCodec: qualityRecoveryPrimaryPreview.files[0]?.inspection?.metadata?.primaryAudioCodec ?? null,
      primaryCandidateId: qualityRecoveryPrimaryCandidateId,
      primaryFilename: qualityRecoveryPrimaryPreview.files[0]?.filename ?? null,
      primaryFinalStatus: qualityRecoveryPrimaryFinalCandidate.status,
    },
    qualityExhaustion: {
      followUpRunId: qualityExhaustionFollowUpRun?.id ?? null,
      libraryFileCountAfter: libraryFilesAfterQualityExhaustion.length,
      libraryFileCountBefore: libraryFilesBeforeQualityExhaustion.length,
      primaryAudioCodec: qualityExhaustionPrimaryPreview.files[0]?.inspection?.metadata?.primaryAudioCodec ?? null,
      primaryCandidateId: qualityExhaustionPrimaryCandidateId,
      primaryFilename: qualityExhaustionPrimaryPreview.files[0]?.filename ?? null,
      primaryFinalStatus: qualityExhaustionPrimaryFinalCandidate.status,
      qualityRecoveryExhaustedCount: qualityExhaustionApplyRun.qualityRecoveryExhaustedCount,
      activityEntityId: qualityExhaustionActivity.entityId,
      activityRoute: qualityExhaustionActivity.extraPayload?.route ?? null,
      musicQueueNextAction: qualityExhaustionMusicQueueRelease.status.nextAction,
      musicQueueStatus: qualityExhaustionMusicQueueRelease.status.code,
      wantedReleaseId: qualityExhaustionSeed.wantedReleaseId,
    },
  };
}

try {
  process.stdout.write(`${JSON.stringify(await runVerification())}\n`);
} finally {
  await closePool();
}

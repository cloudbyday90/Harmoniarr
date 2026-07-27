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
import { stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

import { controlledProviderFixtureCatalog } from './controlled-provider-fixture-catalog.mjs';
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

async function seedDiscoveryRequest(pool, fixture) {
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
  await pool.query(
    `INSERT INTO library_discovery_requests (
      metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode, request_status, evidence
    ) VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)`,
    [artist.rows[0].id, releaseGroup.rows[0].id, release.rows[0].id, JSON.stringify({ qualityProfile: 'lossless_archive' })],
  );
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

  await persistSettings([
    { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
    { namespace: 'paths', settingKey: 'music', value: musicRoot },
    { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
    { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
    { namespace: 'paths', settingKey: 'downloadMappings', value: [{ harmoniarrPrefix: downloadsRoot, slskdPrefix: '\\data\\downloads' }] },
    { namespace: 'library', settingKey: 'discoveryBatchSize', value: 1 },
  ], null, pool);

  const [pipelineFixture, ...catalogFixtures] = controlledProviderFixtureCatalog;
  await seedDiscoveryRequest(pool, pipelineFixture);
  const dispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(dispatch.candidateCount, 1, `discovery must ingest one controlled candidate: ${JSON.stringify(dispatch)}`);
  const downloadRunId = dispatch.dispatchedSearches[0]?.autoDownloadStart?.runId;
  assert.ok(downloadRunId, `lossless candidate must automatically enter download handoff: ${JSON.stringify(dispatch)}`);

  await importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: downloadRunId,
    triggerSource: 'controlled_provider_e2e',
  });
  await waitForRun(importCandidateModule.importCandidateExecutionRunStore, downloadRunId);
  const executionSummary = await importCandidateModule.importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary();
  const reconciliation = await importCandidateModule.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionSummary({ executionSummary });
  assert.equal(
    reconciliation.summary.transitioned,
    1,
    `completed controlled transfer must enter import processing: ${JSON.stringify({ executionSummary, reconciliation })}`,
  );
  const applyRunId = reconciliation.autoApplyRuns[0]?.runId;
  assert.ok(applyRunId, 'completed controlled transfer must start safe automatic add');
  await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
    applySafetyMode: 'safe_auto', executableCandidateCount: 1, requestedCandidateCount: 1, runId: applyRunId, triggerSource: 'controlled_provider_e2e',
  });
  const applyRun = await waitForRun(importCandidateModule.importCandidateApplyRunStore, applyRunId);
  assert.equal(applyRun.appliedCount, 1, 'verified generated FLAC must be added to the isolated music root');
  const pipelineCandidateId = dispatch.dispatchedSearches[0]?.autoSelection?.selectedCandidateId;
  const appliedPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: pipelineCandidateId,
  });
  await stat(appliedPreview.files[0]?.libraryTarget?.path);

  let catalogCandidateCount = 1;
  let noResponseCount = 0;
  for (const fixture of catalogFixtures) {
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
  };
}

try {
  process.stdout.write(`${JSON.stringify(await runVerification())}\n`);
} finally {
  await closePool();
}

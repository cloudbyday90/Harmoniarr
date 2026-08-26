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
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  buildControlledProviderFixtureFilename,
  controlledProviderFixtureCatalog,
} from './controlled-provider-fixture-catalog.mjs';
import { assertSharedRecoveryDownloaderMusicQueueLinkage } from './controlled-provider-music-queue-linkage-verifier.mjs';
import { createAcquisitionModule } from '/app/server-dist/acquisition/acquisition-module.js';
import { createActivityModule } from '/app/server-dist/activity/activity-module.js';
import { closePool, getPool } from '/app/server-dist/database.js';
import { createDownloaderModule } from '/app/server-dist/downloader/downloader-module.js';
import { createImportCandidateModule } from '/app/server-dist/import-candidates/import-candidate-module.js';
import { createLibraryModule } from '/app/server-dist/library/library-module.js';
import { createSlskdService } from '/app/server-dist/slskd/slskd-service.js';
import { persistSettings } from '/app/server-dist/settings.js';

const downloadsRoot = '/data/downloads';
const musicRoot = '/data/music';
const stagingRoot = '/data/staging';
const providerApiKey = (await readFile('/run/secrets/controlled_provider_api_key', 'utf8')).trim();
const controlledProviderFixtureBaseUrl = 'http://controlled-provider:5030';
const activityEvidenceTimeoutMs = 20_000;

async function waitForRun(runStore, runId) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const run = await runStore.getRunById(runId);
    if (run?.status === 'completed') return run;
    if (['cancelled', 'failed', 'paused'].includes(run?.status)) {
      throw new Error(`Run ${runId} ended as ${run.status}: ${run.errorMessage ?? 'no error message recorded'}`);
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

async function getOperationRunSummary(pool, runId) {
  const result = await pool.query(
    `
      SELECT summary
      FROM operation_runs
      WHERE id = $1
    `,
    [runId],
  );

  return result.rows[0]?.summary ?? {};
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
  const discoveryRequest = await pool.query(
    `INSERT INTO library_discovery_requests (
      metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, search_mode, request_status, evidence
    ) VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)
    RETURNING id`,
    [artist.rows[0].id, releaseGroup.rows[0].id, release.rows[0].id, JSON.stringify({ qualityProfile: 'lossless_archive' })],
  );
  if (wantedRelease?.rows[0]?.id) {
    await pool.query(
      `INSERT INTO library_discovery_request_wanted_release_links (
        discovery_request_id, wanted_release_id, evidence
      ) VALUES ($1, $2, '{}'::jsonb)`,
      [discoveryRequest.rows[0].id, wantedRelease.rows[0].id],
    );
  }

  return {
    appUserId,
    discoveryRequestId: discoveryRequest.rows[0].id,
    metadataArtistId: artist.rows[0].id,
    metadataReleaseGroupId: releaseGroup.rows[0].id,
    metadataReleaseId: release.rows[0].id,
    wantedReleaseId: wantedRelease?.rows[0]?.id ?? null,
  };
}

async function seedSharedOperatorDiscoveryRequest(pool, fixture) {
  const discoverySeed = await seedDiscoveryRequest(pool, fixture);
  const operatorIds = await Promise.all([seedAppUser(pool), seedAppUser(pool)]);
  const privatePolicyMarkers = operatorIds.map((_, index) => `operator-${index + 1}-private-policy-${randomUUID()}`);
  const wantedReleases = [];

  for (const [index, appUserId] of operatorIds.entries()) {
    const wantedRelease = await pool.query(
      `INSERT INTO library_wanted_releases (
        app_user_id, metadata_artist_id, metadata_release_group_id, metadata_release_id,
        wanted_status, expected_track_count, matched_track_count, missing_track_count,
        release_date, release_status, evidence
      ) VALUES ($1, $2, $3, $4, 'missing', 1, 0, 1, '2026-01-01', 'Official', $5::jsonb)
      RETURNING id`,
      [
        appUserId,
        discoverySeed.metadataArtistId,
        discoverySeed.metadataReleaseGroupId,
        discoverySeed.metadataReleaseId,
        JSON.stringify({
          privatePolicyMarker: privatePolicyMarkers[index],
          qualityProfile: index === 0 ? 'lossless_archive' : 'high_quality',
          source: 'controlled_provider_shared_operator_e2e',
        }),
      ],
    );
    const wantedReleaseId = wantedRelease.rows[0].id;
    wantedReleases.push({ appUserId, wantedReleaseId });
    await pool.query(
      `INSERT INTO library_discovery_request_wanted_release_links (
        discovery_request_id, wanted_release_id, evidence
      ) VALUES ($1, $2, $3::jsonb)`,
      [
        discoverySeed.discoveryRequestId,
        wantedReleaseId,
        JSON.stringify({
          musicQueueQualityOverride: {
            privatePolicyMarker: privatePolicyMarkers[index],
          },
        }),
      ],
    );
  }

  return {
    ...discoverySeed,
    privatePolicyMarkers,
    wantedReleases,
  };
}

async function seedPersistedSharedOperatorDiscoveryRequest({
  libraryModule,
  pool,
  fixture,
}) {
  const discoverySeed = await seedDiscoveryRequest(pool, fixture);
  const operatorIds = await Promise.all([seedAppUser(pool), seedAppUser(pool)]);
  const privatePolicyMarkers = operatorIds.map((_, index) => `operator-${index + 1}-private-policy-${randomUUID()}`);

  await Promise.all(operatorIds.map(async (appUserId, index) => {
    await pool.query(
      `
        INSERT INTO operator_artist_monitoring (
          app_user_id,
          metadata_artist_id,
          is_monitored,
          monitored_release_group_types,
          release_scope,
          wanted_automation_mode,
          acquisition_profile_key,
          search_on_add_mode,
          selection_source_mode
        ) VALUES ($1, $2, TRUE, ARRAY['album']::text[], 'current_and_future', 'current_and_future_matching', $3, 'missing_now', 'policy_plus_overrides')
      `,
      [
        appUserId,
        discoverySeed.metadataArtistId,
        index === 0 ? 'lossless_archive' : 'balanced_library',
      ],
    );
  }));

  await libraryModule.libraryWantedReleaseService.reconcileWantedReleases();
  await libraryModule.libraryDiscoveryRequestService.reconcileDiscoveryRequests();

  const wantedReleaseRows = await pool.query(
    `
      SELECT app_user_id AS "appUserId", id AS "wantedReleaseId"
      FROM library_wanted_releases
      WHERE metadata_release_id = $1
        AND app_user_id = ANY($2::uuid[])
    `,
    [discoverySeed.metadataReleaseId, operatorIds],
  );
  assert.equal(wantedReleaseRows.rowCount, operatorIds.length, 'the persisted shared fixture must materialize every monitored operator release');
  const wantedReleaseIdByOperatorId = new Map(wantedReleaseRows.rows.map((row) => [row.appUserId, row.wantedReleaseId]));
  const wantedReleases = operatorIds.map((appUserId, index) => ({
    appUserId,
    wantedReleaseId: wantedReleaseIdByOperatorId.get(appUserId),
    privatePolicyMarker: privatePolicyMarkers[index],
  }));

  for (const { privatePolicyMarker, wantedReleaseId } of wantedReleases) {
    assert.ok(wantedReleaseId, 'every persisted shared operator must receive a wanted release identity');
    await pool.query(
      `
        UPDATE library_discovery_request_wanted_release_links AS release_link
        SET evidence = COALESCE(release_link.evidence, '{}'::jsonb) || jsonb_build_object(
          'musicQueueQualityOverride',
          jsonb_build_object('privatePolicyMarker', $3::text)
        )
        FROM library_discovery_requests AS discovery_request
        WHERE release_link.discovery_request_id = discovery_request.id
          AND discovery_request.metadata_release_id = $1
          AND release_link.wanted_release_id = $2
      `,
      [discoverySeed.metadataReleaseId, wantedReleaseId, privatePolicyMarker],
    );
  }

  return {
    ...discoverySeed,
    privatePolicyMarkers,
    wantedReleases,
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
  const executionRunDetail = await importCandidateModule.importCandidateExecutionSummaryService
    .buildImportCandidateExecutionRunDetail({ runId });
  return importCandidateModule.importCandidateExecutionReconciliationService
    .reconcileImportCandidateExecutionSummary({ executionSummary: { currentRun: executionRunDetail.run } });
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
  const deadline = Date.now() + activityEvidenceTimeoutMs;
  let observedEvents = [];
  while (Date.now() < deadline) {
    const feed = await activityEventService.buildActivityFeed({ eventType, limit: 20 });
    observedEvents = feed.events.map((entry) => ({
      entityId: entry.entityId,
      entityType: entry.entityType,
      eventType: entry.eventType,
    }));
    const event = feed.events.find((entry) => entry.entityId === entityId);
    if (event) return event;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${eventType} Activity evidence for ${entityId}; observed ${JSON.stringify(observedEvents)}`);
}

async function waitForActivityEvents(activityEventService, {
  entityIds,
  eventType,
  operationRunId = null,
}) {
  const expectedEntityIds = [...new Set(entityIds)].sort();
  const deadline = Date.now() + activityEvidenceTimeoutMs;
  while (Date.now() < deadline) {
    const feed = await activityEventService.buildActivityFeed({ eventType, limit: 50 });
    const events = feed.events.filter((entry) => (
      expectedEntityIds.includes(entry.entityId)
        && (operationRunId == null || entry.extraPayload?.operationRunId === operationRunId)
    ));
    if (new Set(events.map((entry) => entry.entityId)).size === expectedEntityIds.length) {
      return events;
    }
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${eventType} Activity evidence for ${expectedEntityIds.join(', ')}`);
}

async function getControlledProviderFixtureEvidence(fixtureId) {
  const response = await fetch(
    `${controlledProviderFixtureBaseUrl}/_fixture/evidence?fixtureId=${encodeURIComponent(fixtureId)}`,
    { headers: { 'X-API-Key': providerApiKey } },
  );
  assert.equal(response.status, 200, `controlled provider must expose fixture evidence for ${fixtureId}`);
  return response.json();
}

function assertSharedCandidateIsRedacted({ candidate, sharedSeed, wantedReleaseIds }) {
  assert.deepEqual(
    candidate.normalizedPayload?.musicQueue,
    {
      profileCode: 'lossless_archive',
      wantedReleaseId: wantedReleaseIds[0],
      wantedReleaseIds,
    },
    'the shared candidate must retain only the common quality profile and release identities',
  );
  const candidatePayload = JSON.stringify(candidate);
  for (const { appUserId } of sharedSeed.wantedReleases) {
    assert.equal(candidatePayload.includes(appUserId), false, 'candidate payloads must not expose operator identities');
  }
  for (const privatePolicyMarker of sharedSeed.privatePolicyMarkers) {
    assert.equal(candidatePayload.includes(privatePolicyMarker), false, 'candidate payloads must not expose operator policy details');
  }
}

function assertSharedActivityFanoutIsRedacted({ activities, sharedSeed, wantedReleaseIds }) {
  assert.equal(activities.length, wantedReleaseIds.length, 'each shared release must receive one lifecycle Activity row');

  for (const activity of activities) {
    const activityPayload = JSON.stringify(activity);
    assert.equal(activity.entityType, 'wanted_release', 'shared Music Queue activity must stay release-centred');
    assert.ok(wantedReleaseIds.includes(activity.entityId), 'shared Music Queue activity must retain its own release identity');
    assert.equal(activity.extraPayload?.wantedReleaseId, activity.entityId, 'Activity must retain its own release handoff ID');
    assert.equal(Object.hasOwn(activity.extraPayload ?? {}, 'wantedReleaseIds'), false, 'Activity must not expose sibling release correlations');
    for (const siblingWantedReleaseId of wantedReleaseIds) {
      if (siblingWantedReleaseId !== activity.entityId) {
        assert.equal(activityPayload.includes(siblingWantedReleaseId), false, 'Activity must not expose a sibling release identity');
      }
    }
    for (const { appUserId } of sharedSeed.wantedReleases) {
      assert.equal(activityPayload.includes(appUserId), false, 'Activity must not expose operator identities');
    }
    for (const privatePolicyMarker of sharedSeed.privatePolicyMarkers) {
      assert.equal(activityPayload.includes(privatePolicyMarker), false, 'Activity must not expose operator policy details');
    }
  }
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
      requestTimeoutMs: 20_000,
    }),
  });
  let libraryModule = null;
  const importCandidateModule = createImportCandidateModule({
    getMediaToolingStatus: async () => ({ details: { ffmpegAvailable: true, ffprobeAvailable: true }, status: 'healthy' }),
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    recordSourceUserOutcomeEvidenceFn: async () => null,
    scheduleLibraryScan: async () => null,
    scheduleDownloadRecoveryRediscovery: async (payload) => {
      if (!libraryModule?.libraryDiscoveryRediscoveryService?.scheduleDownloadRecoveryRediscovery) {
        throw new Error('Library discovery rediscovery service is not initialized');
      }

      return libraryModule.libraryDiscoveryRediscoveryService.scheduleDownloadRecoveryRediscovery(payload);
    },
    slskdService,
  });
  libraryModule = createLibraryModule({
    importCandidateAutoDownloadRunService: importCandidateModule.importCandidateAutoDownloadRunService,
    importCandidateAutoSelectionService: importCandidateModule.importCandidateAutoSelectionService,
    importCandidateService: importCandidateModule.importCandidateService,
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    slskdService,
  });
  const acquisitionModule = createAcquisitionModule({
    buildLibraryWantedReleases: libraryModule.routeDependencies.buildLibraryWantedReleases,
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    requestMusicQueueRediscovery: libraryModule.libraryDiscoveryRequestStore.requestMusicQueueRediscovery,
    startLibraryDiscoveryRun: libraryModule.routeDependencies.startLibraryDiscoveryRun,
  });
  const downloaderModule = createDownloaderModule({ slskdService });

  await persistSettings([
    { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
    { namespace: 'paths', settingKey: 'music', value: musicRoot },
    { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
    { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
    { namespace: 'paths', settingKey: 'downloadMappings', value: [{ harmoniarrPrefix: downloadsRoot, slskdPrefix: '\\data\\downloads' }] },
    { namespace: 'library', settingKey: 'discoveryBatchSize', value: 1 },
  ], null, pool);

  const [pipelineFixture, ...catalogFixtures] = controlledProviderFixtureCatalog;
  const sharedDiscoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'lossless');
  const sharedBoundedStopFixture = catalogFixtures.find((fixture) => fixture.scenario === 'shared_recovery_exhausted');
  const sharedRecoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'shared_recovery_fallback');
  const recoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'recovery_fallback');
  const sourceDisappearanceFixture = catalogFixtures.find((fixture) => fixture.scenario === 'completed_source_disappears');
  const qualityRecoveryFixture = catalogFixtures.find((fixture) => fixture.scenario === 'quality_recovery');
  const qualityExhaustionFixture = catalogFixtures.find((fixture) => fixture.scenario === 'quality_exhausted');
  const remainingCatalogFixtures = catalogFixtures.filter((fixture) => (
    fixture.id !== recoveryFixture?.id
      && fixture.id !== sourceDisappearanceFixture?.id
      && fixture.id !== qualityRecoveryFixture?.id
      && fixture.id !== qualityExhaustionFixture?.id
      && fixture.id !== sharedBoundedStopFixture?.id
      && fixture.id !== sharedRecoveryFixture?.id
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
  assert.equal(qualityExhaustionQueue.summary.counts.needs_help_adding, 1, 'strict-quality exhaustion must project one release-centred add recovery');
  const qualityExhaustionMusicQueueRelease = qualityExhaustionQueue.releases[0];
  assert.equal(qualityExhaustionMusicQueueRelease.id, qualityExhaustionSeed.wantedReleaseId, 'Music Queue must preserve the persisted wanted release ID');
  assert.equal(qualityExhaustionMusicQueueRelease.status.code, 'needs_help_adding', 'strict-quality exhaustion must project Needs help');
  assert.equal(qualityExhaustionMusicQueueRelease.status.nextAction, 'review_add_plan', 'the projected add stop must lead to release recovery');
  const qualityExhaustionReleaseDetail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
    appUserId: qualityExhaustionAppUserId,
    wantedReleaseId: qualityExhaustionSeed.wantedReleaseId,
  });
  assert.equal(qualityExhaustionReleaseDetail.release.status.code, 'needs_help_adding', 'the direct Music Queue release read must retain the add recovery');
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
    eventType: 'music_queue_import_blocked',
  });
  assert.equal(qualityExhaustionActivity.entityType, 'wanted_release', 'add-recovery Activity must be correlated to the persisted wanted release');
  assert.equal(qualityExhaustionActivity.extraPayload?.wantedReleaseId, qualityExhaustionSeed.wantedReleaseId, 'add-recovery Activity must retain the release handoff ID');
  assert.equal(qualityExhaustionActivity.extraPayload?.addBlockerCode, 'media_verification', 'add-recovery Activity must retain the safe blocker category');
  assert.equal(Object.hasOwn(qualityExhaustionActivity.extraPayload ?? {}, 'folderPath'), false, 'Activity must not expose a provider folder path');
  assert.equal(Object.hasOwn(qualityExhaustionActivity.extraPayload ?? {}, 'username'), false, 'Activity must not expose the provider username');

  assert.ok(sharedDiscoveryFixture, 'the controlled catalog must include a shared-discovery fixture');
  const sharedDiscoverySeed = await seedSharedOperatorDiscoveryRequest(pool, sharedDiscoveryFixture);
  const sharedDiscoveryEvidenceBefore = await getControlledProviderFixtureEvidence(sharedDiscoveryFixture.id);
  const sharedDiscoveryDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(
    sharedDiscoveryDispatch.candidateCount,
    1,
    'one global discovery request linked to two operators must ingest one candidate',
  );
  const sharedDiscoverySearch = sharedDiscoveryDispatch.dispatchedSearches[0];
  const sharedDiscoveryDownloadRunId = sharedDiscoverySearch?.autoDownloadStart?.runId;
  const sharedDiscoveryCandidateId = sharedDiscoverySearch?.autoSelection?.selectedCandidateId;
  assert.ok(sharedDiscoveryDownloadRunId, 'the shared discovery candidate must automatically enter download handoff');
  assert.ok(sharedDiscoveryCandidateId, 'the shared discovery candidate must remain identifiable without an operator policy payload');

  const sharedCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedDiscoveryCandidateId,
  });
  const sharedWantedReleaseIds = sharedDiscoverySeed.wantedReleases.map(({ wantedReleaseId }) => wantedReleaseId);
  assertSharedCandidateIsRedacted({
    candidate: sharedCandidate,
    sharedSeed: sharedDiscoverySeed,
    wantedReleaseIds: sharedWantedReleaseIds,
  });

  const sharedDiscoveryReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: sharedDiscoveryDownloadRunId,
    triggerSource: 'controlled_provider_shared_discovery',
  });
  const sharedDiscoveryApplyRunId = sharedDiscoveryReconciliation.autoApplyRuns[0]?.runId;
  assert.ok(sharedDiscoveryApplyRunId, 'a completed shared transfer must start one safe automatic add run');
  const sharedDiscoveryEvidenceAfter = await getControlledProviderFixtureEvidence(sharedDiscoveryFixture.id);
  assert.equal(
    sharedDiscoveryEvidenceAfter.searchCount - sharedDiscoveryEvidenceBefore.searchCount,
    1,
    'two operator links must issue one provider search',
  );
  assert.equal(
    sharedDiscoveryEvidenceAfter.transferCount - sharedDiscoveryEvidenceBefore.transferCount,
    1,
    'two operator links must queue one provider transfer',
  );

  const sharedMusicQueueOutcomes = await Promise.all(sharedDiscoverySeed.wantedReleases.map(async ({
    appUserId,
    wantedReleaseId,
  }) => {
    const detail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId,
      wantedReleaseId,
    });
    assert.equal(detail.release.id, wantedReleaseId, 'each operator must retain its own wanted release detail');
    assert.equal(detail.release.status.code, 'ready_to_add', 'each operator must see the shared download as ready to add');
    assert.equal(detail.release.status.nextAction, 'add_to_library', 'each operator must receive the same next action');
    return {
      nextAction: detail.release.status.nextAction,
      status: detail.release.status.code,
      wantedReleaseId,
    };
  }));
  await Promise.all(sharedDiscoverySeed.wantedReleases.map(async ({ appUserId, wantedReleaseId }, index) => {
    const other = sharedDiscoverySeed.wantedReleases[(index + 1) % sharedDiscoverySeed.wantedReleases.length];
    await assert.rejects(
      () => acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
        appUserId,
        wantedReleaseId: other.wantedReleaseId,
      }),
      (error) => error?.status === 404 && error?.code === 'music_queue_release_not_found',
      'an operator must not read another operator\'s shared-release detail',
    );
  }));

  const sharedActivities = await waitForActivityEvents(activityModule.activityEventService, {
    entityIds: sharedWantedReleaseIds,
    eventType: 'download_completed',
  });
  assertSharedActivityFanoutIsRedacted({
    activities: sharedActivities,
    sharedSeed: sharedDiscoverySeed,
    wantedReleaseIds: sharedWantedReleaseIds,
  });

  assert.ok(sharedRecoveryFixture, 'the controlled catalog must include a shared recovery fixture');
  const sharedRecoverySeed = await seedSharedOperatorDiscoveryRequest(pool, sharedRecoveryFixture);
  const sharedRecoveryWantedReleaseIds = sharedRecoverySeed.wantedReleases.map(({ wantedReleaseId }) => wantedReleaseId);
  const sharedRecoveryEvidenceBefore = await getControlledProviderFixtureEvidence(sharedRecoveryFixture.id);
  const sharedRecoveryDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(
    sharedRecoveryDispatch.candidateCount,
    2,
    'one shared recovery request must ingest one primary and one eligible fallback candidate',
  );
  const sharedRecoverySearch = sharedRecoveryDispatch.dispatchedSearches[0];
  const sharedRecoveryPrimaryRunId = sharedRecoverySearch?.autoDownloadStart?.runId;
  const sharedRecoveryPrimaryCandidateId = sharedRecoverySearch?.autoSelection?.selectedCandidateId;
  assert.ok(sharedRecoveryPrimaryRunId, 'the shared recovery primary must automatically enter download handoff');
  assert.ok(sharedRecoveryPrimaryCandidateId, 'the shared recovery primary must remain identifiable without an operator policy payload');

  const sharedRecoveryPrimaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedRecoveryPrimaryCandidateId,
  });
  assert.equal(
    sharedRecoveryPrimaryCandidate.username,
    `controlled-${sharedRecoveryFixture.id}`,
    'the higher-scored shared recovery primary must be attempted before the fallback',
  );
  assertSharedCandidateIsRedacted({
    candidate: sharedRecoveryPrimaryCandidate,
    sharedSeed: sharedRecoverySeed,
    wantedReleaseIds: sharedRecoveryWantedReleaseIds,
  });

  const sharedRecoveryReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: sharedRecoveryPrimaryRunId,
    triggerSource: 'controlled_provider_shared_recovery',
  });
  assert.equal(sharedRecoveryReconciliation.summary.recovered, 1, 'one shared primary failure must promote one fallback');
  assert.equal(sharedRecoveryReconciliation.recoveries.length, 1, 'one shared provider failure must create one recovery chain');
  const sharedRecoveryFallbackRunId = sharedRecoveryReconciliation.recoveries[0]?.recoveryRunId;
  const sharedRecoveryFallbackCandidateId = sharedRecoveryReconciliation.recoveries[0]?.nextCandidateId;
  assert.ok(sharedRecoveryFallbackRunId, 'shared recovery must schedule one fallback download run');
  assert.notEqual(
    sharedRecoveryFallbackCandidateId,
    sharedRecoveryPrimaryCandidateId,
    'shared recovery must promote a different candidate',
  );

  const sharedRecoveryPrimaryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedRecoveryPrimaryCandidateId,
  });
  assert.equal(sharedRecoveryPrimaryFinalCandidate.status, 'failed', 'the failed shared primary must remain blocked from reselection');
  const sharedTryingNextOutcomes = await Promise.all(sharedRecoverySeed.wantedReleases.map(async ({
    appUserId,
    wantedReleaseId,
  }) => {
    const detail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId,
      wantedReleaseId,
    });
    assert.equal(detail.release.status.code, 'trying_next_match', 'each operator must see the shared fallback is being prepared');
    assert.equal(detail.release.status.nextAction, 'view_recovery', 'each operator must receive the same automatic recovery handoff');
    return detail.release.id;
  }));
  const sharedRecoveryActivities = await waitForActivityEvents(activityModule.activityEventService, {
    entityIds: sharedRecoveryWantedReleaseIds,
    eventType: 'music_queue_match_retrying',
    operationRunId: sharedRecoveryPrimaryRunId,
  });
  assertSharedActivityFanoutIsRedacted({
    activities: sharedRecoveryActivities,
    sharedSeed: sharedRecoverySeed,
    wantedReleaseIds: sharedRecoveryWantedReleaseIds,
  });

  await importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
    requestedCandidateCount: 1,
    runId: sharedRecoveryFallbackRunId,
    triggerSource: 'controlled_provider_shared_recovery',
  });
  await waitForRun(importCandidateModule.importCandidateExecutionRunStore, sharedRecoveryFallbackRunId);
  const sharedRecoveryEvidenceAfter = await getControlledProviderFixtureEvidence(sharedRecoveryFixture.id);
  assert.equal(
    sharedRecoveryEvidenceAfter.searchCount - sharedRecoveryEvidenceBefore.searchCount,
    1,
    'two shared operator links must issue one provider search before recovery',
  );
  assert.equal(
    sharedRecoveryEvidenceAfter.transferCount - sharedRecoveryEvidenceBefore.transferCount,
    2,
    'the shared retry chain must queue only its failed primary and selected fallback transfers',
  );
  const sharedRecoveryFallbackCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedRecoveryFallbackCandidateId,
  });
  assert.equal(sharedRecoveryFallbackCandidate.status, 'downloading', 'the shared fallback must become the only active download');
  const sharedRecoveryDownloaderMusicQueueLinkage = await assertSharedRecoveryDownloaderMusicQueueLinkage({
    buildDownloaderQueue: downloaderModule.routeDependencies.buildDownloaderQueue,
    fallbackCandidateId: sharedRecoveryFallbackCandidateId,
    sharedSeed: sharedRecoverySeed,
  });

  const sharedDownloadingOutcomes = await Promise.all(sharedRecoverySeed.wantedReleases.map(async ({
    appUserId,
    wantedReleaseId,
  }) => {
    const detail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId,
      wantedReleaseId,
    });
    assert.equal(detail.release.id, wantedReleaseId, 'each operator must retain its own shared recovery detail');
    assert.equal(detail.release.status.code, 'downloading', 'each operator must see the shared fallback download start');
    assert.equal(detail.release.status.nextAction, 'open_downloader', 'each operator must receive the normal downloader handoff');
    return detail.release.id;
  }));
  const sharedFallbackActivities = await waitForActivityEvents(activityModule.activityEventService, {
    entityIds: sharedRecoveryWantedReleaseIds,
    eventType: 'music_queue_download_started',
    operationRunId: sharedRecoveryFallbackRunId,
  });
  assertSharedActivityFanoutIsRedacted({
    activities: sharedFallbackActivities,
    sharedSeed: sharedRecoverySeed,
    wantedReleaseIds: sharedRecoveryWantedReleaseIds,
  });
  await Promise.all(sharedRecoverySeed.wantedReleases.map(async ({ appUserId }, index) => {
    const other = sharedRecoverySeed.wantedReleases[(index + 1) % sharedRecoverySeed.wantedReleases.length];
    await assert.rejects(
      () => acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
        appUserId,
        wantedReleaseId: other.wantedReleaseId,
      }),
      (error) => error?.status === 404 && error?.code === 'music_queue_release_not_found',
      'an operator must not read another operator\'s shared recovery detail',
    );
  }));

  assert.ok(sharedBoundedStopFixture, 'the controlled catalog must include a shared bounded-stop fixture');
  const sharedBoundedStopSeed = await seedPersistedSharedOperatorDiscoveryRequest({
    fixture: sharedBoundedStopFixture,
    libraryModule,
    pool,
  });
  const sharedBoundedStopWantedReleaseIds = sharedBoundedStopSeed.wantedReleases.map(({ wantedReleaseId }) => wantedReleaseId);
  const sharedBoundedStopEvidenceBefore = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  const sharedBoundedStopDispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  assert.equal(
    sharedBoundedStopDispatch.candidateCount,
    1,
    'one shared bounded-stop request must ingest only its failing primary match',
  );
  const sharedBoundedStopSearch = sharedBoundedStopDispatch.dispatchedSearches[0];
  assert.equal(
    sharedBoundedStopSearch?.metadataReleaseId,
    sharedBoundedStopSeed.metadataReleaseId,
    'the shared bounded-stop fixture must dispatch its own global discovery request',
  );
  const sharedBoundedStopPrimaryRunId = sharedBoundedStopSearch?.autoDownloadStart?.runId;
  const sharedBoundedStopPrimaryCandidateId = sharedBoundedStopSearch?.autoSelection?.selectedCandidateId;
  assert.ok(sharedBoundedStopPrimaryRunId, 'the shared bounded-stop primary must automatically enter download handoff');
  assert.ok(sharedBoundedStopPrimaryCandidateId, 'the shared bounded-stop primary must be available for redaction verification');
  const sharedBoundedStopPrimaryCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedBoundedStopPrimaryCandidateId,
  });
  assertSharedCandidateIsRedacted({
    candidate: sharedBoundedStopPrimaryCandidate,
    sharedSeed: sharedBoundedStopSeed,
    wantedReleaseIds: sharedBoundedStopWantedReleaseIds,
  });
  assert.deepEqual(
    sharedBoundedStopPrimaryCandidate.normalizedPayload?.discoveryScope,
    { metadataReleaseId: sharedBoundedStopSeed.metadataReleaseId },
    'the redacted shared candidate must retain only the metadata-release recovery scope',
  );
  const sharedBoundedStopRetryBudgetUpdate = await pool.query(
    `
      UPDATE library_discovery_requests
      SET research_attempt_count = $2
      WHERE metadata_release_id = $1
      RETURNING
        research_attempt_count AS "researchAttemptCount",
        search_mode AS "searchMode"
    `,
    [sharedBoundedStopSeed.metadataReleaseId, 2],
  );
  assert.equal(sharedBoundedStopRetryBudgetUpdate.rowCount, 1, 'the shared bounded-stop fixture must preload exactly one current global retry budget');
  assert.equal(sharedBoundedStopRetryBudgetUpdate.rows[0]?.searchMode, 'automatic', 'the shared bounded-stop fixture must retain automatic discovery mode');
  assert.equal(sharedBoundedStopRetryBudgetUpdate.rows[0]?.researchAttemptCount, 2, 'the shared bounded-stop fixture must preload the production retry cap');

  const sharedBoundedStopReconciliation = await executeDownloadAndReconcile({
    importCandidateModule,
    runId: sharedBoundedStopPrimaryRunId,
    triggerSource: 'controlled_provider_shared_bounded_stop',
  });
  assert.equal(sharedBoundedStopReconciliation.summary.recovered, 0, 'an exhausted shared retry budget must not create a fallback download');
  assert.equal(sharedBoundedStopReconciliation.summary.rediscovered, 0, 'an exhausted shared retry budget must not create another rediscovery run');
  const sharedBoundedStopPrimaryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedBoundedStopPrimaryCandidateId,
  });
  assert.equal(sharedBoundedStopPrimaryFinalCandidate.status, 'failed', 'the exhausted shared primary must remain blocked from reselection');
  const sharedBoundedStopActiveRun = await importCandidateModule.importCandidateExecutionRunStore.getActiveRun();
  assert.equal(sharedBoundedStopActiveRun, null, 'an exhausted shared retry budget must not leave a fallback worker active');

  const sharedBoundedStopRequestStateResult = await pool.query(
    `
      SELECT
        blocked_reason AS "blockedReason",
        evidence,
        next_search_after AS "nextSearchAfter",
        request_status AS "requestStatus",
        research_attempt_count AS "researchAttemptCount"
      FROM library_discovery_requests
      WHERE metadata_release_id = $1
    `,
    [sharedBoundedStopSeed.metadataReleaseId],
  );
  const sharedBoundedStopRequestState = sharedBoundedStopRequestStateResult.rows[0];
  assert.equal(sharedBoundedStopRequestState?.requestStatus, 'blocked', 'the shared request must persist its terminal bounded-stop state');
  assert.equal(sharedBoundedStopRequestState?.blockedReason, 'download_recovery_exhausted', 'the shared request must identify the bounded-stop reason');
  assert.equal(sharedBoundedStopRequestState?.nextSearchAfter, null, 'the shared bounded stop must not leave an automatic search scheduled');
  assert.equal(sharedBoundedStopRequestState?.researchAttemptCount, 2, 'the shared bounded stop must retain its global retry budget');
  assert.equal(
    sharedBoundedStopRequestState?.evidence?.downloadRecoveryExhausted?.researchAttemptCount,
    2,
    'the shared bounded stop must record only the global retry evidence',
  );

  const sharedBoundedStopOutcomes = await Promise.all(sharedBoundedStopSeed.wantedReleases.map(async ({
    appUserId,
    wantedReleaseId,
  }) => {
    const detail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId,
      wantedReleaseId,
    });
    assert.equal(detail.release.id, wantedReleaseId, 'each operator must retain its own bounded-stop release detail');
    assert.equal(detail.release.status.code, 'no_matches_left', 'each operator must see the terminal shared recovery stop');
    assert.equal(detail.release.status.nextAction, 'try_again', 'each operator must receive the normal release-level Search again action');
    return detail.release.id;
  }));
  const sharedBoundedStopActivities = await waitForActivityEvents(activityModule.activityEventService, {
    entityIds: sharedBoundedStopWantedReleaseIds,
    eventType: 'music_queue_no_matches_left',
    operationRunId: sharedBoundedStopPrimaryRunId,
  });
  assertSharedActivityFanoutIsRedacted({
    activities: sharedBoundedStopActivities,
    sharedSeed: sharedBoundedStopSeed,
    wantedReleaseIds: sharedBoundedStopWantedReleaseIds,
  });
  for (const activity of sharedBoundedStopActivities) {
    assert.equal(activity.extraPayload?.rediscoveryExhausted, true, 'bounded-stop Activity must identify the terminal automatic-recovery outcome');
    assert.equal(activity.extraPayload?.rediscoveryScheduled, false, 'bounded-stop Activity must not imply a hidden retry');
  }
  await Promise.all(sharedBoundedStopSeed.wantedReleases.map(async ({ appUserId }, index) => {
    const other = sharedBoundedStopSeed.wantedReleases[(index + 1) % sharedBoundedStopSeed.wantedReleases.length];
    await assert.rejects(
      () => acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
        appUserId,
        wantedReleaseId: other.wantedReleaseId,
      }),
      (error) => error?.status === 404 && error?.code === 'music_queue_release_not_found',
      'an operator must not read another operator\'s shared bounded-stop detail',
    );
  }));

  const sharedBoundedStopEvidenceAfterFailure = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  assert.equal(
    sharedBoundedStopEvidenceAfterFailure.searchCount - sharedBoundedStopEvidenceBefore.searchCount,
    1,
    'two operator links must issue one provider search before the bounded stop',
  );
  assert.equal(
    sharedBoundedStopEvidenceAfterFailure.transferCount - sharedBoundedStopEvidenceBefore.transferCount,
    1,
    'the bounded stop must queue only the failed shared primary transfer',
  );
  const sharedBoundedStopRepeatDispatches = [
    await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests(),
    await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests(),
  ];
  assert.deepEqual(
    sharedBoundedStopRepeatDispatches.map((result) => result.candidateCount),
    [0, 0],
    'repeat dispatches after the bounded stop must not start duplicate fallback or rediscovery work',
  );
  const sharedBoundedStopEvidenceAfterRepeat = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  assert.equal(
    sharedBoundedStopEvidenceAfterRepeat.searchCount,
    sharedBoundedStopEvidenceAfterFailure.searchCount,
    'repeat dispatches after the bounded stop must not issue another provider search',
  );
  assert.equal(
    sharedBoundedStopEvidenceAfterRepeat.transferCount,
    sharedBoundedStopEvidenceAfterFailure.transferCount,
    'repeat dispatches after the bounded stop must not queue another provider transfer',
  );

  const sharedManualRestartResults = await Promise.all(sharedBoundedStopSeed.wantedReleases.map(({
    appUserId,
    wantedReleaseId,
  }) => acquisitionModule.acquisitionPipelineService.requestMusicQueueReleaseRediscovery({
    actorUserId: appUserId,
    appUserId,
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId,
  })));
  const sharedManualRestartStarted = sharedManualRestartResults.filter((result) => !result.action.restartAlreadyQueued);
  const sharedManualRestartAlreadyQueued = sharedManualRestartResults.filter((result) => result.action.restartAlreadyQueued);
  assert.equal(sharedManualRestartStarted.length, 1, 'two owners must transition one shared bounded stop only once');
  assert.equal(sharedManualRestartAlreadyQueued.length, 1, 'the racing owner must observe the already queued shared restart');
  const sharedManualRestartInitiator = sharedManualRestartStarted[0];
  const sharedManualRestartInitiatorWantedReleaseId = sharedManualRestartInitiator.action.wantedReleaseId;
  const sharedManualRestartRunId = sharedManualRestartInitiator.run?.id;
  assert.ok(sharedManualRestartRunId, 'the accepted shared restart must create one discovery run');
  assert.equal(sharedManualRestartAlreadyQueued[0].action.discoveryRunId, null, 'the already queued restart must not create a duplicate run');
  assert.equal(sharedManualRestartAlreadyQueued[0].action.dispatchAlreadyActive, false, 'the already queued restart must not report a second dispatcher result');
  assert.equal(sharedManualRestartInitiator.rediscovery.researchAttemptCount, 0, 'the accepted shared restart must reset the global recovery budget');
  assert.equal(sharedManualRestartInitiator.rediscovery.searchAttemptCount, 0, 'the accepted shared restart must reset the global search counter');

  const sharedManualRestartStateResult = await pool.query(
    `
      SELECT
        blocked_reason AS "blockedReason",
        evidence,
        request_status AS "requestStatus",
        research_attempt_count AS "researchAttemptCount",
        search_attempt_count AS "searchAttemptCount"
      FROM library_discovery_requests
      WHERE metadata_release_id = $1
    `,
    [sharedBoundedStopSeed.metadataReleaseId],
  );
  const sharedManualRestartQueuedState = sharedManualRestartStateResult.rows[0];
  assert.equal(sharedManualRestartQueuedState?.requestStatus, 'ready', 'the accepted restart must reopen the global request for automatic dispatch');
  assert.equal(sharedManualRestartQueuedState?.blockedReason, null, 'the accepted restart must clear the bounded-stop reason');
  assert.equal(sharedManualRestartQueuedState?.researchAttemptCount, 0, 'the accepted restart must clear the global recovery budget');
  assert.equal(sharedManualRestartQueuedState?.searchAttemptCount, 0, 'the accepted restart must clear the global search attempt count');
  assert.equal(sharedManualRestartQueuedState?.evidence?.downloadRecoveryExhausted, undefined, 'the accepted restart must remove terminal recovery evidence');
  assert.equal(sharedManualRestartQueuedState?.evidence?.musicQueueRediscovery?.reasonCode, 'music_queue_try_again', 'the accepted restart must retain only safe global restart context');

  const sharedManualRestartLinkState = await pool.query(
    `
      SELECT
        wanted_release_id AS "wantedReleaseId",
        evidence
      FROM library_discovery_request_wanted_release_links
      WHERE discovery_request_id = $1
      ORDER BY wanted_release_id ASC
    `,
    [sharedBoundedStopSeed.discoveryRequestId],
  );
  assert.equal(sharedManualRestartLinkState.rowCount, sharedBoundedStopSeed.wantedReleases.length, 'the shared restart must retain every operator link');
  for (const link of sharedManualRestartLinkState.rows) {
    if (link.wantedReleaseId === sharedManualRestartInitiatorWantedReleaseId) {
      assert.equal(link.evidence?.musicQueueRediscovery?.wantedReleaseId, sharedManualRestartInitiatorWantedReleaseId, 'only the initiating owner link may retain manual restart intent');
      continue;
    }
    assert.equal(link.evidence?.musicQueueRediscovery, undefined, 'a shared restart must not write the other owner\'s local link evidence');
  }

  const sharedManualRestartActivity = await waitForActivityEvent(activityModule.activityEventService, {
    entityId: sharedManualRestartInitiatorWantedReleaseId,
    eventType: 'music_queue_search_queued',
  });
  assert.equal(sharedManualRestartActivity.entityId, sharedManualRestartInitiatorWantedReleaseId, 'manual restart Activity must remain scoped to its initiating release');
  const sharedManualRestartActivityFeed = await activityModule.activityEventService.buildActivityFeed({
    eventType: 'music_queue_search_queued',
    limit: 10,
  });
  const sharedManualRestartActivities = sharedManualRestartActivityFeed.events.filter((event) => (
    sharedBoundedStopWantedReleaseIds.includes(event.entityId)
  ));
  assert.equal(sharedManualRestartActivities.length, 1, 'a racing shared restart must create one owner-scoped Activity row');
  assertSharedActivityFanoutIsRedacted({
    activities: sharedManualRestartActivities,
    sharedSeed: sharedBoundedStopSeed,
    wantedReleaseIds: [sharedManualRestartInitiatorWantedReleaseId],
  });

  const sharedManualRestartEvidenceBefore = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  await libraryModule.libraryDiscoveryWorker.startWorkerRun({
    requestMetadata: { ipAddress: '127.0.0.1' },
    runId: sharedManualRestartRunId,
    triggerSource: 'music_queue_try_again',
    triggeredByUserId: sharedBoundedStopSeed.wantedReleases.find((entry) => (
      entry.wantedReleaseId === sharedManualRestartInitiatorWantedReleaseId
    ))?.appUserId ?? null,
  });
  const sharedManualRestartRun = await waitForRun(libraryModule.libraryDiscoveryRunStore, sharedManualRestartRunId);
  assert.equal(sharedManualRestartRun.candidateCount, 1, 'the accepted shared restart must dispatch one new global provider search');
  const sharedManualRestartFinalStateResult = await pool.query(
    `
      SELECT
        blocked_reason AS "blockedReason",
        request_status AS "requestStatus",
        research_attempt_count AS "researchAttemptCount",
        search_attempt_count AS "searchAttemptCount"
      FROM library_discovery_requests
      WHERE metadata_release_id = $1
    `,
    [sharedBoundedStopSeed.metadataReleaseId],
  );
  const sharedManualRestartState = sharedManualRestartFinalStateResult.rows[0];
  assert.equal(sharedManualRestartState?.requestStatus, 'cooldown', 'the completed restart search must return to automatic cooldown');
  assert.equal(sharedManualRestartState?.blockedReason, 'automatic_cooldown', 'the completed restart search must return to the normal automatic cooldown marker');
  assert.equal(sharedManualRestartState?.researchAttemptCount, 0, 'the completed restart search must retain the reset recovery budget');
  assert.equal(sharedManualRestartState?.searchAttemptCount, 0, 'the completed restart search must clear the retry counter after finding a viable match');
  const sharedManualRestartEvidenceAfterSearch = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  assert.equal(
    sharedManualRestartEvidenceAfterSearch.searchCount - sharedManualRestartEvidenceBefore.searchCount,
    1,
    'the accepted shared restart must issue exactly one provider search',
  );
  const sharedManualRestartSummary = await getOperationRunSummary(pool, sharedManualRestartRunId);
  const sharedManualRestartSearch = sharedManualRestartSummary.dispatchedSearches?.find((search) => (
    search.metadataReleaseId === sharedBoundedStopSeed.metadataReleaseId
  ));
  assert.ok(
    sharedManualRestartSearch,
    `the accepted shared restart must retain its provider-search evidence: ${JSON.stringify(sharedManualRestartSummary)}`,
  );
  const sharedManualRestartDownloadRunId = sharedManualRestartSearch?.autoDownloadStart?.runId;
  assert.ok(
    sharedManualRestartDownloadRunId,
    `the accepted shared restart must create one automatic download run: ${JSON.stringify(sharedManualRestartSearch)}`,
  );
  await executeDownloadAndReconcile({
    importCandidateModule,
    runId: sharedManualRestartDownloadRunId,
    triggerSource: 'controlled_provider_shared_manual_restart',
  });
  const sharedManualRestartEvidenceAfterTransfer = await getControlledProviderFixtureEvidence(sharedBoundedStopFixture.id);
  assert.equal(
    sharedManualRestartEvidenceAfterTransfer.transferCount - sharedManualRestartEvidenceBefore.transferCount,
    1,
    'the accepted shared restart must start exactly one shared automatic transfer',
  );
  const sharedManualRestartCandidateResult = await pool.query(
    `
      SELECT id
      FROM import_candidates
      WHERE normalized_payload #>> '{discoveryScope,metadataReleaseId}' = $1::text
      ORDER BY created_at DESC, id ASC
      LIMIT 1
    `,
    [sharedBoundedStopSeed.metadataReleaseId],
  );
  assert.equal(sharedManualRestartCandidateResult.rowCount, 1, 'the accepted restart must persist one shared candidate');
  const sharedManualRestartCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: sharedManualRestartCandidateResult.rows[0].id,
  });
  assertSharedCandidateIsRedacted({
    candidate: sharedManualRestartCandidate,
    sharedSeed: sharedBoundedStopSeed,
    wantedReleaseIds: sharedBoundedStopWantedReleaseIds,
  });
  const sharedManualRestartOutcomes = await Promise.all(sharedBoundedStopSeed.wantedReleases.map(async ({
    appUserId,
    wantedReleaseId,
  }) => {
    const detail = await acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
      appUserId,
      wantedReleaseId,
    });
    assert.equal(detail.release.id, wantedReleaseId, 'each owner must retain its own restarted Music Queue release');
    assert.equal(detail.release.status.code, 'ready_to_add', 'both owners must see the recovered shared download ready to add');
    assert.equal(detail.release.status.nextAction, 'add_to_library', 'both owners must receive the normal library-add handoff');
    return detail.release.id;
  }));
  await Promise.all(sharedBoundedStopSeed.wantedReleases.map(async ({ appUserId }, index) => {
    const other = sharedBoundedStopSeed.wantedReleases[(index + 1) % sharedBoundedStopSeed.wantedReleases.length];
    await assert.rejects(
      () => acquisitionModule.acquisitionPipelineService.getMusicQueueRelease({
        appUserId,
        wantedReleaseId: other.wantedReleaseId,
      }),
      (error) => error?.status === 404 && error?.code === 'music_queue_release_not_found',
      'a shared restart must preserve reciprocal direct-detail isolation',
    );
  }));

  let catalogCandidateCount = 11;
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
      activityBlockerCode: qualityExhaustionActivity.extraPayload?.addBlockerCode ?? null,
      musicQueueNextAction: qualityExhaustionMusicQueueRelease.status.nextAction,
      musicQueueStatus: qualityExhaustionMusicQueueRelease.status.code,
      wantedReleaseId: qualityExhaustionSeed.wantedReleaseId,
    },
    sharedDiscovery: {
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      musicQueueOutcomeCount: sharedMusicQueueOutcomes.length,
      operatorCount: sharedDiscoverySeed.wantedReleases.length,
      providerSearchCount: sharedDiscoveryEvidenceAfter.searchCount - sharedDiscoveryEvidenceBefore.searchCount,
      providerTransferCount: sharedDiscoveryEvidenceAfter.transferCount - sharedDiscoveryEvidenceBefore.transferCount,
    },
    sharedRecovery: {
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      fallbackCandidateStatus: sharedRecoveryFallbackCandidate.status,
      fallbackRunId: sharedRecoveryFallbackRunId,
      musicQueueDownloadingOutcomeCount: sharedDownloadingOutcomes.length,
      musicQueueTryingNextOutcomeCount: sharedTryingNextOutcomes.length,
      operatorCount: sharedRecoverySeed.wantedReleases.length,
      primaryFinalStatus: sharedRecoveryPrimaryFinalCandidate.status,
      providerSearchCount: sharedRecoveryEvidenceAfter.searchCount - sharedRecoveryEvidenceBefore.searchCount,
      providerTransferCount: sharedRecoveryEvidenceAfter.transferCount - sharedRecoveryEvidenceBefore.transferCount,
      recoveryActivityCount: sharedRecoveryActivities.length,
      recoveryChainCount: sharedRecoveryReconciliation.recoveries.length,
      fallbackActivityCount: sharedFallbackActivities.length,
      downloaderMusicQueueLinkage: sharedRecoveryDownloaderMusicQueueLinkage,
    },
    sharedBoundedStop: {
      activityCount: sharedBoundedStopActivities.length,
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      musicQueueNoMatchesOutcomeCount: sharedBoundedStopOutcomes.length,
      operatorCount: sharedBoundedStopSeed.wantedReleases.length,
      primaryFinalStatus: sharedBoundedStopPrimaryFinalCandidate.status,
      providerSearchCount: sharedBoundedStopEvidenceAfterFailure.searchCount - sharedBoundedStopEvidenceBefore.searchCount,
      providerTransferCount: sharedBoundedStopEvidenceAfterFailure.transferCount - sharedBoundedStopEvidenceBefore.transferCount,
      repeatDispatchCandidateCounts: sharedBoundedStopRepeatDispatches.map((result) => result.candidateCount),
      requestBlockedReason: sharedBoundedStopRequestState.blockedReason,
      requestStatus: sharedBoundedStopRequestState.requestStatus,
    },
    sharedManualRestart: {
      activityCount: sharedManualRestartActivities.length,
      activityPolicyRedacted: true,
      candidatePolicyRedacted: Boolean(sharedManualRestartCandidate),
      crossOperatorReadDenied: true,
      musicQueueReadyToAddOutcomeCount: sharedManualRestartOutcomes.length,
      operatorCount: sharedBoundedStopSeed.wantedReleases.length,
      providerSearchCount: sharedManualRestartEvidenceAfterSearch.searchCount - sharedManualRestartEvidenceBefore.searchCount,
      providerTransferCount: sharedManualRestartEvidenceAfterTransfer.transferCount - sharedManualRestartEvidenceBefore.transferCount,
      researchAttemptCount: sharedManualRestartState.researchAttemptCount,
      requestBlockedReason: sharedManualRestartState.blockedReason,
      requestStatus: sharedManualRestartState.requestStatus,
      restartAlreadyQueuedCount: sharedManualRestartAlreadyQueued.length,
      restartRunId: sharedManualRestartRunId,
      searchAttemptCount: sharedManualRestartState.searchAttemptCount,
    },
  };
}

try {
  process.stdout.write(`${JSON.stringify(await runVerification())}\n`);
} finally {
  await closePool();
}

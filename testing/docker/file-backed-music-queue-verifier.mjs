/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

import { createActivityModule } from '/app/server-dist/activity/activity-module.js';
import { closePool, getPool } from '/app/server-dist/database.js';
import { createImportCandidateModule } from '/app/server-dist/import-candidates/import-candidate-module.js';
import {
  replaceImportCandidateFiles,
  upsertImportCandidate,
} from '/app/server-dist/import-candidates/import-candidate-repository.js';
import { upsertImportExecutionRunItem } from '/app/server-dist/import-candidates/import-candidate-execution-repository.js';
import { persistSettings } from '/app/server-dist/settings.js';

const downloadsRoot = '/data/downloads';
const musicRoot = '/data/music';
const stagingRoot = '/data/staging';

function createProviderStub() {
  return {
    async enqueueDownloads() {
      return { accepted: [] };
    },
    async getConnectionStatus() {
      return { configured: true, status: 'healthy' };
    },
    async getDownloads() {
      return { downloads: [] };
    },
  };
}

function buildCandidateFixture({ filename, folderName, label }) {
  const folderPath = `${downloadsRoot}/${folderName}`;
  const sourceSearchId = `docker-file-backed-${label}-${randomUUID()}`;
  const sourceResponseKey = `docker-file-backed-response-${label}-${randomUUID()}`;

  return {
    candidate: {
      candidateType: 'manual_search',
      discoveredAt: new Date().toISOString(),
      fileCount: 1,
      folderPath,
      lockedFileCount: 0,
      normalizedPayload: {
        extensions: ['flac'],
        fileCount: 1,
        folderPath,
        hasFreeUploadSlot: true,
        lockedFileCount: 0,
        musicQueue: {
          profileCode: 'lossless_archive',
        },
        queueLength: 0,
        totalSizeBytes: 1,
        uploadSpeed: 1,
        username: 'docker-file-backed-fixture',
      },
      rawPayload: {
        folderPath,
        response: {
          files: [{ filename: `${folderPath}/${filename}` }],
          username: 'docker-file-backed-fixture',
        },
        username: 'docker-file-backed-fixture',
      },
      sourceProvider: 'slskd',
      sourceResponseKey,
      sourceSearchId,
      status: 'selected',
      totalSizeBytes: 1,
      username: 'docker-file-backed-fixture',
    },
    files: [{
      bitDepth: 24,
      bitRateKbps: 512,
      extension: 'flac',
      filename,
      folderPath,
      isLocked: false,
      lengthSeconds: 5,
      rawPayload: {
        bitDepth: 24,
        bitRate: 512,
        filename: `${folderPath}/${filename}`,
        isLocked: false,
        length: 5,
        sampleRate: 44_100,
        size: 1,
      },
      sampleRateHz: 44_100,
      sizeBytes: 1,
      sourceFileIndex: 0,
    }],
  };
}

async function waitForRun(runStore, runId) {
  const deadline = Date.now() + 20_000;
  let run = null;

  while (Date.now() < deadline) {
    run = await runStore.getRunById(runId);
    if (run?.status === 'completed') {
      return run;
    }
    if (['cancelled', 'failed', 'paused'].includes(run?.status)) {
      throw new Error(`Apply run ${runId} ended as ${run.status}: ${run.errorMessage ?? 'no error message'}`);
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for apply run ${runId}; latest status was ${run?.status ?? 'missing'}`);
}

async function waitForActivity(pool, { entityId, eventType }) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const result = await pool.query(
      `
        SELECT event_type
        FROM activity_events
        WHERE event_type = $1
          AND entity_id = $2
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [eventType, entityId],
    );
    if (result.rows[0]) {
      return result.rows[0];
    }
    await delay(25);
  }

  throw new Error(`Timed out waiting for ${eventType} Activity evidence for ${entityId}`);
}

async function seedCandidate(pool, fixture) {
  const candidate = await upsertImportCandidate(fixture.candidate, pool);
  await replaceImportCandidateFiles(candidate.id, fixture.files, pool);
  await seedCanonicalMetadataRelease(pool, {
    label: fixture.label,
    sourceSearchId: candidate.sourceSearchId,
  });
  return candidate;
}

async function seedCanonicalMetadataRelease(pool, { label, sourceSearchId }) {
  const artistName = 'Docker Fixture Artist';
  const releaseTitle = `Docker ${label} fixture`;
  const trackTitle = `Docker ${label} track`;
  const artist = await pool.query(
    `
      INSERT INTO metadata_artists (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
      VALUES ('musicbrainz', $1, $2, $3, $3)
      RETURNING id
    `,
    [`docker-file-backed-artist-${randomUUID()}`, randomUUID(), artistName],
  );
  const artistId = artist.rows[0].id;
  const releaseGroup = await pool.query(
    `
      INSERT INTO metadata_release_groups (
        metadata_artist_id, source_provider, source_release_group_id,
        musicbrainz_release_group_id, title, primary_type, first_release_date
      )
      VALUES ($1, 'musicbrainz', $2, $3, $4, 'Album', '2026-01-01')
      RETURNING id
    `,
    [artistId, `docker-file-backed-group-${randomUUID()}`, randomUUID(), releaseTitle],
  );
  const releaseGroupId = releaseGroup.rows[0].id;
  const release = await pool.query(
    `
      INSERT INTO metadata_releases (
        metadata_release_group_id, source_provider, source_release_id,
        musicbrainz_release_id, title, status, release_date, track_count,
        medium_count, is_canonical
      )
      VALUES ($1, 'musicbrainz', $2, $3, $4, 'Official', '2026-01-01', 1, 1, TRUE)
      RETURNING id
    `,
    [releaseGroupId, `docker-file-backed-release-${randomUUID()}`, randomUUID(), releaseTitle],
  );
  const releaseId = release.rows[0].id;
  const medium = await pool.query(
    `
      INSERT INTO metadata_media (metadata_release_id, position, format, track_count)
      VALUES ($1, 1, 'CD', 1)
      RETURNING id
    `,
    [releaseId],
  );
  const recording = await pool.query(
    `
      INSERT INTO metadata_recordings (
        source_provider, source_recording_id, musicbrainz_recording_id,
        title, length_ms, artist_credit
      )
      VALUES ('musicbrainz', $1, $2, $3, 5000, $4)
      RETURNING id
    `,
    [`docker-file-backed-recording-${randomUUID()}`, randomUUID(), trackTitle, artistName],
  );
  await pool.query(
    `
      INSERT INTO metadata_tracks (
        metadata_medium_id, metadata_recording_id, position, number_text,
        title, length_ms, artist_credit
      )
      VALUES ($1, $2, 1, '1', $3, 5000, $4)
    `,
    [medium.rows[0].id, recording.rows[0].id, trackTitle, artistName],
  );
  await pool.query(
    `
      INSERT INTO library_discovery_requests (
        metadata_artist_id, metadata_release_group_id, metadata_release_id,
        wanted_status, search_mode, request_status, evidence
      )
      VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)
    `,
    [artistId, releaseGroupId, releaseId, JSON.stringify({ lastSearchId: sourceSearchId })],
  );
}

async function reconcileCompletedTransfer({ candidate, importCandidateModule }) {
  const executionRun = await importCandidateModule.importCandidateExecutionRunStore.createOperationRun({
    requestedCandidateCount: 1,
    status: 'completed',
  });
  const planningSnapshot = {
    candidate: {
      id: candidate.id,
    },
  };
  await upsertImportExecutionRunItem({
    importCandidateId: candidate.id,
    itemStatus: 'queued',
    operationRunId: executionRun.id,
    planningSnapshot,
    position: 1,
    statusMessage: 'Docker fixture transfer was accepted by the provider.',
  });

  const reconciliation = await importCandidateModule.importCandidateExecutionReconciliationService
    .reconcileImportCandidateExecutionSummary({
      executionSummary: {
        currentRun: {
          id: executionRun.id,
          items: [{
            importCandidateId: candidate.id,
            itemStatus: 'queued',
            liveTransferSummary: {
              message: 'Docker fixture transfer completed.',
              status: 'completed',
            },
            planningSnapshot,
            statusMessage: 'Docker fixture transfer completed.',
          }],
        },
      },
    });

  assert.equal(reconciliation.summary.transitioned, 1, 'completed transfer must transition its candidate');
  assert.equal(
    reconciliation.summary.autoApplyStarted,
    1,
    `completed transfer must start a safe automatic add run: ${JSON.stringify(reconciliation.autoApplyRuns)}`,
  );
  return reconciliation.autoApplyRuns[0].runId;
}

async function executeSafeAutoAdd({ candidate, importCandidateModule }) {
  const initialPreview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId: candidate.id,
  });
  assert.equal(
    initialPreview.summary.status,
    'ready',
    `fixture must be ready before completed-transfer reconciliation: ${JSON.stringify(initialPreview.summary)}`,
  );
  const libraryPath = initialPreview.files[0]?.libraryTarget?.path;
  assert.ok(libraryPath, 'safe automatic add must resolve a library target');
  const applyRunId = await reconcileCompletedTransfer({ candidate, importCandidateModule });
  assert.ok(applyRunId, 'completed transfer must create an apply run ID');

  await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
    applySafetyMode: 'safe_auto',
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: applyRunId,
    triggerSource: 'download_completed',
  });

  return {
    libraryPath,
    run: await waitForRun(importCandidateModule.importCandidateApplyRunStore, applyRunId),
  };
}

async function assertFileExists(pathValue) {
  const fileStats = await stat(pathValue);
  assert.equal(fileStats.isFile(), true, `${pathValue} must be a regular file`);
}

async function runVerification() {
  const pool = getPool();
  const activityModule = createActivityModule();
  const importCandidateModule = createImportCandidateModule({
    getMediaToolingStatus: async () => ({
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
      },
      status: 'healthy',
    }),
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    recordSourceUserOutcomeEvidenceFn: async () => null,
    scheduleLibraryScan: async () => null,
    slskdService: createProviderStub(),
  });

  await persistSettings([
    { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
    { namespace: 'paths', settingKey: 'music', value: musicRoot },
    { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
    {
      namespace: 'paths',
      settingKey: 'downloadMappings',
      value: [{
        harmoniarrPrefix: downloadsRoot,
        slskdPrefix: downloadsRoot,
      }],
    },
    { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
  ], null, pool);

  const authenticCandidate = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'verified.flac',
      folderName: 'docker-file-backed-authentic',
      label: 'verified',
    }),
    label: 'verified',
  });
  const authenticResult = await executeSafeAutoAdd({
    candidate: authenticCandidate,
    importCandidateModule,
  });
  const authenticFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: authenticCandidate.id,
  });
  assert.equal(authenticFinalCandidate.status, 'applied', 'verified FLAC must be added to the library');
  assert.equal(authenticResult.run.appliedCount, 1, 'verified FLAC apply run must report one added file');
  await assertFileExists(authenticResult.libraryPath);
  await waitForActivity(pool, { entityId: authenticCandidate.id, eventType: 'download_completed' });
  await waitForActivity(pool, { entityId: authenticCandidate.id, eventType: 'release_added' });

  const disguisedCandidate = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'disguised.flac',
      folderName: 'docker-file-backed-transcoded',
      label: 'transcoded',
    }),
    label: 'transcoded',
  });
  const disguisedResult = await executeSafeAutoAdd({
    candidate: disguisedCandidate,
    importCandidateModule,
  });
  const disguisedFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: disguisedCandidate.id,
  });
  assert.equal(disguisedResult.run.appliedCount, 0, 'transcoded FLAC must not be added to the library');
  assert.equal(disguisedResult.run.blockedCount, 1, 'transcoded FLAC must be quality blocked');
  assert.equal(disguisedFinalCandidate.status, 'failed', 'quality-blocked candidate must enter recovery state');
  await assert.rejects(stat(disguisedResult.libraryPath), { code: 'ENOENT' });
  await waitForActivity(pool, { entityId: disguisedCandidate.id, eventType: 'download_completed' });
  await waitForActivity(pool, { entityId: disguisedCandidate.id, eventType: 'music_queue_quality_blocked' });

  return {
    authentic: {
      candidateId: authenticCandidate.id,
      finalStatus: authenticFinalCandidate.status,
      runId: authenticResult.run.id,
    },
    transcoded: {
      candidateId: disguisedCandidate.id,
      finalStatus: disguisedFinalCandidate.status,
      runId: disguisedResult.run.id,
    },
  };
}

try {
  const result = await runVerification();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await closePool();
}

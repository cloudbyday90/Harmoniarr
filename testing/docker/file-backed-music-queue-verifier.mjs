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
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
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

function buildCandidateFixture({ filename, folderName, label, sourceFolderPath = null }) {
  const folderPath = sourceFolderPath ?? `${downloadsRoot}/${folderName}`;
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

async function seedCandidate(pool, fixture, { appUserId }) {
  const release = await seedCanonicalMetadataRelease(pool, {
    appUserId,
    label: fixture.label,
    sourceSearchId: fixture.candidate.sourceSearchId,
  });
  const candidate = await upsertImportCandidate({
    ...fixture.candidate,
    normalizedPayload: {
      ...fixture.candidate.normalizedPayload,
      musicQueue: {
        ...fixture.candidate.normalizedPayload.musicQueue,
        wantedReleaseId: release.wantedReleaseId,
      },
    },
  }, pool);
  await replaceImportCandidateFiles(candidate.id, fixture.files, pool);

  return {
    candidate,
    release,
  };
}

async function seedAppUser(pool) {
  const user = await pool.query(
    `
      INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ($1, $2, 'admin', FALSE)
      RETURNING id
    `,
    [`docker-file-backed-${randomUUID()}`, `docker-file-backed-${randomUUID()}`],
  );
  return user.rows[0].id;
}

async function seedCanonicalMetadataRelease(pool, { appUserId, label, sourceSearchId }) {
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
  const wantedRelease = await pool.query(
    `
      INSERT INTO library_wanted_releases (
        app_user_id,
        metadata_artist_id,
        metadata_release_group_id,
        metadata_release_id,
        wanted_status,
        expected_track_count,
        matched_track_count,
        missing_track_count,
        release_date,
        release_status,
        evidence
      )
      VALUES ($1, $2, $3, $4, 'missing', 1, 0, 1, '2026-01-01', 'Official', $5::jsonb)
      RETURNING id
    `,
    [
      appUserId,
      artistId,
      releaseGroupId,
      releaseId,
      JSON.stringify({
        qualityProfile: 'lossless_archive',
        source: 'docker_file_backed_recovery_acceptance',
      }),
    ],
  );
  const discoveryRequest = await pool.query(
    `
      INSERT INTO library_discovery_requests (
        metadata_artist_id, metadata_release_group_id, metadata_release_id,
        wanted_status, search_mode, request_status, evidence
      )
      VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)
      RETURNING id
    `,
    [artistId, releaseGroupId, releaseId, JSON.stringify({ lastSearchId: sourceSearchId })],
  );

  await pool.query(
    `
      INSERT INTO library_discovery_request_wanted_release_links (
        discovery_request_id,
        wanted_release_id,
        evidence
      )
      VALUES ($1, $2, '{}'::jsonb)
    `,
    [discoveryRequest.rows[0].id, wantedRelease.rows[0].id],
  );

  return {
    wantedReleaseId: wantedRelease.rows[0].id,
  };
}

async function reconcileCompletedTransfer({
  candidate,
  expectedAutoApplyStarted = 1,
  importCandidateModule,
}) {
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
    expectedAutoApplyStarted,
    `completed transfer reported an unexpected automatic-add result: ${JSON.stringify(reconciliation.autoApplyRuns)}`,
  );
  return reconciliation;
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
  const reconciliation = await reconcileCompletedTransfer({ candidate, importCandidateModule });
  const applyRunId = reconciliation.autoApplyRuns[0]?.runId ?? null;
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

async function getOperationRunSummary(pool, runId) {
  const result = await pool.query(
    `
      SELECT summary
      FROM operation_runs
      WHERE id = $1
    `,
    [runId],
  );
  return result.rows[0]?.summary ?? null;
}

async function listApplyRunCandidateIds(pool, runId) {
  const result = await pool.query(
    `
      SELECT import_candidate_id
      FROM import_apply_run_items
      WHERE operation_run_id = $1
      ORDER BY position ASC, id ASC
    `,
    [runId],
  );
  return result.rows.map((row) => row.import_candidate_id);
}

async function countApplyRunItemsForCandidate(pool, importCandidateId) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::integer AS count
      FROM import_apply_run_items
      WHERE import_candidate_id = $1
    `,
    [importCandidateId],
  );
  return result.rows[0].count;
}

async function persistPathSettings(pool, downloadMappings) {
  await persistSettings([
    { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
    { namespace: 'paths', settingKey: 'music', value: musicRoot },
    { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
    { namespace: 'paths', settingKey: 'downloadMappings', value: downloadMappings },
    { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
  ], null, pool);
}

async function previewCandidate(importCandidateModule, importCandidateId) {
  const preview = await importCandidateModule.importCandidateApplyPreviewService.previewImportCandidateApply({
    importCandidateId,
  });
  assert.ok(preview.files[0]?.libraryTarget?.path, 'fixture must resolve one library target');
  return preview;
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

  const appUserId = await seedAppUser(pool);
  await persistPathSettings(pool, [{
    harmoniarrPrefix: downloadsRoot,
    slskdPrefix: downloadsRoot,
  }]);

  const authenticSeed = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'verified.flac',
      folderName: 'docker-file-backed-authentic',
      label: 'verified',
    }),
    label: 'verified',
  }, { appUserId });
  const authenticCandidate = authenticSeed.candidate;
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
  await waitForActivity(pool, { entityId: authenticSeed.release.wantedReleaseId, eventType: 'download_completed' });
  await waitForActivity(pool, { entityId: authenticCandidate.id, eventType: 'release_added' });

  const disguisedSeed = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'disguised.flac',
      folderName: 'docker-file-backed-transcoded',
      label: 'transcoded',
    }),
    label: 'transcoded',
  }, { appUserId });
  const disguisedCandidate = disguisedSeed.candidate;
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
  await waitForActivity(pool, { entityId: disguisedSeed.release.wantedReleaseId, eventType: 'download_completed' });
  await waitForActivity(pool, { entityId: disguisedSeed.release.wantedReleaseId, eventType: 'music_queue_import_blocked' });

  const strictQualityRunItemCount = await countApplyRunItemsForCandidate(pool, disguisedCandidate.id);
  const strictQualityRecheck = await importCandidateModule.importCandidateReleaseSafeAddRecheckService
    .recheckReleaseSafeAdd({
      appUserId,
      wantedReleaseId: disguisedSeed.release.wantedReleaseId,
    });
  assert.equal(strictQualityRecheck.outcome, 'not_available', 'strict quality blocks must remain review-only');
  assert.equal(
    await countApplyRunItemsForCandidate(pool, disguisedCandidate.id),
    strictQualityRunItemCount,
    'strict quality recheck must not create a second automatic apply item',
  );

  const collisionSeed = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'collision.flac',
      folderName: 'docker-file-backed-collision',
      label: 'collision',
    }),
    label: 'collision',
  }, { appUserId });
  const collisionCandidate = collisionSeed.candidate;
  const collisionPreview = await previewCandidate(importCandidateModule, collisionCandidate.id);
  const collisionLibraryPath = collisionPreview.files[0].libraryTarget.path;
  await mkdir(dirname(collisionLibraryPath), { recursive: true });
  await copyFile(collisionPreview.files[0].sourceFile.path, collisionLibraryPath);

  await reconcileCompletedTransfer({
    candidate: collisionCandidate,
    expectedAutoApplyStarted: 0,
    importCandidateModule,
  });
  const collisionFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: collisionCandidate.id,
  });
  assert.equal(collisionFinalCandidate.status, 'failed', 'library collisions must remain in review');
  assert.equal(
    await countApplyRunItemsForCandidate(pool, collisionCandidate.id),
    0,
    'library collisions must not create an automatic apply item',
  );
  const collisionRecheck = await importCandidateModule.importCandidateReleaseSafeAddRecheckService
    .recheckReleaseSafeAdd({
      appUserId,
      wantedReleaseId: collisionSeed.release.wantedReleaseId,
    });
  assert.equal(collisionRecheck.outcome, 'not_available', 'collision review must not be reopened by a prerequisite repair');
  assert.equal(
    await countApplyRunItemsForCandidate(pool, collisionCandidate.id),
    0,
    'collision recheck must not create an automatic apply item',
  );

  await persistPathSettings(pool, [{
    harmoniarrPrefix: `${downloadsRoot}/unreachable`,
    slskdPrefix: '/provider/complete',
  }]);
  const recoverySeed = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'recovered.flac',
      folderName: 'docker-file-backed-folder-recovery',
      label: 'folder-recovery',
      sourceFolderPath: '/provider/complete/docker-file-backed-folder-recovery',
    }),
    label: 'folder-recovery',
  }, { appUserId });
  const recoveryCandidate = recoverySeed.candidate;
  await reconcileCompletedTransfer({
    candidate: recoveryCandidate,
    expectedAutoApplyStarted: 0,
    importCandidateModule,
  });
  const recoveryBlockedCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: recoveryCandidate.id,
  });
  assert.equal(recoveryBlockedCandidate.status, 'failed', 'an incorrect provider mapping must stop the completed download');
  assert.equal(
    await countApplyRunItemsForCandidate(pool, recoveryCandidate.id),
    0,
    'a missing mapped source must stop before an automatic apply run exists',
  );

  const unrelatedSeed = await seedCandidate(pool, {
    ...buildCandidateFixture({
      filename: 'unrelated.flac',
      folderName: 'docker-file-backed-unrelated',
      label: 'unrelated',
      sourceFolderPath: '/provider/complete/docker-file-backed-unrelated',
    }),
    label: 'unrelated',
  }, { appUserId });
  const unrelatedCandidate = unrelatedSeed.candidate;
  await importCandidateModule.importCandidateService.markImportCandidateImportPending({
    importCandidateId: unrelatedCandidate.id,
    reason: 'Docker recovery scope fixture is ready for a future guarded add.',
  });

  await persistPathSettings(pool, [{
    harmoniarrPrefix: `${downloadsRoot}/complete`,
    slskdPrefix: '/provider/complete',
  }]);
  const unrelatedPreview = await previewCandidate(importCandidateModule, unrelatedCandidate.id);
  assert.equal(unrelatedPreview.summary.status, 'ready', 'unrelated completed download must be ready after folder repair');
  const unrelatedLibraryPath = unrelatedPreview.files[0].libraryTarget.path;
  await assert.rejects(stat(unrelatedLibraryPath), { code: 'ENOENT' });

  const recoveredRecheck = await importCandidateModule.importCandidateReleaseSafeAddRecheckService
    .recheckReleaseSafeAdd({
      appUserId,
      wantedReleaseId: recoverySeed.release.wantedReleaseId,
    });
  assert.equal(recoveredRecheck.outcome, 'queued', 'repairing the source mapping must queue the failed release');
  assert.ok(recoveredRecheck.runId, 'repairing the source mapping must create a scoped apply run');
  const recoveredRunSummary = await getOperationRunSummary(pool, recoveredRecheck.runId);
  assert.deepEqual(
    recoveredRunSummary.importCandidateIds,
    [recoveryCandidate.id],
    'the repaired release run must persist only the recovered candidate scope',
  );
  assert.equal(recoveredRunSummary.scopedCandidateCount, 1, 'the repaired release run must remain single-candidate');

  await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
    applySafetyMode: 'safe_auto',
    executableCandidateCount: 1,
    importCandidateIds: [recoveryCandidate.id],
    requestedCandidateCount: 1,
    runId: recoveredRecheck.runId,
    triggerSource: 'music_queue_prerequisite_recheck',
  });
  const recoveredRun = await waitForRun(
    importCandidateModule.importCandidateApplyRunStore,
    recoveredRecheck.runId,
  );
  const recoveryFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: recoveryCandidate.id,
  });
  const unrelatedFinalCandidate = await importCandidateModule.importCandidateService.getImportCandidate({
    importCandidateId: unrelatedCandidate.id,
  });
  assert.equal(recoveredRun.appliedCount, 1, 'the repaired release run must add exactly one candidate');
  assert.equal(recoveryFinalCandidate.status, 'applied', 'the repaired release must be added after the mapping is fixed');
  assert.equal(unrelatedFinalCandidate.status, 'import_pending', 'folder repair must not add unrelated completed downloads');
  assert.deepEqual(
    await listApplyRunCandidateIds(pool, recoveredRecheck.runId),
    [recoveryCandidate.id],
    'the repaired release run must contain no unrelated apply item',
  );
  const recoveredPreview = await previewCandidate(importCandidateModule, recoveryCandidate.id);
  await assertFileExists(recoveredPreview.files[0].libraryTarget.path);
  await assert.rejects(stat(unrelatedLibraryPath), { code: 'ENOENT' });

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
    collision: {
      candidateId: collisionCandidate.id,
      finalStatus: collisionFinalCandidate.status,
    },
    recovered: {
      candidateId: recoveryCandidate.id,
      finalStatus: recoveryFinalCandidate.status,
      runId: recoveredRun.id,
      unrelatedCandidateStatus: unrelatedFinalCandidate.status,
    },
  };
}

try {
  const result = await runVerification();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await closePool();
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { posix as path } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, suite, test } from 'node:test';
import { createImportCandidateModule } from '../../src/server/import-candidates/import-candidate-module.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';
import { createLibraryReleaseReconciliationService } from '../../src/server/library/library-release-reconciliation-service.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { createLibraryScanRunStore } from '../../src/server/library/library-scan-run-store.js';
import { createLibraryScanService } from '../../src/server/library/library-scan-service.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { persistSettings } from '../../src/server/settings.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

function createHealthySettingsService({ downloadsRoot, downloadMappings, musicRoot, stagingRoot }) {
  return {
    async buildSettingsPayload() {
      return {
        settings: {
          paths: {
            downloadMappings,
            downloads: downloadsRoot,
            music: musicRoot,
            staging: stagingRoot,
            userMusicRoots: [],
          },
        },
        pathValidation: {
          summary: {
            status: 'healthy',
          },
        },
      };
    },
  };
}

function createConventionalTagExtractionRecorder({ releaseTitle, artistName, trackTitle }) {
  const calls = [];

  return {
    calls,
    service: {
      async extractLibraryFileTags({ files }) {
        calls.push(files.map((file) => ({
          canonicalPath: file.canonicalPath,
          scopeMetadataReleaseId: file.scopeMetadataReleaseId ?? null,
        })));

        return {
          files: files.map((file) => ({
            ...file,
            tagPayload: {
              album: releaseTitle,
              albumArtist: artistName,
              artist: artistName,
              artists: [artistName],
              disk: {
                number: 1,
                of: 1,
              },
              genre: [],
              musicBrainz: {
                albumArtistId: null,
                artistId: null,
                recordingId: null,
                releaseGroupId: null,
                releaseId: null,
                trackId: null,
              },
              title: trackTitle,
              track: {
                number: 1,
                of: 1,
              },
              year: 1994,
            },
          })),
        };
      },
    },
  };
}

async function seedMetadataReleaseFixture(pool) {
  const artistResult = await pool.query(
    `
      INSERT INTO metadata_artists (
        source_provider,
        source_artist_id,
        musicbrainz_artist_id,
        name,
        sort_name
      )
      VALUES ('musicbrainz', $1, $2, 'Autechre', 'Autechre')
      RETURNING id
    `,
    [`artist-${randomUUID()}`, randomUUID()],
  );
  const metadataArtistId = artistResult.rows[0].id;

  const releaseGroupResult = await pool.query(
    `
      INSERT INTO metadata_release_groups (
        metadata_artist_id,
        source_provider,
        source_release_group_id,
        musicbrainz_release_group_id,
        title,
        primary_type,
        first_release_date
      )
      VALUES ($1, 'musicbrainz', $2, $3, 'Amber', 'Album', '1994-11-07')
      RETURNING id
    `,
    [metadataArtistId, `release-group-${randomUUID()}`, randomUUID()],
  );
  const metadataReleaseGroupId = releaseGroupResult.rows[0].id;

  const releaseResult = await pool.query(
    `
      INSERT INTO metadata_releases (
        metadata_release_group_id,
        source_provider,
        source_release_id,
        musicbrainz_release_id,
        title,
        status,
        release_date,
        track_count,
        medium_count,
        is_canonical
      )
      VALUES ($1, 'musicbrainz', $2, $3, 'Amber', 'Official', '1994-11-07', 1, 1, TRUE)
      RETURNING id
    `,
    [metadataReleaseGroupId, `release-${randomUUID()}`, randomUUID()],
  );
  const metadataReleaseId = releaseResult.rows[0].id;

  const mediumResult = await pool.query(
    `
      INSERT INTO metadata_media (
        metadata_release_id,
        position,
        format,
        track_count
      )
      VALUES ($1, 1, 'CD', 1)
      RETURNING id
    `,
    [metadataReleaseId],
  );
  const metadataMediumId = mediumResult.rows[0].id;

  const recordingResult = await pool.query(
    `
      INSERT INTO metadata_recordings (
        source_provider,
        source_recording_id,
        musicbrainz_recording_id,
        title,
        length_ms,
        artist_credit
      )
      VALUES ('musicbrainz', $1, $2, 'Foil', 322000, 'Autechre')
      RETURNING id
    `,
    [`recording-${randomUUID()}`, randomUUID()],
  );
  const metadataRecordingId = recordingResult.rows[0].id;

  const trackResult = await pool.query(
    `
      INSERT INTO metadata_tracks (
        metadata_medium_id,
        metadata_recording_id,
        position,
        number_text,
        title,
        length_ms,
        artist_credit
      )
      VALUES ($1, $2, 1, '1', 'Foil', 322000, 'Autechre')
      RETURNING id
    `,
    [metadataMediumId, metadataRecordingId],
  );

  return {
    metadataArtistId,
    metadataMediumId,
    metadataRecordingId,
    metadataReleaseGroupId,
    metadataReleaseId,
    metadataTrackId: trackResult.rows[0].id,
  };
}

async function seedDiscoveryRequest(pool, {
  metadataArtistId,
  metadataReleaseGroupId,
  metadataReleaseId,
  searchId,
}) {
  await pool.query(
    `
      INSERT INTO library_discovery_requests (
        metadata_artist_id,
        metadata_release_group_id,
        metadata_release_id,
        wanted_status,
        search_mode,
        request_status,
        evidence
      )
      VALUES ($1, $2, $3, 'missing', 'automatic', 'ready', $4::jsonb)
    `,
    [
      metadataArtistId,
      metadataReleaseGroupId,
      metadataReleaseId,
      JSON.stringify({ lastSearchId: searchId }),
    ],
  );
}

async function waitForOperationRunStatus(pool, runId, expectedStatus, {
  timeoutMs = 10_000,
} = {}) {
  const startedAt = Date.now();
  let latestRun = null;

  while (Date.now() - startedAt < timeoutMs) {
    const result = await pool.query(
      `
        SELECT id, operation_type, status, summary, error_message
        FROM operation_runs
        WHERE id = $1
        LIMIT 1
      `,
      [runId],
    );
    latestRun = result.rows[0] ?? null;

    if (latestRun?.status === expectedStatus) {
      return latestRun;
    }

    if (['cancelled', 'failed'].includes(latestRun?.status)) {
      assert.fail(`${latestRun.operation_type} run ${runId} ended as ${latestRun.status}: ${latestRun.error_message ?? 'no error message'}`);
    }

    await delay(50);
  }

  assert.fail(`Timed out waiting for operation run ${runId} to reach ${expectedStatus}; latest status was ${latestRun?.status ?? 'missing'}`);
}

async function waitForPostApplyScanRun(pool, applyRunId, {
  timeoutMs = 10_000,
} = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await pool.query(
      `
        SELECT id, status, summary
        FROM operation_runs
        WHERE operation_type = 'library_scan'
          AND summary->>'triggeredByRunId' = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT 1
      `,
      [applyRunId],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }

    await delay(50);
  }

  assert.fail(`Timed out waiting for post-apply library scan from apply run ${applyRunId}`);
}

function createSingleFileScanExecutor({ libraryFilePath, libraryRoot, relativePath }) {
  return async function executeSingleFileScan({ onFile }) {
    const fileStats = await stat(libraryFilePath);

    await onFile({
      canonicalPath: libraryFilePath,
      extension: '.flac',
      filename: path.basename(libraryFilePath),
      fileState: 'observed',
      modifiedAt: fileStats.mtime?.toISOString?.() ?? null,
      relativePath,
      sizeBytes: Number(fileStats.size ?? 0),
    });

    return {
      completedAt: new Date().toISOString(),
      directoriesSeen: 2,
      filesMatched: 1,
      filesSeen: 1,
      filesUnmatched: 0,
      libraryRoot,
      skippedSymlinks: 0,
      totalBytes: Number(fileStats.size ?? 0),
    };
  };
}

function buildLibraryScanHarness({
  downloadsRoot,
  downloadMappings,
  getPoolFn,
  libraryFilePath,
  musicRoot,
  relativeLibraryPath,
  stagingRoot,
  tagExtractionService,
}) {
  const libraryCatalogStore = createLibraryCatalogStore({ getPoolFn });
  const libraryFileMatchStore = createLibraryFileMatchStore({ getPoolFn });
  const libraryFileMatcherService = createLibraryFileMatcherService({
    getPoolFn,
    libraryFileMatchStore,
  });
  const libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore({ getPoolFn });
  const libraryReleaseReconciliationService = createLibraryReleaseReconciliationService({
    libraryReleaseReconciliationStore,
  });
  const libraryScanRunStore = createLibraryScanRunStore({ getPoolFn });
  const libraryScanService = createLibraryScanService({
    createOperationRun: libraryScanRunStore.createOperationRun,
    getActiveRun: libraryScanRunStore.getActiveRun,
    recordAuditEventFn: async () => null,
    settingsService: createHealthySettingsService({
      downloadsRoot,
      downloadMappings,
      musicRoot,
      stagingRoot,
    }),
  });
  const libraryScanWorker = createLibraryScanWorker({
    acquireLease: libraryScanRunStore.acquireLease,
    executeScan: createSingleFileScanExecutor({
      libraryFilePath,
      libraryRoot: musicRoot,
      relativePath: relativeLibraryPath,
    }),
    extractLibraryFileTags: tagExtractionService.extractLibraryFileTags,
    isCancellationRequested: libraryScanRunStore.isCancellationRequested,
    markRunCancelled: libraryScanRunStore.markRunCancelled,
    markRunCompleted: libraryScanRunStore.markRunCompleted,
    markRunFailed: libraryScanRunStore.markRunFailed,
    markRunPaused: libraryScanRunStore.markRunPaused,
    markRunStarted: libraryScanRunStore.markRunStarted,
    matchLibraryFiles: libraryFileMatcherService.matchLibraryFiles,
    recordLibraryFiles: libraryCatalogStore.recordLibraryFiles,
    reconcileLibraryReleases: libraryReleaseReconciliationService.reconcileLibraryReleases,
    releaseLease: libraryScanRunStore.releaseLease,
    renewLease: libraryScanRunStore.renewLease,
  });

  return {
    libraryScanRunStore,
    libraryScanService,
    libraryScanWorker,
  };
}

function buildImportCandidateModule({ libraryScanService }) {
  return createImportCandidateModule({
    getMediaToolingStatus: async () => ({
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
      },
      status: 'healthy',
    }),
    mediaInspectionService: {
      async inspectSourceFile() {
        return {
          metadata: {
            audioStreamCount: 1,
            durationSeconds: 322,
            primaryAudioCodec: 'flac',
          },
          warnings: [],
        };
      },
    },
    mediaTranscodeExecutionService: {
      async executeCandidate() {
        return {
          mode: 'preflight_only',
          status: 'not_required',
          warnings: [],
        };
      },
    },
    mediaTranscodePlanningService: {
      planInspection() {
        return {
          mode: 'planning_only',
          rationale: 'integration_test_keep_original',
          recommendedAction: 'keep_original',
          target: null,
          warnings: [],
        };
      },
    },
    recordActivityEventFn: async () => null,
    scheduleLibraryScan: libraryScanService.startLibraryScan,
    sendFulfillmentNotificationFn: async () => null,
    slskdService: {
      enqueueDownloads: async () => [],
      getDownloads: async () => [],
      getSearchResponses: async () => [],
      startSearch: async () => null,
    },
  });
}

suite('integration import apply post-apply scan', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('applies a request-owned candidate, scans with release hints, matches conventional tags, reconciles the release, and fulfills requests', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      const bootstrapResponse = await bootstrapAdminSession(client);
      assert.equal(bootstrapResponse.response.status, 201);
      const adminUserId = bootstrapResponse.payload.user.id;
      const testRoot = `/tmp/harmoniarr-import-apply-scan-${randomUUID()}`;
      const downloadsRoot = path.join(testRoot, 'downloads');
      const stagingRoot = path.join(testRoot, 'staging');
      const musicRoot = path.join(testRoot, 'music');
      const downloadMappings = [{
        harmoniarrPrefix: downloadsRoot,
        slskdPrefix: '/slskd/downloads',
      }];
      const sourceSearchId = `search-${randomUUID()}`;
      const sourceRelativePath = 'Autechre/Amber/01 Foil.flac';
      const sourceFilePath = path.join(downloadsRoot, sourceRelativePath);
      const relativeLibraryPath = 'Autechre/Amber (1994)/01 - Foil.flac';
      const libraryFilePath = path.join(musicRoot, relativeLibraryPath);

      try {
        await mkdir(path.dirname(sourceFilePath), { recursive: true });
        await mkdir(stagingRoot, { recursive: true });
        await mkdir(musicRoot, { recursive: true });
        await writeFile(sourceFilePath, 'fake-flac-content');

        await persistSettings([
          { namespace: 'paths', settingKey: 'downloads', value: downloadsRoot },
          { namespace: 'paths', settingKey: 'staging', value: stagingRoot },
          { namespace: 'paths', settingKey: 'music', value: musicRoot },
          { namespace: 'paths', settingKey: 'downloadMappings', value: downloadMappings },
          { namespace: 'paths', settingKey: 'userMusicRoots', value: [] },
        ], adminUserId, pool);

        const metadataFixture = await seedMetadataReleaseFixture(pool);
        await seedDiscoveryRequest(pool, {
          ...metadataFixture,
          searchId: sourceSearchId,
        });

        const mediaRequestResult = await pool.query(
          `
            INSERT INTO media_requests (
              requested_by_user_id,
              requested_for_user_id,
              request_kind,
              request_state,
              artist_name,
              release_title,
              normalized_query,
              matched_metadata_release_group_id,
              matched_metadata_release_id,
              evidence
            )
            VALUES ($1, $1, 'release', 'needs_fetch', 'Autechre', 'Amber', 'Autechre Amber', $2, $3, $4::jsonb)
            RETURNING id, request_state, matched_metadata_release_id
          `,
          [
            adminUserId,
            metadataFixture.metadataReleaseGroupId,
            metadataFixture.metadataReleaseId,
            JSON.stringify({
              classificationStrategy: 'integration_seeded_local_metadata_release',
              matchedReleaseId: metadataFixture.metadataReleaseId,
            }),
          ],
        );
        const mediaRequest = mediaRequestResult.rows[0];
        assert.equal(mediaRequest.request_state, 'needs_fetch');
        assert.equal(mediaRequest.matched_metadata_release_id, metadataFixture.metadataReleaseId);

        const importCandidate = await seedImportCandidateFixture({
          candidateOverrides: {
            normalizedPayload: {
              extensions: ['flac'],
              fileCount: 1,
              folderPath: 'Autechre\\Amber',
              hasFreeUploadSlot: true,
              lockedFileCount: 0,
              queueLength: 0,
              requestOwnership: {
                sourceMediaRequestId: mediaRequest.id,
                sourceRequestKind: 'release',
                sourceRequestedByUserId: adminUserId,
                sourceRequestedForUserId: adminUserId,
                sourceType: 'media_request',
              },
              totalSizeBytes: 17,
              uploadSpeed: 2048,
              username: 'source-user',
            },
            sourceSearchId,
            status: 'import_pending',
          },
          files: [{
            bitDepth: 16,
            bitRateKbps: 900,
            extension: 'flac',
            filename: '01 Foil.flac',
            folderPath: 'Autechre\\Amber',
            isLocked: false,
            lengthSeconds: 322,
            rawPayload: {
              bitDepth: 16,
              bitRate: 900,
              filename: 'Autechre\\Amber\\01 Foil.flac',
              isLocked: false,
              length: 322,
              sampleRate: 44100,
              size: 17,
            },
            sampleRateHz: 44100,
            sizeBytes: 17,
            sourceFileIndex: 0,
          }],
          queryable: pool,
        });

        const tagExtraction = createConventionalTagExtractionRecorder({
          artistName: 'Autechre',
          releaseTitle: 'Amber',
          trackTitle: 'Foil',
        });
        const libraryScanHarness = buildLibraryScanHarness({
          downloadsRoot,
          downloadMappings,
          getPoolFn,
          libraryFilePath,
          musicRoot,
          relativeLibraryPath,
          stagingRoot,
          tagExtractionService: tagExtraction.service,
        });
        const importCandidateModule = buildImportCandidateModule({
          libraryScanService: libraryScanHarness.libraryScanService,
        });

        const applyRunStart = await importCandidateModule.importCandidateApplyService.startImportCandidateApplyRun({
          triggeredByUserId: adminUserId,
        });
        await importCandidateModule.importCandidateApplyWorker.startWorkerRun({
          executableCandidateCount: applyRunStart.run.executableCandidateCount,
          requestedCandidateCount: applyRunStart.run.requestedCandidateCount,
          runId: applyRunStart.run.id,
        });
        await waitForOperationRunStatus(pool, applyRunStart.run.id, 'completed');

        await stat(libraryFilePath);

        const candidateStatusResult = await pool.query(
          'SELECT status FROM import_candidates WHERE id = $1',
          [importCandidate.id],
        );
        assert.equal(candidateStatusResult.rows[0]?.status, 'applied');

        const scanRun = await waitForPostApplyScanRun(pool, applyRunStart.run.id);
        assert.equal(scanRun.status, 'pending');
        assert.equal(scanRun.summary.releaseHints?.length, 1);
        assert.equal(scanRun.summary.releaseHints?.[0]?.metadataReleaseId, metadataFixture.metadataReleaseId);
        assert.equal(scanRun.summary.releaseHints?.[0]?.canonicalPath, libraryFilePath);

        await libraryScanHarness.libraryScanWorker.startWorkerRun({
          libraryRoot: scanRun.summary.libraryRoot,
          releaseHints: scanRun.summary.releaseHints,
          runId: scanRun.id,
          triggeredByRunId: scanRun.summary.triggeredByRunId,
          triggerReason: scanRun.summary.triggerReason,
        });
        await waitForOperationRunStatus(pool, scanRun.id, 'completed');

        assert.equal(tagExtraction.calls.length, 1);
        assert.deepEqual(tagExtraction.calls[0], [{
          canonicalPath: libraryFilePath,
          scopeMetadataReleaseId: metadataFixture.metadataReleaseId,
        }]);

        const matchResult = await pool.query(
          `
            SELECT
              library_file_matches.confidence,
              library_file_matches.evidence,
              library_file_matches.match_status,
              library_file_matches.matched_by,
              library_file_matches.metadata_release_id,
              library_file_matches.metadata_track_id
            FROM library_file_matches
            JOIN library_files
              ON library_files.id = library_file_matches.library_file_id
            WHERE library_files.canonical_path = $1
            LIMIT 1
          `,
          [libraryFilePath],
        );
        assert.equal(matchResult.rows[0]?.match_status, 'matched');
        assert.equal(matchResult.rows[0]?.confidence, 'high');
        assert.equal(matchResult.rows[0]?.matched_by, 'conventional_tags');
        assert.equal(matchResult.rows[0]?.metadata_release_id, metadataFixture.metadataReleaseId);
        assert.equal(matchResult.rows[0]?.metadata_track_id, metadataFixture.metadataTrackId);
        assert.equal(matchResult.rows[0]?.evidence.scopeMetadataReleaseId, metadataFixture.metadataReleaseId);

        const reconciliationResult = await pool.query(
          `
            SELECT expected_track_count, matched_track_count, reconciliation_status
            FROM library_release_reconciliations
            WHERE metadata_release_id = $1
            LIMIT 1
          `,
          [metadataFixture.metadataReleaseId],
        );
        assert.equal(reconciliationResult.rows[0]?.expected_track_count, 1);
        assert.equal(reconciliationResult.rows[0]?.matched_track_count, 1);
        assert.equal(reconciliationResult.rows[0]?.reconciliation_status, 'complete');

        const detailResponse = await client.requestJson(`/api/v1/library/media-requests/${mediaRequest.id}`);
        assert.equal(detailResponse.response.status, 200);
        assert.equal(detailResponse.payload.mediaRequest.fulfillmentStatus.code, 'fulfilled');
        assert.equal(detailResponse.payload.mediaRequest.fulfillmentStatus.importCandidateId, importCandidate.id);
      } finally {
        await rm(testRoot, { force: true, recursive: true });
      }
    }, {
      scenarioName: 'import_apply_post_apply_scan_conventional_tags',
    });
  });
});

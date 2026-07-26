import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';

test('listWantedReleasesWithMetadata maps discovery request recovery evidence', async () => {
  let observedSql = '';
  let observedParams = [];
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      query: async (sql, params) => {
        observedSql = sql;
        observedParams = params;
        return {
          rows: [{
            app_user_id: 'user-1',
            artist_name: 'Radiohead',
            artist_sort_name: 'Radiohead',
            discovery_blocked_reason: 'download_recovery_exhausted',
            discovery_evidence: {
              downloadRecoveryExhausted: {
                maxResearchAttemptCount: 3,
                sourceOperationRunId: 'operation-run-123456789',
                sourceSearchId: 'search-123456789',
                triggeredByFailedCandidateId: 'candidate-123456789',
              },
            },
            discovery_last_search_at: '2026-05-31T14:30:00.000Z',
            discovery_next_search_after: null,
            discovery_request_status: 'blocked',
            discovery_research_attempt_count: 3,
            discovery_search_attempt_count: 2,
            expected_track_count: 10,
            id: 'wanted-1',
            import_candidate_latest_status: 'selected',
            import_candidate_latest_updated_at: '2026-06-27T21:10:00.000Z',
            import_candidate_best_composite_score: 91,
            import_candidate_matches: [{
              discoveredAt: '2026-06-27T21:09:00.000Z',
              fileCount: 10,
              formatMatchLabel: 'Format match',
              formatMatchScore: 30,
              formats: ['flac'],
              hasFreeUploadSlot: true,
              lockedFileCount: 0,
              matchId: 'candidate-1',
              queueLength: 0,
              score: 91,
              scoreBreakdown: { title: 40 },
              sourceProvider: 'slskd',
              status: 'pending',
              totalSizeBytes: 123456789,
              trackMatchSummary: {
                expectedTrackCount: 10,
                matchedTrackCount: 10,
              },
              updatedAt: '2026-06-27T21:10:00.000Z',
              uploadSpeed: 1000000,
            }],
            import_candidate_scored_count: 3,
            import_candidate_second_best_composite_score: 84,
            import_candidate_status_counts: {
              downloading: 2,
              pending: 1,
            },
            import_candidate_total_count: 3,
            import_execution_enqueued_transfer_count: 4,
            import_execution_failed_filename_count: 1,
            import_execution_item_status_counts: {
              queued: 1,
              queued_with_warnings: 1,
            },
            import_execution_item_total_count: 2,
            import_execution_latest_item_status: 'queued',
            import_execution_latest_updated_at: '2026-06-27T21:12:00.000Z',
            import_apply_item_status_counts: {
              blocked: 1,
            },
            import_apply_item_total_count: 1,
            import_apply_latest_item_status: 'blocked',
            import_apply_latest_outcome: 'quality_blocked',
            import_apply_latest_quality_blocked_message: '1 file did not pass verified lossless checks before automatic add.',
            import_apply_latest_quality_gate: {
              blockers: [{
                code: 'safe_auto_spectral_transcoded',
                fileId: 'file-1',
                filename: '01 Fake.flac',
                message: 'Spectral analysis does not verify this lossless file.',
              }],
              checkedFileCount: 12,
              message: '1 file did not pass verified lossless checks before automatic add.',
              profileCode: 'lossless_archive',
              status: 'blocked',
            },
            import_apply_latest_updated_at: '2026-06-27T21:15:00.000Z',
            import_apply_quality_blocked_count: 1,
            last_reconciled_at: '2026-05-31T14:00:00.000Z',
            matched_track_count: 0,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'rg-1',
            metadata_release_id: 'release-1',
            missing_track_count: 10,
            musicbrainz_release_group_id: 'rg-mbid-1',
            musicbrainz_release_id: 'release-mbid-1',
            release_country: 'GB',
            release_date: '2000-10-02',
            release_disambiguation: null,
            release_group_title: 'Kid A',
            release_group_type: 'Album',
            release_status: 'Official',
            release_title: 'Kid A',
            wanted_status: 'missing',
          }],
        };
      },
    }),
  });

  const releases = await store.listWantedReleasesWithMetadata({ appUserId: 'user-1', limit: 25 });

  assert.match(observedSql, /LEFT JOIN library_discovery_requests ldr/);
  assert.match(observedSql, /LEFT JOIN LATERAL/);
  assert.match(observedSql, /FROM import_candidates ic/);
  assert.match(observedSql, /ic\.source_search_id = NULLIF\(ldr\.evidence->>'lastSearchId', ''\)/);
  assert.match(observedSql, /jsonb_typeof\(ic\.normalized_payload->'compositeScore'\)/);
  assert.match(observedSql, /second_best_composite_score/);
  assert.match(observedSql, /import_match_drilldown\.matches AS import_candidate_matches/);
  assert.match(observedSql, /LIMIT 5/);
  assert.match(observedSql, /FROM import_execution_run_items iei/);
  assert.match(observedSql, /FROM import_apply_run_items iai/);
  assert.match(observedSql, /jsonb_array_length\(latest_item\.planning_snapshot #> '\{execution,enqueuedTransfers\}'\)/);
  assert.match(observedSql, /latest_items\.apply_snapshot #>> '\{apply,outcome\}' = 'quality_blocked'/);
  assert.match(observedSql, /lwr\.app_user_id = \$1/);
  assert.deepEqual(observedParams, ['user-1', 25]);
  assert.equal(releases[0].appUserId, 'user-1');
  assert.deepEqual(releases[0].discoveryRequest, {
    blockedReason: 'download_recovery_exhausted',
    evidence: {
      downloadRecoveryExhausted: {
        maxResearchAttemptCount: 3,
        sourceOperationRunId: 'operation-run-123456789',
        sourceSearchId: 'search-123456789',
        triggeredByFailedCandidateId: 'candidate-123456789',
      },
    },
    importReviewSummary: {
      latestStatus: 'selected',
      latestUpdatedAt: '2026-06-27T21:10:00.000Z',
      matches: [{
        discoveredAt: '2026-06-27T21:09:00.000Z',
        fileCount: 10,
        formatMatchLabel: 'Format match',
        formatMatchScore: 30,
        formats: ['flac'],
        hasFreeUploadSlot: true,
        lockedFileCount: 0,
        matchId: 'candidate-1',
        queueLength: 0,
        score: 91,
        scoreBreakdown: { title: 40 },
        sourceProvider: 'slskd',
        status: 'pending',
        totalSizeBytes: 123456789,
        trackMatchSummary: {
          expectedTrackCount: 10,
          matchedTrackCount: 10,
        },
        updatedAt: '2026-06-27T21:10:00.000Z',
        uploadSpeed: 1000000,
      }],
      selectionReadiness: {
        bestCompositeScore: 91,
        candidateCount: 3,
        code: 'handoff_active',
        label: 'Download handoff active',
        message: 'A selected candidate is already moving through the download or import pipeline.',
        reviewableCount: 1,
        scoredCandidateCount: 3,
        scoreGap: 7,
        secondBestCompositeScore: 84,
        thresholds: {
          ambiguityMargin: 5,
          minCompositeScore: 85,
        },
        tone: 'info',
      },
      statusCounts: {
        downloading: 2,
        pending: 1,
      },
      totalCount: 3,
      downloadExecutionSummary: {
        enqueuedTransferCount: 4,
        failedFilenameCount: 1,
        itemStatusCounts: {
          queued: 1,
          queued_with_warnings: 1,
        },
        latestItemStatus: 'queued',
        latestUpdatedAt: '2026-06-27T21:12:00.000Z',
        totalItemCount: 2,
      },
      libraryAddSummary: {
        itemStatusCounts: {
          blocked: 1,
        },
        latestItemStatus: 'blocked',
        latestOutcome: 'quality_blocked',
        latestQualityBlockedMessage: '1 file did not pass verified lossless checks before automatic add.',
        latestQualityGate: {
          blockers: [{
            code: 'safe_auto_spectral_transcoded',
            fileId: 'file-1',
            filename: '01 Fake.flac',
            message: 'Spectral analysis does not verify this lossless file.',
          }],
          checkedFileCount: 12,
          message: '1 file did not pass verified lossless checks before automatic add.',
          profileCode: 'lossless_archive',
          status: 'blocked',
        },
        latestUpdatedAt: '2026-06-27T21:15:00.000Z',
        qualityBlockedCount: 1,
        totalItemCount: 1,
      },
    },
    lastSearchAt: '2026-05-31T14:30:00.000Z',
    nextSearchAfter: null,
    requestStatus: 'blocked',
    researchAttemptCount: 3,
    searchAttemptCount: 2,
  });
});

test('listWantedReleasesWithMetadata keeps artist filtering parameterized and user-scoped', async () => {
  let observedParams = [];
  let observedSql = '';
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      query: async (sql, params) => {
        observedSql = sql;
        observedParams = params;
        return { rows: [] };
      },
    }),
  });

  await store.listWantedReleasesWithMetadata({
    appUserId: 'user-1',
    limit: 4,
    metadataArtistId: 'artist-1',
  });

  assert.match(observedSql, /lwr\.app_user_id = \$1/);
  assert.match(observedSql, /lwr\.metadata_artist_id = \$2/);
  assert.deepEqual(observedParams, ['user-1', 'artist-1', 4]);
});

test('listWantedReleasesWithMetadata returns null discoveryRequest when none exists', async () => {
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          app_user_id: 'user-2',
          artist_name: 'Bjork',
          artist_sort_name: 'Bjork',
          discovery_blocked_reason: null,
          discovery_evidence: null,
          discovery_last_search_at: null,
          discovery_next_search_after: null,
          discovery_request_status: null,
          discovery_research_attempt_count: null,
          discovery_search_attempt_count: null,
          expected_track_count: 9,
          id: 'wanted-2',
          import_candidate_latest_status: null,
          import_candidate_latest_updated_at: null,
          import_candidate_best_composite_score: null,
          import_candidate_scored_count: 0,
          import_candidate_second_best_composite_score: null,
          import_candidate_status_counts: null,
          import_candidate_total_count: 0,
          import_execution_enqueued_transfer_count: 0,
          import_execution_failed_filename_count: 0,
          import_execution_item_status_counts: null,
          import_execution_item_total_count: 0,
          import_execution_latest_item_status: null,
          import_execution_latest_updated_at: null,
          last_reconciled_at: null,
          matched_track_count: 0,
          metadata_artist_id: 'artist-2',
          metadata_release_group_id: 'rg-2',
          metadata_release_id: 'release-2',
          missing_track_count: 9,
          musicbrainz_release_group_id: null,
          musicbrainz_release_id: null,
          release_country: null,
          release_date: null,
          release_disambiguation: null,
          release_group_title: 'Homogenic',
          release_group_type: 'Album',
          release_status: 'Official',
          release_title: 'Homogenic',
          wanted_status: 'missing',
        }],
      }),
    }),
  });

  const releases = await store.listWantedReleasesWithMetadata();

  assert.equal(releases[0].discoveryRequest, null);
});

test('replaceLibraryWantedReleases writes operator-scoped wanted rows', async (t) => {
  const queries = [];
  const client = {
    query: t.mock.fn(async (sql, params) => {
      queries.push({ params, sql });
      return { rows: [] };
    }),
    release: t.mock.fn(),
  };
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      connect: async () => client,
    }),
  });

  await store.replaceLibraryWantedReleases({
    wantedReleases: [{
      appUserId: 'user-1',
      evidence: { strategy: 'monitored_release_absent' },
      expectedTrackCount: 12,
      matchedTrackCount: 0,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'rg-1',
      metadataReleaseId: 'release-1',
      missingTrackCount: 12,
      releaseDate: '2026',
      releaseStatus: 'Official',
      wantedStatus: 'missing',
    }],
  });

  const insertQuery = queries.find((entry) => entry.sql.includes('INSERT INTO library_wanted_releases'));
  assert.match(insertQuery.sql, /app_user_id/);
  assert.deepEqual(insertQuery.params, [
    'user-1',
    'artist-1',
    'rg-1',
    'release-1',
    'missing',
    12,
    0,
    12,
    '2026-01-01',
    'Official',
    '{"strategy":"monitored_release_absent"}',
  ]);
  assert.equal(client.release.mock.callCount(), 1);
});

test('listLibraryWantedReleases maps appUserId for backup export', async () => {
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          app_user_id: 'user-1',
          evidence: {},
          expected_track_count: 10,
          matched_track_count: 0,
          metadata_artist_id: 'artist-1',
          metadata_release_group_id: 'rg-1',
          metadata_release_id: 'release-1',
          missing_track_count: 10,
          release_date: null,
          release_status: 'Official',
          wanted_status: 'missing',
        }],
      }),
    }),
  });

  const rows = await store.listLibraryWantedReleases();

  assert.equal(rows[0].appUserId, 'user-1');
});

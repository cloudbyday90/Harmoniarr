import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createLibraryWantedReleaseWriteStore } from '../../src/server/library/library-wanted-release-write-store.js';

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
            discovery_search_mode: 'automatic',
            expected_track_count: 10,
            id: 'wanted-1',
            import_candidate_latest_status: 'selected',
            import_candidate_latest_event_type: 'import_candidate_selected',
            import_candidate_latest_updated_at: '2026-06-27T21:10:00.000Z',
            import_candidate_best_composite_score: 91,
            import_candidate_recovery_selected_count: 1,
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
            confirmed_transfer_candidate_count: 1,
            confirmed_transfer_count: 2,
            confirmed_transfer_latest_linked_at: '2026-06-27T21:13:00.000Z',
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
            import_apply_latest_recovery_reason_code: 'suspicious_lossless',
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
            wanted_evidence: {
              selectionOrigin: 'manual_edition',
              selectionSource: 'manual',
              selectionState: 'selected',
            },
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
  assert.match(observedSql, /lwr\.evidence AS wanted_evidence/);
  assert.match(observedSql, /LEFT JOIN LATERAL/);
  assert.match(observedSql, /FROM import_candidates ic/);
  assert.match(observedSql, /ic\.source_search_id = NULLIF\(ldr\.evidence->>'lastSearchId', ''\)/);
  assert.match(observedSql, /jsonb_typeof\(ic\.normalized_payload->'compositeScore'\)/);
  assert.match(observedSql, /second_best_composite_score/);
  assert.match(observedSql, /recovery_selected_count/);
  assert.match(observedSql, /latest_event_type/);
  assert.match(observedSql, /FROM import_candidate_events ice/);
  assert.match(observedSql, /import_match_drilldown\.matches AS import_candidate_matches/);
  assert.match(observedSql, /LIMIT 5/);
  assert.match(observedSql, /FROM import_execution_run_items iei/);
  assert.match(observedSql, /FROM import_execution_transfer_links AS transfer_links/);
  assert.match(observedSql, /COUNT\(DISTINCT transfer_links\.import_candidate_id\)/);
  assert.match(observedSql, /import_candidates\.source_search_id = NULLIF\(ldr\.evidence->>'lastSearchId', ''\)/);
  assert.match(observedSql, /FROM import_apply_run_items iai/);
  assert.match(observedSql, /jsonb_array_length\(latest_item\.planning_snapshot #> '\{execution,enqueuedTransfers\}'\)/);
  assert.match(observedSql, /latest_items\.apply_snapshot #>> '\{apply,outcome\}' = 'quality_blocked'/);
  assert.match(observedSql, /latest_items\.apply_snapshot #>> '\{apply,recoveryReasonCode\}'/);
  assert.match(observedSql, /lwr\.app_user_id = \$1/);
  assert.deepEqual(observedParams, ['user-1', 25]);
  assert.equal(releases[0].appUserId, 'user-1');
  assert.deepEqual(releases[0].evidence, {
    selectionOrigin: 'manual_edition',
    selectionSource: 'manual',
    selectionState: 'selected',
  });
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
      latestEventType: 'import_candidate_selected',
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
      recoverySelectedCount: 1,
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
      confirmedTransferSummary: {
        candidateCount: 1,
        latestConfirmedAt: '2026-06-27T21:13:00.000Z',
        transferCount: 2,
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
        latestRecoveryReasonCode: 'suspicious_lossless',
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
    searchMode: 'automatic',
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

test('listWantedReleasesWithMetadata supports parameterized multi-user and search filters', async () => {
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
    appUserIds: ['user-1', 'user-2'],
    limit: 4,
    search: 'Portishead',
  });

  assert.match(observedSql, /lwr\.app_user_id = ANY\(\$1::uuid\[\]\)/u);
  assert.match(observedSql, /LOWER\(ma\.name\) LIKE \$2/u);
  assert.match(observedSql, /LOWER\(mrg\.title\) LIKE \$2/u);
  assert.match(observedSql, /LOWER\(mr\.title\) LIKE \$2/u);
  assert.deepEqual(observedParams, [['user-1', 'user-2'], '%portishead%', 4]);
});

test('listWantedReleasesWithMetadata scopes a direct wanted-release lookup before limiting it', async () => {
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
    appUserIds: ['user-1', 'user-2'],
    limit: 1,
    wantedReleaseId: 'wanted-amber',
  });

  assert.match(observedSql, /lwr\.app_user_id = ANY\(\$1::uuid\[\]\)/u);
  assert.match(observedSql, /lwr\.id = \$2/u);
  assert.deepEqual(observedParams, [['user-1', 'user-2'], 'wanted-amber', 1]);
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

test('replaceLibraryWantedReleases preserves operator row identities and synchronizes discovery links', async (t) => {
  const queries = [];
  const client = {
    query: t.mock.fn(async (sql, params) => {
      queries.push({ params, sql });
      if (sql.includes('DELETE FROM library_wanted_releases')) return { rowCount: 0, rows: [] };
      if (sql.includes('INSERT INTO library_wanted_releases')) return { rowCount: params[0].length,
        rows: params[0].map((appUserId, index) => ({ app_user_id: appUserId, metadata_release_id: params[3][index] })) };
      return { rows: [] };
    }),
    release: t.mock.fn(),
  };
  const syncActiveWantedReleaseLinks = t.mock.fn(async () => {});
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      connect: async () => client,
    }),
    libraryDiscoveryRequestWantedReleaseLinkStore: { syncActiveWantedReleaseLinks },
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
  const staleCleanupQuery = queries.find((entry) => entry.sql.includes('DELETE FROM library_wanted_releases'));
  assert.match(staleCleanupQuery.sql, /UNNEST\(\$1::uuid\[\], \$2::uuid\[\]\)/u);
  assert.deepEqual(staleCleanupQuery.params, [['user-1'], ['release-1']]);
  assert.match(insertQuery.sql, /app_user_id/);
  assert.match(insertQuery.sql, /ON CONFLICT\s*\(app_user_id,\s*metadata_release_id\) DO UPDATE/u);
  assert.deepEqual(insertQuery.params, [
    ['user-1'],
    ['artist-1'],
    ['rg-1'],
    ['release-1'],
    ['missing'],
    [12],
    [0],
    [12],
    ['2026-01-01'],
    ['Official'],
    ['{"strategy":"monitored_release_absent"}'],
  ]);
  assert.equal(syncActiveWantedReleaseLinks.mock.callCount(), 1);
  assert.equal(syncActiveWantedReleaseLinks.mock.calls[0].arguments[0].client, client);
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

function writeRow(appUserId = 'user-a', changes = {}) {
  return { appUserId, metadataArtistId: 'artist', metadataReleaseGroupId: 'group', metadataReleaseId: 'shared-release',
    wantedStatus: 'missing', expectedTrackCount: 10, matchedTrackCount: 0, missingTrackCount: 10,
    releaseDate: '2026', releaseStatus: 'Official', evidence: { strategy: 'monitored_release_absent' }, ...changes };
}
function writeFixture(t, { targets = [{ app_user_id: 'obsolete-user', metadata_release_id: 'old-release' }],
  deletedRows = null, writtenRows = null, linkFailure = null, onAdmission = null } = {}) {
  const events = [];
  const query = t.mock.fn(async (sql, values) => {
    if (/pg_advisory_xact_lock/u.test(sql)) { events.push('admission'); await onAdmission?.(); return { rows: [] }; }
    if (/SELECT app_user_id, metadata_release_id FROM library_wanted_releases/u.test(sql)) { events.push('targets'); return { rows: targets }; }
    if (/DELETE FROM library_wanted_releases/u.test(sql)) {
      events.push('delete'); const rows = deletedRows ?? targets.filter((row) => !values[0].some((user, index) => user === row.app_user_id && values[1][index] === row.metadata_release_id));
      return { rowCount: rows.length, rows };
    }
    if (/INSERT INTO library_wanted_releases/u.test(sql)) {
      events.push('upsert'); const rows = writtenRows ?? values[0].map((appUserId, index) => ({ app_user_id: appUserId, metadata_release_id: values[3][index] }));
      return { rowCount: rows.length, rows };
    }
    events.push(sql); return { rows: [] };
  });
  const client = { query, release: t.mock.fn() };
  const syncActiveWantedReleaseLinks = t.mock.fn(async ({ client: owner }) => {
    assert.equal(owner, client); events.push('links'); if (linkFailure) throw linkFailure;
  });
  const store = createLibraryWantedReleaseWriteStore({ getPoolFn: () => ({ connect: async () => client }),
    libraryDiscoveryRequestWantedReleaseLinkStore: { syncActiveWantedReleaseLinks } });
  return { store, client, query, events, syncActiveWantedReleaseLinks };
}

test('same release for different users retains paired identities and same-client required link synchronization', async (t) => {
  const value = writeFixture(t);
  const result = await value.store.replaceLibraryWantedReleases({ wantedReleases: [writeRow(), writeRow('user-b')], queryable: value.client,
    beforeWrite: async ({ queryable, stage }) => { assert.equal(queryable, value.client); value.events.push(`guard:${stage}`); },
  });
  assert.deepEqual(result.wantedKeys, [{ appUserId: 'user-a', metadataReleaseId: 'shared-release' }, { appUserId: 'user-b', metadataReleaseId: 'shared-release' }]);
  assert.deepEqual(value.events, ['admission', 'targets', 'guard:delete', 'delete', 'guard:upsert_batch', 'upsert', 'guard:links', 'links']);
  const inserted = value.query.mock.calls.find((call) => /INSERT INTO library_wanted_releases/u.test(call.arguments[0]));
  assert.deepEqual(inserted.arguments[1][0], ['user-a', 'user-b']); assert.deepEqual(inserted.arguments[1][3], ['shared-release', 'shared-release']);
  assert.doesNotMatch(inserted.arguments[0].split('DO UPDATE SET')[1], /(?:\bid|\bapp_user_id|\bmetadata_release_id|\bdiscovery_request_id)\s*=/u);
  assert.equal(value.client.release.mock.callCount(), 0);
});

test('raw restore-compatible replacement requires no worker/maintenance context and preserves current date and dedupe behavior', async (t) => {
  const rows = [writeRow('user-a', { expectedTrackCount: 9 }), writeRow('user-b'), writeRow('user-a')];
  const value = writeFixture(t, { onAdmission: async () => { await Promise.resolve(); rows[2].appUserId = 'changed'; rows[2].expectedTrackCount = 999; rows[2].evidence.strategy = 'changed'; } });
  const result = await value.store.replaceLibraryWantedReleases({ wantedReleases: rows });
  assert.deepEqual(result.wantedKeys, [{ appUserId: 'user-b', metadataReleaseId: 'shared-release' }, { appUserId: 'user-a', metadataReleaseId: 'shared-release' }]);
  const values = value.query.mock.calls.find((call) => /INSERT INTO library_wanted_releases/u.test(call.arguments[0])).arguments[1];
  assert.deepEqual(values[5], [10, 10]); assert.deepEqual(values[8], ['2026-01-01', '2026-01-01']);
  assert.deepEqual(values[10], ['{"strategy":"monitored_release_absent"}', '{"strategy":"monitored_release_absent"}']);
  assert.equal(value.events.at(-1), 'COMMIT'); assert.equal(value.client.release.mock.callCount(), 1);
});

test('valid empty raw replacement deletes every obsolete pair and still synchronizes links before commit', async (t) => {
  const value = writeFixture(t); const result = await value.store.replaceLibraryWantedReleases({ wantedReleases: [] });
  assert.deepEqual(result.wantedKeys, []); assert.equal(result.deletedWantedKeys.length, 1);
  assert.deepEqual(value.events, ['BEGIN', 'admission', 'targets', 'delete', 'links', 'COMMIT']);
  assert.equal(value.syncActiveWantedReleaseLinks.mock.callCount(), 1);
});

test('required link failure rolls back DELETE and all upserts without a best-effort success', async (t) => {
  const failure = new Error('Link write failed'); const value = writeFixture(t, { linkFailure: failure });
  await assert.rejects(value.store.replaceLibraryWantedReleases({ wantedReleases: [writeRow(), writeRow('user-b')] }), (error) => error === failure);
  assert.deepEqual(value.events, ['BEGIN', 'admission', 'targets', 'delete', 'upsert', 'links', 'ROLLBACK']);
  assert.equal(value.client.release.mock.callCount(), 1);
});

for (const stage of ['delete', 'upsert_batch', 'links']) {
  test(`${stage} guard is awaited and its refusal rolls back the complete wanted/link transaction`, async (t) => {
    const value = writeFixture(t); const failure = Object.assign(new Error('Stale'), { code: 'library_wanted_projection_stale' });
    await assert.rejects(value.store.replaceLibraryWantedReleases({ wantedReleases: [writeRow()],
      beforeWrite: async ({ stage: current }) => { await Promise.resolve(); if (current === stage) throw failure; },
    }), (error) => error === failure);
    assert.equal(value.events.includes('delete'), stage !== 'delete'); assert.equal(value.events.includes('upsert'), stage === 'links');
    assert.equal(value.events.includes('links'), false); assert.equal(value.events.at(-1), 'ROLLBACK');
  });
}

test('missing, duplicate or foreign returned composite keys refuse complete replacement and roll back', async (t) => {
  for (const writtenRows of [[], [{ app_user_id: 'user-a', metadata_release_id: 'shared-release' }],
    [{ app_user_id: 'user-a', metadata_release_id: 'shared-release' }, { app_user_id: 'user-a', metadata_release_id: 'shared-release' }],
    [{ app_user_id: 'user-a', metadata_release_id: 'shared-release' }, { app_user_id: 'foreign', metadata_release_id: 'shared-release' }]]) {
    const value = writeFixture(t, { writtenRows });
    await assert.rejects(value.store.replaceLibraryWantedReleases({ wantedReleases: [writeRow(), writeRow('user-b')] }), { code: 'library_wanted_projection_incomplete' });
    assert.equal(value.events.at(-1), 'ROLLBACK'); assert.equal(value.events.includes('links'), false);
  }
  const deletion = writeFixture(t, { deletedRows: [{ app_user_id: 'foreign', metadata_release_id: 'old-release' }] });
  await assert.rejects(deletion.store.replaceLibraryWantedReleases({ wantedReleases: [] }), { code: 'library_wanted_projection_incomplete' });
  assert.equal(deletion.events.includes('links'), false);
});

test('missing paired ownership or mandatory link adapter refuses instead of independently filtering arrays', async (t) => {
  assert.throws(() => createLibraryWantedReleaseWriteStore({ libraryDiscoveryRequestWantedReleaseLinkStore: {} }), TypeError);
  const value = writeFixture(t);
  for (const row of [{ ...writeRow(), appUserId: null }, { ...writeRow(), metadataReleaseId: '' }]) {
    await assert.rejects(value.store.replaceLibraryWantedReleases({ wantedReleases: [row] }), TypeError);
  }
  assert.deepEqual(value.events, []);
});

test('raw wanted restore deduplicates equivalent UUID spellings and returns canonical pair identities', async (t) => {
  const appUserId = '60000000-0000-4000-8000-0000000000ab';
  const metadataReleaseId = '60000000-0000-4000-8000-0000000000cd';
  const statements = [];
  const query = t.mock.fn(async (sql, values) => {
    statements.push({ sql, values });
    if (/SELECT app_user_id, metadata_release_id FROM library_wanted_releases/u.test(sql)) {
      return { rows: [{ app_user_id: appUserId, metadata_release_id: metadataReleaseId }] };
    }
    if (/DELETE FROM library_wanted_releases/u.test(sql)) return { rowCount: 0, rows: [] };
    if (/INSERT INTO library_wanted_releases/u.test(sql)) return { rowCount: 1,
      rows: [{ app_user_id: appUserId, metadata_release_id: metadataReleaseId }] };
    return { rows: [] };
  });
  const client = { query, release: t.mock.fn() }; const links = t.mock.fn(async ({ client: owner }) => { assert.equal(owner, client); });
  const store = createLibraryWantedReleaseWriteStore({ getPoolFn: () => ({ connect: async () => client }),
    libraryDiscoveryRequestWantedReleaseLinkStore: { syncActiveWantedReleaseLinks: links } });
  const base = writeRow(appUserId, { metadataArtistId: '60000000-0000-4000-8000-000000000020',
    metadataReleaseGroupId: '60000000-0000-4000-8000-000000000021', metadataReleaseId });
  const result = await store.replaceLibraryWantedReleases({ wantedReleases: [
    { ...base, appUserId: appUserId.toUpperCase(), metadataReleaseId: metadataReleaseId.toUpperCase(), evidence: { version: 'first' } },
    { ...base, appUserId: `{${appUserId}}`, metadataReleaseId: metadataReleaseId.replaceAll('-', ''), evidence: { version: 'second' } },
    { ...base, appUserId: appUserId.replaceAll('-', '').toUpperCase(), metadataReleaseId: `{${metadataReleaseId.toUpperCase()}}`, evidence: { version: 'last' } },
  ] });
  assert.deepEqual(result, { wantedKeys: [{ appUserId, metadataReleaseId }], deletedWantedKeys: [] });
  const inserted = statements.find(({ sql }) => /INSERT INTO library_wanted_releases/u.test(sql));
  assert.deepEqual(inserted.values[0], [appUserId]); assert.deepEqual(inserted.values[3], [metadataReleaseId]);
  assert.deepEqual(inserted.values[10], ['{"version":"last"}']);
  assert.equal(links.mock.callCount(), 1); assert.equal(client.release.mock.callCount(), 1);
});

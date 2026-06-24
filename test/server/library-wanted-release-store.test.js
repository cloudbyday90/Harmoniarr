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
    lastSearchAt: '2026-05-31T14:30:00.000Z',
    nextSearchAfter: null,
    requestStatus: 'blocked',
    researchAttemptCount: 3,
    searchAttemptCount: 2,
  });
});

test('listWantedReleasesWithMetadata returns null discoveryRequest when none exists', async () => {
  const store = createLibraryWantedReleaseStore({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          app_user_id: 'user-2',
          artist_name: 'Bjork',
          artist_sort_name: 'Bjork',
          discovery_request_status: null,
          expected_track_count: 9,
          id: 'wanted-2',
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
      releaseDate: '2026-06-01',
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
    '2026-06-01',
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

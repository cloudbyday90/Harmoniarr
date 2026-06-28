import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';

test('reconcileWantedReleases records missing and partial monitored releases from current coverage gaps', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const query = t.mock.fn(async () => ({
    rows: [
      {
        app_user_id: 'user-1',
        expected_track_count: 10,
        matched_track_count: 0,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'release-group-1',
        metadata_release_id: 'release-1',
        monitored_release_group_types: ['album', 'ep'],
        reconciliation_status: null,
        release_scope: 'future_only',
        release_date: '2024-04-01',
        release_status: 'Official',
        wanted_automation_mode: 'future_matching',
      },
      {
        app_user_id: 'user-1',
        expected_track_count: 8,
        matched_track_count: 6,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'release-group-2',
        metadata_release_id: 'release-2',
        monitored_release_group_types: ['album', 'ep'],
        reconciliation_status: 'partial',
        release_scope: 'current_and_future',
        release_date: '2025-05-01',
        release_status: 'Official',
        wanted_automation_mode: 'current_and_future_matching',
      },
      {
        app_user_id: 'user-1',
        expected_track_count: 5,
        matched_track_count: 0,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'release-group-3',
        metadata_release_id: 'release-3',
        monitored_release_group_types: ['album', 'ep'],
        reconciliation_status: null,
        release_scope: 'current_and_future',
        release_date: '2016',
        release_status: 'Official',
        wanted_automation_mode: 'current_and_future_matching',
      },
      {
        app_user_id: 'user-1',
        expected_track_count: 6,
        matched_track_count: 0,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'release-group-4',
        metadata_release_id: 'release-4',
        monitored_release_group_types: ['album', 'ep'],
        reconciliation_status: null,
        release_scope: 'current_and_future',
        release_date: '2017-03',
        release_status: 'Official',
        wanted_automation_mode: 'current_and_future_matching',
      },
    ],
  }));
  const service = createLibraryWantedReleaseService({
    getPoolFn: () => ({
      query,
    }),
    libraryWantedReleaseStore: {
      replaceLibraryWantedReleases,
    },
  });

  await service.reconcileWantedReleases();

  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [
      {
        appUserId: 'user-1',
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          releaseScope: 'future_only',
          reconciliationStatus: 'missing',
          strategy: 'monitored_release_absent',
          wantedAutomationMode: 'future_matching',
        },
        expectedTrackCount: 10,
        matchedTrackCount: 0,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        missingTrackCount: 10,
        releaseDate: '2024-04-01',
        releaseStatus: 'Official',
        wantedStatus: 'missing',
      },
      {
        appUserId: 'user-1',
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          releaseScope: 'current_and_future',
          reconciliationStatus: 'partial',
          strategy: 'monitored_release_gap',
          wantedAutomationMode: 'current_and_future_matching',
        },
        expectedTrackCount: 8,
        matchedTrackCount: 6,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-2',
        metadataReleaseId: 'release-2',
        missingTrackCount: 2,
        releaseDate: '2025-05-01',
        releaseStatus: 'Official',
        wantedStatus: 'partial',
      },
      {
        appUserId: 'user-1',
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          releaseScope: 'current_and_future',
          reconciliationStatus: 'missing',
          strategy: 'monitored_release_absent',
          wantedAutomationMode: 'current_and_future_matching',
        },
        expectedTrackCount: 5,
        matchedTrackCount: 0,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-3',
        metadataReleaseId: 'release-3',
        missingTrackCount: 5,
        releaseDate: '2016-01-01',
        releaseStatus: 'Official',
        wantedStatus: 'missing',
      },
      {
        appUserId: 'user-1',
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          releaseScope: 'current_and_future',
          reconciliationStatus: 'missing',
          strategy: 'monitored_release_absent',
          wantedAutomationMode: 'current_and_future_matching',
        },
        expectedTrackCount: 6,
        matchedTrackCount: 0,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-4',
        metadataReleaseId: 'release-4',
        missingTrackCount: 6,
        releaseDate: '2017-03-01',
        releaseStatus: 'Official',
        wantedStatus: 'missing',
      },
    ],
  });

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /operator_artist_monitoring/);
  assert.match(sql, /operator_artist_monitoring\.app_user_id/);
  assert.match(sql, /operator_artist_monitoring\.release_scope <> 'track_only'/);
  assert.match(sql, /operator_artist_monitoring\.wanted_automation_mode <> 'manual_only'/);
  assert.match(sql, /operator_artist_monitoring\.release_scope = 'current_and_future'/);
  assert.match(sql, /metadata_releases\.release_date ~ '\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$'/);
  assert.match(sql, /\(metadata_releases\.release_date \|\| '-01'\)::date/);
  assert.match(sql, /\(metadata_releases\.release_date \|\| '-01-01'\)::date/);
  assert.match(sql, /operator_artist_monitoring\.created_at::date/);
  assert.doesNotMatch(sql, /metadata_releases\.release_date >= operator_artist_monitoring\.created_at::date/);
  assert.doesNotMatch(sql, /metadata_artist_monitoring/);
});

test('reconcileWantedReleases clears stale wanted releases when no monitored gaps remain', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const service = createLibraryWantedReleaseService({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
    libraryWantedReleaseStore: {
      replaceLibraryWantedReleases,
    },
  });

  await service.reconcileWantedReleases();

  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [],
  });
});

test('reconcileWantedReleases reads per-operator monitoring policy directly', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const query = t.mock.fn(async () => ({ rows: [] }));
  const service = createLibraryWantedReleaseService({
    getPoolFn: () => ({
      query,
    }),
    libraryWantedReleaseStore: {
      replaceLibraryWantedReleases,
    },
  });

  await service.reconcileWantedReleases();

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /FROM operator_artist_monitoring/);
  assert.match(sql, /unnest\(operator_artist_monitoring\.monitored_release_group_types\)/);
  assert.match(sql, /GROUP BY\s+operator_artist_monitoring\.app_user_id/);
  assert.doesNotMatch(sql, /operator_monitored_artist_scope/);
});

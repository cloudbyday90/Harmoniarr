import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';

test('replaceLibraryReleaseReconciliations replaces the current reconciliation projection in one transaction', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.replaceLibraryReleaseReconciliations({
    reconciliations: [{
      duplicateTrackCount: 0,
      evidence: {
        strategy: 'matched_track_coverage',
        trackCoverage: 1,
      },
      expectedTrackCount: 2,
      matchedFileCount: 2,
      matchedTrackCount: 2,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-1',
      missingTrackCount: 0,
      reconciliationStatus: 'complete',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /DELETE FROM library_release_reconciliations/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [['release-1']]);
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO library_release_reconciliations/);
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'artist-1',
    'release-group-1',
    'release-1',
    'complete',
    2,
    2,
    0,
    2,
    0,
    '{"strategy":"matched_track_coverage","trackCoverage":1}',
  ]);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('replaceLibraryReleaseReconciliations clears the projection when no reconciliations remain', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.replaceLibraryReleaseReconciliations({
    reconciliations: [],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls[1].arguments[0], 'DELETE FROM library_release_reconciliations');
  assert.equal(query.mock.calls[2].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('listReconciliationsByMetadataReleaseIds returns compact reconciliation rows for targeted releases', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [['release-1', 'release-2']]);
    return {
      rows: [{
        duplicate_track_count: 1,
        evidence: { source: 'library_scan' },
        expected_track_count: 10,
        last_reconciled_at: '2026-05-25T15:00:00.000Z',
        matched_file_count: 8,
        matched_track_count: 8,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        missing_track_count: 2,
        reconciliation_status: 'partial',
      }],
    };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  const reconciliations = await store.listReconciliationsByMetadataReleaseIds({
    metadataReleaseIds: ['release-1', 'release-2'],
  });

  assert.deepEqual(reconciliations, [{
    duplicateTrackCount: 1,
    evidence: { source: 'library_scan' },
    expectedTrackCount: 10,
    lastReconciledAt: '2026-05-25T15:00:00.000Z',
    matchedFileCount: 8,
    matchedTrackCount: 8,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 2,
    reconciliationStatus: 'partial',
  }]);
});

test('listLibraryReleasesWithMetadata filters removed releases for the operator view', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /LEFT JOIN operator_library_release_visibility olrv/);
    assert.match(sql, /COALESCE\(olrv\.visibility_state, 'visible'\) = 'visible'/);
    assert.deepEqual(params, ['operator-1', 25]);
    return {
      rows: [{
        artist_name: 'Radiohead',
        artist_sort_name: 'Radiohead',
        duplicate_track_count: 0,
        expected_track_count: 12,
        id: 'recon-1',
        last_reconciled_at: '2026-06-30T10:00:00.000Z',
        matched_file_count: 12,
        matched_track_count: 12,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'rg-1',
        metadata_release_id: 'release-1',
        missing_track_count: 0,
        musicbrainz_release_group_id: 'rg-mbid-1',
        musicbrainz_release_id: 'release-mbid-1',
        operator_removed_at: null,
        operator_restored_at: null,
        operator_visibility_reason: null,
        operator_visibility_state: 'visible',
        reconciliation_status: 'complete',
        release_country: 'GB',
        release_date: '1997-05-21',
        release_disambiguation: null,
        release_group_title: 'OK Computer',
        release_group_type: 'Album',
        release_status: 'Official',
        release_title: 'OK Computer',
      }],
    };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  const releases = await store.listLibraryReleasesWithMetadata({
    appUserId: 'operator-1',
    limit: 25,
    visibilityState: 'visible',
  });

  assert.equal(releases[0].operatorVisibility.state, 'visible');
});

test('listLibraryReleasesWithMetadata can list removed releases', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /olrv\.visibility_state = 'removed'/);
    assert.deepEqual(params, ['operator-1', 500]);
    return { rows: [] };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  await store.listLibraryReleasesWithMetadata({
    appUserId: 'operator-1',
    visibilityState: 'removed',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseReconciliationService } from '../../src/server/library/library-release-reconciliation-service.js';

test('reconcileLibraryReleases records complete and duplicate release rollups from current matched files', async (t) => {
  const replaceLibraryReleaseReconciliations = t.mock.fn(async () => {});
  const service = createLibraryReleaseReconciliationService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          {
            duplicate_track_count: 0,
            expected_track_count: 2,
            matched_file_count: 2,
            matched_track_count: 2,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-1',
            metadata_release_id: 'release-1',
          },
          {
            duplicate_track_count: 1,
            expected_track_count: 3,
            matched_file_count: 4,
            matched_track_count: 3,
            metadata_artist_id: 'artist-2',
            metadata_release_group_id: 'release-group-2',
            metadata_release_id: 'release-2',
          },
        ],
      }),
    }),
    libraryReleaseReconciliationStore: {
      replaceLibraryReleaseReconciliations,
    },
  });

  await service.reconcileLibraryReleases();

  assert.deepEqual(replaceLibraryReleaseReconciliations.mock.calls[0].arguments[0], {
    reconciliations: [
      {
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
      },
      {
        duplicateTrackCount: 1,
        evidence: {
          strategy: 'matched_track_coverage',
          trackCoverage: 1,
        },
        expectedTrackCount: 3,
        matchedFileCount: 4,
        matchedTrackCount: 3,
        metadataArtistId: 'artist-2',
        metadataReleaseGroupId: 'release-group-2',
        metadataReleaseId: 'release-2',
        missingTrackCount: 0,
        reconciliationStatus: 'duplicate',
      },
    ],
  });
});

test('reconcileLibraryReleases records partial coverage and clears stale release rows when nothing remains matched', async (t) => {
  const replaceLibraryReleaseReconciliations = t.mock.fn(async () => {});
  const responses = [
    {
      rows: [{
        duplicate_track_count: 0,
        expected_track_count: 5,
        matched_file_count: 3,
        matched_track_count: 3,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'release-group-1',
        metadata_release_id: 'release-1',
      }],
    },
    {
      rows: [],
    },
  ];
  const service = createLibraryReleaseReconciliationService({
    getPoolFn: () => ({
      query: async () => responses.shift(),
    }),
    libraryReleaseReconciliationStore: {
      replaceLibraryReleaseReconciliations,
    },
  });

  await service.reconcileLibraryReleases();
  await service.reconcileLibraryReleases();

  assert.deepEqual(replaceLibraryReleaseReconciliations.mock.calls[0].arguments[0], {
    reconciliations: [{
      duplicateTrackCount: 0,
      evidence: {
        strategy: 'matched_track_coverage',
        trackCoverage: 0.6,
      },
      expectedTrackCount: 5,
      matchedFileCount: 3,
      matchedTrackCount: 3,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-1',
      missingTrackCount: 2,
      reconciliationStatus: 'partial',
    }],
  });
  assert.deepEqual(replaceLibraryReleaseReconciliations.mock.calls[1].arguments[0], {
    reconciliations: [],
  });
});
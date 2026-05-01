import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';

test('reconcileWantedReleases records missing and partial monitored releases from current coverage gaps', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const service = createLibraryWantedReleaseService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          {
            expected_track_count: 10,
            matched_track_count: 0,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-1',
            metadata_release_id: 'release-1',
            monitored_release_group_types: ['album', 'ep'],
            reconciliation_status: null,
            release_date: '2024-04-01',
            release_status: 'Official',
          },
          {
            expected_track_count: 8,
            matched_track_count: 6,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-2',
            metadata_release_id: 'release-2',
            monitored_release_group_types: ['album', 'ep'],
            reconciliation_status: 'partial',
            release_date: '2025-05-01',
            release_status: 'Official',
          },
        ],
      }),
    }),
    libraryWantedReleaseStore: {
      replaceLibraryWantedReleases,
    },
  });

  await service.reconcileWantedReleases();

  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [
      {
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          reconciliationStatus: 'missing',
          strategy: 'monitored_release_absent',
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
        evidence: {
          monitoredReleaseGroupTypes: ['album', 'ep'],
          reconciliationStatus: 'partial',
          strategy: 'monitored_release_gap',
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
    ],
  });
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
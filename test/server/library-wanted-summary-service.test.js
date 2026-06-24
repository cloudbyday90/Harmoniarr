import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedSummaryService } from '../../src/server/library/library-wanted-summary-service.js';

test('buildLibraryWantedSummary reports empty state when no artists are monitored yet', async (t) => {
  const getLibraryWantedSnapshot = t.mock.fn(async () => ({
    lastReconciledAt: null,
    monitoredArtistCount: 0,
    releaseCounts: {
      missing: 0,
      partial: 0,
      totalWanted: 0,
    },
  }));
  const service = createLibraryWantedSummaryService({
    libraryWantedSummaryStore: {
      getLibraryWantedSnapshot,
    },
  });

  const summary = await service.buildLibraryWantedSummary({ appUserId: 'user-1' });

  assert.deepEqual(getLibraryWantedSnapshot.mock.calls[0].arguments[0], { appUserId: 'user-1' });
  assert.equal(summary.summary.status, 'empty');
  assert.equal(summary.summary.message, 'No monitored artists are contributing to wanted reconciliation yet.');
});

test('buildLibraryWantedSummary reports complete state when monitored releases are satisfied', async () => {
  const service = createLibraryWantedSummaryService({
    libraryWantedSummaryStore: {
      getLibraryWantedSnapshot: async () => ({
        lastReconciledAt: '2026-04-30T13:10:00.000Z',
        monitoredArtistCount: 2,
        releaseCounts: {
          missing: 0,
          partial: 0,
          totalWanted: 0,
        },
      }),
    },
  });

  const summary = await service.buildLibraryWantedSummary({ appUserId: 'user-1' });

  assert.equal(summary.summary.status, 'complete');
  assert.equal(summary.summary.message, 'All monitored album and EP releases are currently satisfied by the library.');
});

test('buildLibraryWantedSummary reports wanted state when missing releases remain', async () => {
  const service = createLibraryWantedSummaryService({
    libraryWantedSummaryStore: {
      getLibraryWantedSnapshot: async () => ({
        lastReconciledAt: '2026-04-30T13:15:00.000Z',
        monitoredArtistCount: 3,
        releaseCounts: {
          missing: 2,
          partial: 1,
          totalWanted: 3,
        },
      }),
    },
  });

  const summary = await service.buildLibraryWantedSummary({ appUserId: 'user-1' });

  assert.equal(summary.summary.status, 'wanted');
  assert.equal(summary.summary.message, '3 monitored releases still need files, including fully missing and partially satisfied releases.');
});

test('buildLibraryWantedReleases strips internal and discovery request details by default', async (t) => {
  const listWantedReleasesWithMetadata = t.mock.fn(async () => ([{
    appUserId: 'user-1',
    discoveryRequest: {
      blockedReason: 'download_recovery_exhausted',
      requestStatus: 'blocked',
    },
    id: 'wanted-1',
    releaseTitle: 'Kid A',
  }]));
  const service = createLibraryWantedSummaryService({
    libraryWantedReleaseStore: {
      listWantedReleasesWithMetadata,
    },
  });

  const result = await service.buildLibraryWantedReleases({ appUserId: 'user-1' });

  assert.equal(result.total, 1);
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0].appUserId, 'user-1');
  assert.deepEqual(result.wantedReleases, [{
    id: 'wanted-1',
    releaseTitle: 'Kid A',
  }]);
});

test('buildLibraryWantedReleases includes discovery request details for admin projections', async () => {
  const discoveryRequest = {
    blockedReason: 'download_recovery_exhausted',
    requestStatus: 'blocked',
  };
  const service = createLibraryWantedSummaryService({
    libraryWantedReleaseStore: {
      listWantedReleasesWithMetadata: async () => ([{
        appUserId: 'user-1',
        discoveryRequest,
        id: 'wanted-1',
        releaseTitle: 'Kid A',
      }]),
    },
  });

  const result = await service.buildLibraryWantedReleases({
    appUserId: 'user-1',
    includeDiscoveryRequestDetails: true,
  });

  assert.deepEqual(result.wantedReleases[0].discoveryRequest, discoveryRequest);
  assert.equal('appUserId' in result.wantedReleases[0], false);
});

test('buildLibraryWantedSummary rejects missing appUserId', async () => {
  const service = createLibraryWantedSummaryService();

  await assert.rejects(
    () => service.buildLibraryWantedSummary(),
    /requires an appUserId/,
  );
});

test('buildLibraryWantedReleases rejects missing appUserId', async () => {
  const service = createLibraryWantedSummaryService();

  await assert.rejects(
    () => service.buildLibraryWantedReleases(),
    /requires an appUserId/,
  );
});

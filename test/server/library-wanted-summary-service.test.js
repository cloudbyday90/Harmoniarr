import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedSummaryService } from '../../src/server/library/library-wanted-summary-service.js';

test('buildLibraryWantedSummary reports empty state when no artists are monitored yet', async () => {
  const service = createLibraryWantedSummaryService({
    libraryWantedSummaryStore: {
      getLibraryWantedSnapshot: async () => ({
        lastReconciledAt: null,
        monitoredArtistCount: 0,
        releaseCounts: {
          missing: 0,
          partial: 0,
          totalWanted: 0,
        },
      }),
    },
  });

  const summary = await service.buildLibraryWantedSummary();

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

  const summary = await service.buildLibraryWantedSummary();

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

  const summary = await service.buildLibraryWantedSummary();

  assert.equal(summary.summary.status, 'wanted');
  assert.equal(summary.summary.message, '3 monitored releases still need files, including fully missing and partially satisfied releases.');
});
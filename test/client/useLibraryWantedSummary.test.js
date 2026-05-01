import assert from 'node:assert/strict';
import test from 'node:test';
import { useLibraryWantedSummary } from '../../src/client/composables/useLibraryWantedSummary.js';

test('useLibraryWantedSummary loads the shared wanted payload', async (t) => {
  const fetchLibraryWantedSummary = t.mock.fn(async () => ({
    lastReconciledAt: '2026-04-30T13:25:00.000Z',
    monitoredArtistCount: 2,
    releaseCounts: {
      missing: 1,
      partial: 2,
      totalWanted: 3,
    },
    summary: {
      status: 'wanted',
      message: '3 monitored releases still need files, including fully missing and partially satisfied releases.',
    },
  }));
  const workflow = useLibraryWantedSummary({ fetchLibraryWantedSummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadLibraryWantedSummary();

  assert.equal(fetchLibraryWantedSummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.monitoredArtistCount.value, 2);
  assert.deepEqual(workflow.releaseCounts.value, {
    missing: 1,
    partial: 2,
    totalWanted: 3,
  });
  assert.equal(workflow.summary.value.status, 'wanted');
});

test('useLibraryWantedSummary clears stale state when the summary fetch fails', async () => {
  const workflow = useLibraryWantedSummary({
    fetchLibraryWantedSummary: async () => {
      throw new Error('library wanted summary unavailable');
    },
  });

  await workflow.loadLibraryWantedSummary();

  assert.equal(workflow.libraryWantedSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'library wanted summary unavailable');
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.releaseCounts.value, null);
  assert.equal(workflow.monitoredArtistCount.value, 0);
});
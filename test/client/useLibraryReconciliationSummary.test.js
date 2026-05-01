import assert from 'node:assert/strict';
import test from 'node:test';
import { useLibraryReconciliationSummary } from '../../src/client/composables/useLibraryReconciliationSummary.js';

test('useLibraryReconciliationSummary loads the shared reconciliation payload', async (t) => {
  const fetchLibraryReconciliationSummary = t.mock.fn(async () => ({
    fileCounts: {
      ambiguous: 1,
      ignored: 0,
      matched: 8,
      observed: 9,
      unmatched: 0,
    },
    lastReconciledAt: '2026-04-30T12:45:00.000Z',
    releaseCounts: {
      complete: 3,
      duplicate: 0,
      partial: 1,
    },
    summary: {
      status: 'partial',
      message: '1 release is partially satisfied by the current library.',
    },
  }));
  const workflow = useLibraryReconciliationSummary({ fetchLibraryReconciliationSummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadLibraryReconciliationSummary();

  assert.equal(fetchLibraryReconciliationSummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.fileCounts.value, {
    ambiguous: 1,
    ignored: 0,
    matched: 8,
    observed: 9,
    unmatched: 0,
  });
  assert.deepEqual(workflow.releaseCounts.value, {
    complete: 3,
    duplicate: 0,
    partial: 1,
  });
  assert.equal(workflow.summary.value.status, 'partial');
});

test('useLibraryReconciliationSummary clears stale state when the summary fetch fails', async () => {
  const workflow = useLibraryReconciliationSummary({
    fetchLibraryReconciliationSummary: async () => {
      throw new Error('library reconciliation summary unavailable');
    },
  });

  await workflow.loadLibraryReconciliationSummary();

  assert.equal(workflow.libraryReconciliationSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'library reconciliation summary unavailable');
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.fileCounts.value, null);
  assert.equal(workflow.releaseCounts.value, null);
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReconciliationSummaryStore } from '../../src/server/library/library-reconciliation-summary-store.js';

test('getLibraryReconciliationSnapshot returns current file and release counts', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('FROM library_files')) {
      return {
        rows: [{
          ambiguous_file_count: 1,
          ignored_file_count: 2,
          matched_file_count: 8,
          observed_file_count: 10,
          unmatched_file_count: 1,
        }],
      };
    }

    return {
      rows: [{
        complete_release_count: 3,
        duplicate_release_count: 1,
        last_reconciled_at: '2026-04-30T12:45:00.000Z',
        partial_release_count: 2,
      }],
    };
  });
  const store = createLibraryReconciliationSummaryStore({
    getPoolFn: () => ({ query }),
  });

  const snapshot = await store.getLibraryReconciliationSnapshot();

  assert.equal(query.mock.callCount(), 2);
  assert.deepEqual(snapshot, {
    fileCounts: {
      ambiguous: 1,
      ignored: 2,
      matched: 8,
      observed: 10,
      unmatched: 1,
    },
    lastReconciledAt: '2026-04-30T12:45:00.000Z',
    releaseCounts: {
      complete: 3,
      duplicate: 1,
      partial: 2,
    },
  });
});
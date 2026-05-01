import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReconciliationSummaryService } from '../../src/server/library/library-reconciliation-summary-service.js';

test('buildLibraryReconciliationSummary reports review-required state when unresolved counts remain', async () => {
  const service = createLibraryReconciliationSummaryService({
    libraryReconciliationSummaryStore: {
      getLibraryReconciliationSnapshot: async () => ({
        fileCounts: {
          ambiguous: 2,
          ignored: 1,
          matched: 8,
          observed: 12,
          unmatched: 1,
        },
        lastReconciledAt: '2026-04-30T12:50:00.000Z',
        releaseCounts: {
          complete: 2,
          duplicate: 1,
          partial: 1,
        },
      }),
    },
  });

  const summary = await service.buildLibraryReconciliationSummary();

  assert.equal(summary.summary.status, 'review_required');
  assert.equal(summary.summary.message, '4 reconciliation items still need review.');
  assert.deepEqual(summary.fileCounts, {
    ambiguous: 2,
    ignored: 1,
    matched: 8,
    observed: 12,
    unmatched: 1,
  });
  assert.deepEqual(summary.releaseCounts, {
    complete: 2,
    duplicate: 1,
    partial: 1,
  });
});

test('buildLibraryReconciliationSummary reports complete state when releases are fully satisfied', async () => {
  const service = createLibraryReconciliationSummaryService({
    libraryReconciliationSummaryStore: {
      getLibraryReconciliationSnapshot: async () => ({
        fileCounts: {
          ambiguous: 0,
          ignored: 0,
          matched: 9,
          observed: 9,
          unmatched: 0,
        },
        lastReconciledAt: '2026-04-30T12:55:00.000Z',
        releaseCounts: {
          complete: 3,
          duplicate: 0,
          partial: 0,
        },
      }),
    },
  });

  const summary = await service.buildLibraryReconciliationSummary();

  assert.equal(summary.summary.status, 'complete');
  assert.equal(summary.summary.message, '3 releases are fully satisfied by current library matches.');
});

test('buildLibraryReconciliationSummary reports empty state when no observed files exist', async () => {
  const service = createLibraryReconciliationSummaryService({
    libraryReconciliationSummaryStore: {
      getLibraryReconciliationSnapshot: async () => ({
        fileCounts: {
          ambiguous: 0,
          ignored: 0,
          matched: 0,
          observed: 0,
          unmatched: 0,
        },
        lastReconciledAt: null,
        releaseCounts: {
          complete: 0,
          duplicate: 0,
          partial: 0,
        },
      }),
    },
  });

  const summary = await service.buildLibraryReconciliationSummary();

  assert.equal(summary.summary.status, 'empty');
  assert.equal(summary.summary.message, 'No observed library files have been reconciled yet.');
});
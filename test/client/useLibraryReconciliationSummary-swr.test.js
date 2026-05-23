import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeSummaryPayload(overrides = {}) {
  return {
    fileCounts: {
      ambiguous: 0,
      ignored: 0,
      matched: 8,
      observed: 8,
      unmatched: 0,
    },
    lastReconciledAt: '2026-05-23T12:45:00.000Z',
    releaseCounts: {
      complete: 3,
      duplicate: 0,
      partial: 0,
    },
    summary: {
      status: 'complete',
      message: '3 releases are fully satisfied by current library matches.',
    },
    ...overrides,
  };
}

describe('useLibraryReconciliationSummary SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => makeSummaryPayload(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadLibraryReconciliationSummary();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => makeSummaryPayload(),
    });

    await workflow.loadLibraryReconciliationSummary();

    const secondLoad = workflow.loadLibraryReconciliationSummary();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    let callCount = 0;
    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => {
        callCount += 1;
        if (callCount === 1) return makeSummaryPayload();
        throw new Error('network fail');
      },
    });

    await workflow.loadLibraryReconciliationSummary();
    assert.equal(workflow.summary.value.status, 'complete');

    await workflow.loadLibraryReconciliationSummary();
    assert.equal(workflow.summary.value.status, 'complete', 'stale summary preserved');
    assert.equal(workflow.errorMessage.value, 'network fail');

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => {
        throw new Error('first fail');
      },
    });

    await workflow.loadLibraryReconciliationSummary();

    assert.equal(workflow.libraryReconciliationSummary.value, null);
    assert.equal(workflow.summary.value, null);
    assert.equal(workflow.errorMessage.value, 'first fail');

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    let callCount = 0;
    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => {
        callCount += 1;
        return makeSummaryPayload();
      },
      pollIntervalMs: 30,
    });

    await workflow.loadLibraryReconciliationSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    let callCount = 0;
    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => {
        callCount += 1;
        return makeSummaryPayload();
      },
      pollIntervalMs: 30,
    });

    await workflow.loadLibraryReconciliationSummary();
    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useLibraryReconciliationSummary } = await import('../../src/client/composables/useLibraryReconciliationSummary.js');

    let callCount = 0;
    const workflow = useLibraryReconciliationSummary({
      fetchLibraryReconciliationSummary: async () => {
        callCount += 1;
        return makeSummaryPayload();
      },
      pollIntervalMs: 0,
    });

    await workflow.loadLibraryReconciliationSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});

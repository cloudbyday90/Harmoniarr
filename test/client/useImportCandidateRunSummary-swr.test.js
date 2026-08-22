import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

async function waitFor(predicate, {
  intervalMs = 10,
  timeoutMs = 1_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the expected polling state');
    }

    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
  }
}

function makeSummaryPayload(overrides = {}) {
  return {
    testRun: {
      activeRun: null,
      currentRun: { id: 'run-1', status: 'completed' },
      latestRun: { id: 'run-1', status: 'completed' },
      recentRuns: [{ id: 'run-1', status: 'completed' }],
      summary: { status: 'ready', message: 'Done' },
      ...overrides,
    },
  };
}

describe('useImportCandidateRunSummary SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    const workflow = useImportCandidateRunSummary({
      fetchSummary: async () => makeSummaryPayload(),
      summaryKey: 'testRun',
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadRunSummary();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    const workflow = useImportCandidateRunSummary({
      fetchSummary: async () => makeSummaryPayload(),
      summaryKey: 'testRun',
    });

    await workflow.loadRunSummary();
    assert.equal(workflow.isRevalidating.value, false);

    const secondLoad = workflow.loadRunSummary();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    let callCount = 0;
    const fetchSummary = async () => {
      callCount += 1;
      if (callCount === 1) {
        return makeSummaryPayload({
          currentRun: { id: 'run-1', status: 'completed' },
        });
      }
      throw new Error('network fail');
    };

    const workflow = useImportCandidateRunSummary({ fetchSummary, summaryKey: 'testRun' });

    await workflow.loadRunSummary();
    assert.equal(workflow.currentRun.value.id, 'run-1');
    assert.equal(workflow.recentRuns.value.length, 1);

    await workflow.loadRunSummary();
    assert.equal(workflow.currentRun.value.id, 'run-1', 'stale runSummary preserved');
    assert.equal(workflow.recentRuns.value.length, 1, 'stale recentRuns preserved');
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    const fetchSummary = async () => { throw new Error('first fail'); };
    const workflow = useImportCandidateRunSummary({ fetchSummary, summaryKey: 'testRun' });

    await workflow.loadRunSummary();
    assert.equal(workflow.summary.value, null);
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads while active run exists', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    let callCount = 0;
    const fetchSummary = async () => {
      callCount += 1;
      return makeSummaryPayload({
        activeRun: { id: 'run-active', status: 'running' },
        currentRun: { id: 'run-active', status: 'running' },
      });
    };

    const workflow = useImportCandidateRunSummary({
      fetchSummary,
      pollIntervalMs: 30,
      summaryKey: 'testRun',
    });

    await workflow.loadRunSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('polling stops when active run completes', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    let callCount = 0;
    const fetchSummary = async () => {
      callCount += 1;
      if (callCount <= 2) {
        return makeSummaryPayload({
          activeRun: { id: 'run-active', status: 'running' },
          currentRun: { id: 'run-active', status: 'running' },
        });
      }
      return makeSummaryPayload({
        activeRun: null,
        currentRun: { id: 'run-1', status: 'completed' },
      });
    };

    const workflow = useImportCandidateRunSummary({
      fetchSummary,
      pollIntervalMs: 40,
      summaryKey: 'testRun',
    });

    await workflow.loadRunSummary();

    await waitFor(() => callCount === 3 && workflow.activeRun.value === null);
    const countAfterCompletedRun = callCount;

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, countAfterCompletedRun, 'polling stopped after active run completed');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    let callCount = 0;
    const fetchSummary = async () => {
      callCount += 1;
      return makeSummaryPayload({
        activeRun: { id: 'run-active', status: 'pending' },
        currentRun: { id: 'run-active', status: 'pending' },
      });
    };

    const workflow = useImportCandidateRunSummary({
      fetchSummary,
      pollIntervalMs: 30,
      summaryKey: 'testRun',
    });

    await workflow.loadRunSummary();
    assert.equal(callCount, 1);

    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useImportCandidateRunSummary } = await import('../../src/client/composables/useImportCandidateRunSummary.js');

    let callCount = 0;
    const fetchSummary = async () => {
      callCount += 1;
      return makeSummaryPayload({
        activeRun: { id: 'run-active', status: 'running' },
        currentRun: { id: 'run-active', status: 'running' },
      });
    };

    const workflow = useImportCandidateRunSummary({
      fetchSummary,
      pollIntervalMs: 0,
      summaryKey: 'testRun',
    });

    await workflow.loadRunSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});

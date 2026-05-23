import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useArtworkSummary } from '../../src/client/composables/useArtworkSummary.js';

function makeSummary({ latestRunStatus = 'completed' } = {}) {
  return {
    cleanup: { enabled: true },
    inventory: { total: 100 },
    latestRun: latestRunStatus ? { id: 'run-1', status: latestRunStatus } : null,
    summary: { message: 'ok', status: 'active' },
  };
}

function makeHistory() {
  return { runs: [{ id: 'run-1', status: 'completed', startedAt: '2026-05-01T00:00:00Z' }] };
}

function makeRunDetail() {
  return { run: { id: 'run-1', status: 'completed', summary: {} } };
}

describe('useArtworkSummary', () => {
  test('loadArtworkSummary populates summary, history, and selects run', async () => {
    const { artworkSummary, artworkCleanupHistory, selectedRun, loadArtworkSummary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();

    assert.equal(artworkSummary.value.summary.message, 'ok');
    assert.equal(artworkCleanupHistory.value.runs.length, 1);
    assert.equal(selectedRun.value.id, 'run-1');
    destroy();
  });

  test('loadArtworkSummary sets errorMessage on failure', async () => {
    const { errorMessage, artworkSummary, loadArtworkSummary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => { throw new Error('network error'); },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();

    assert.equal(errorMessage.value, 'network error');
    assert.equal(artworkSummary.value, null);
    destroy();
  });

  test('computed properties return null before load', () => {
    const { cleanup, inventory, latestRun, recentRuns, summary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => makeHistory(),
      pollIntervalMs: 0,
    });

    assert.equal(cleanup.value, null);
    assert.equal(inventory.value, null);
    assert.equal(latestRun.value, null);
    assert.deepEqual(recentRuns.value, []);
    assert.equal(summary.value, null);
    destroy();
  });

  test('startArtworkCleanup triggers run and reloads summary', async () => {
    let started = false;
    const { artworkSummary, startArtworkCleanup, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary({ latestRunStatus: started ? 'running' : 'completed' }),
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => ({ run: { id: 'run-1', status: started ? 'running' : 'completed' } }),
      startArtworkCleanupRun: async () => { started = true; },
      pollIntervalMs: 0,
    });

    await startArtworkCleanup();

    assert.equal(started, true);
    assert.equal(artworkSummary.value.latestRun.status, 'running');
    destroy();
  });

  test('startArtworkCleanup sets actionErrorMessage on failure', async () => {
    const { actionErrorMessage, startArtworkCleanup, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      startArtworkCleanupRun: async () => { throw new Error('already running'); },
      pollIntervalMs: 0,
    });

    await startArtworkCleanup();

    assert.equal(actionErrorMessage.value, 'already running');
    destroy();
  });

  test('selectArtworkCleanupRun updates selectedRun', async () => {
    const { selectedRunId, selectedRun, loadArtworkSummary, selectArtworkCleanupRun, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => ({ runs: [{ id: 'run-1' }, { id: 'run-2' }] }),
      fetchArtworkCleanupRunDetail: async (id) => ({ run: { id, status: 'completed' } }),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(selectedRunId.value, 'run-1');

    await selectArtworkCleanupRun('run-2');
    assert.equal(selectedRunId.value, 'run-2');
    assert.equal(selectedRun.value.id, 'run-2');
    destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { isRevalidating, loadArtworkSummary, revalidate, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(isRevalidating.value, false);

    const p = revalidate();
    assert.equal(isRevalidating.value, true);
    await p;
    assert.equal(isRevalidating.value, false);
    destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const { artworkSummary, loadArtworkSummary, revalidate, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => {
        callCount += 1;
        if (callCount === 1) return makeSummary();
        throw new Error('refresh failed');
      },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(artworkSummary.value.summary.message, 'ok');

    await revalidate();
    assert.equal(artworkSummary.value.summary.message, 'ok', 'stale data preserved on revalidation error');
    destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const { loadArtworkSummary, revalidate, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => {
        callCount += 1;
        return makeSummary();
      },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(callCount, 1);
    destroy();

    await revalidate();
    assert.equal(callCount, 1, 'no fetch after destroy');
  });

  test('destroy stops polling when active run present', async () => {
    let callCount = 0;
    const { loadArtworkSummary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => {
        callCount += 1;
        return makeSummary({ latestRunStatus: 'running' });
      },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => ({ run: { id: 'run-1', status: 'running' } }),
      pollIntervalMs: 50,
    });

    await loadArtworkSummary();
    assert.equal(callCount, 1);
    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('loadArtworkSummary is no-op after destroy', async () => {
    let callCount = 0;
    const { loadArtworkSummary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => {
        callCount += 1;
        return makeSummary();
      },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => makeRunDetail(),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(callCount, 1);
    destroy();

    await loadArtworkSummary();
    assert.equal(callCount, 1, 'no fetch after destroy');
  });

  test('loadSelectedRunDetail sets error on failure', async () => {
    const { runDetailErrorMessage, loadArtworkSummary, selectArtworkCleanupRun, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => makeSummary(),
      fetchArtworkCleanupHistory: async () => ({ runs: [{ id: 'run-1' }] }),
      fetchArtworkCleanupRunDetail: async () => { throw new Error('detail failed'); },
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    await selectArtworkCleanupRun('run-1');

    assert.equal(runDetailErrorMessage.value, 'detail failed');
    destroy();
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let callCount = 0;
    const { loadArtworkSummary, destroy } = useArtworkSummary({
      fetchArtworkSummary: async () => {
        callCount += 1;
        return makeSummary({ latestRunStatus: 'running' });
      },
      fetchArtworkCleanupHistory: async () => makeHistory(),
      fetchArtworkCleanupRunDetail: async () => ({ run: { id: 'run-1', status: 'running' } }),
      pollIntervalMs: 0,
    });

    await loadArtworkSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no polling when pollIntervalMs=0');
    destroy();
  });
});

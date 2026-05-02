import assert from 'node:assert/strict';
import test from 'node:test';
import { useArtworkSummary } from '../../src/client/composables/useArtworkSummary.js';

test('useArtworkSummary loads the shared artwork summary payload', async (t) => {
  const fetchArtworkCleanupHistory = t.mock.fn(async () => ({
    checkedAt: '2026-05-01T12:05:00.000Z',
    runs: [{
      id: 'run-0',
      status: 'completed',
    }],
  }));
  const fetchArtworkCleanupRunDetail = t.mock.fn(async (runId) => ({
    checkedAt: '2026-05-01T12:06:00.000Z',
    run: {
      failures: [],
      id: runId,
      status: 'completed',
    },
  }));
  const fetchArtworkSummary = t.mock.fn(async () => ({
    cleanup: {
      retentionCutoff: '2026-01-31T12:00:00.000Z',
      unassignedRetentionDays: 90,
    },
    inventory: {
      eligibleAssetCount: 2,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 4,
    },
    latestRun: null,
    summary: {
      status: 'ready',
      message: '2 unassigned artwork assets are eligible for retention cleanup now.',
    },
  }));
  const workflow = useArtworkSummary({
    fetchArtworkCleanupHistory,
    fetchArtworkCleanupRunDetail,
    fetchArtworkSummary,
  });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadArtworkSummary();

  assert.equal(fetchArtworkCleanupHistory.mock.callCount(), 1);
  assert.equal(fetchArtworkCleanupRunDetail.mock.callCount(), 1);
  assert.equal(fetchArtworkSummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.cleanup.value.unassignedRetentionDays, 90);
  assert.equal(workflow.inventory.value.eligibleAssetCount, 2);
  assert.equal(workflow.recentRuns.value.length, 1);
  assert.equal(workflow.selectedRunId.value, 'run-0');
  assert.equal(workflow.selectedRun.value.id, 'run-0');
  assert.equal(workflow.summary.value.status, 'ready');
  assert.equal(workflow.latestRun.value, null);
});

test('useArtworkSummary preserves an explicit preferred run id even when it falls outside recent history', async (t) => {
  const fetchArtworkCleanupHistory = t.mock.fn(async () => ({
    checkedAt: '2026-05-01T12:05:00.000Z',
    runs: [{
      id: 'run-0',
      status: 'completed',
    }],
  }));
  const fetchArtworkCleanupRunDetail = t.mock.fn(async (runId) => ({
    checkedAt: '2026-05-01T12:06:00.000Z',
    run: {
      failures: [],
      id: runId,
      status: 'failed',
    },
  }));
  const fetchArtworkSummary = t.mock.fn(async () => ({
    cleanup: {
      retentionCutoff: '2026-01-31T12:00:00.000Z',
      unassignedRetentionDays: 90,
    },
    inventory: {
      eligibleAssetCount: 2,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 4,
    },
    latestRun: {
      id: 'run-0',
      status: 'completed',
    },
    summary: {
      status: 'failed',
      message: 'The latest artwork cleanup run failed and needs operator review.',
    },
  }));
  const workflow = useArtworkSummary({
    fetchArtworkCleanupHistory,
    fetchArtworkCleanupRunDetail,
    fetchArtworkSummary,
  });

  await workflow.loadArtworkSummary({ preferredRunId: 'run-older-44' });

  assert.equal(fetchArtworkCleanupRunDetail.mock.callCount(), 1);
  assert.equal(fetchArtworkCleanupRunDetail.mock.calls[0].arguments[0], 'run-older-44');
  assert.equal(workflow.selectedRunId.value, 'run-older-44');
  assert.equal(workflow.selectedRun.value.id, 'run-older-44');
});

test('useArtworkSummary clears stale state when the artwork summary fetch fails', async () => {
  const workflow = useArtworkSummary({
    fetchArtworkCleanupHistory: async () => ({ runs: [] }),
    fetchArtworkCleanupRunDetail: async () => ({ run: { id: 'unused' } }),
    fetchArtworkSummary: async () => {
      throw new Error('artwork summary unavailable');
    },
  });

  await workflow.loadArtworkSummary();

  assert.equal(workflow.artworkSummary.value, null);
  assert.equal(workflow.artworkCleanupHistory.value, null);
  assert.equal(workflow.errorMessage.value, 'artwork summary unavailable');
  assert.deepEqual(workflow.recentRuns.value, []);
  assert.equal(workflow.selectedRun.value, null);
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.inventory.value, null);
});

test('useArtworkSummary starts a cleanup run and reloads the shared summary payload', async (t) => {
  const fetchArtworkCleanupHistory = t.mock.fn(async () => ({
    checkedAt: '2026-05-01T12:05:00.000Z',
    runs: [{
      id: 'run-1',
      status: 'pending',
    }],
  }));
  const fetchArtworkCleanupRunDetail = t.mock.fn(async (runId) => ({
    checkedAt: '2026-05-01T12:06:00.000Z',
    run: {
      id: runId,
      status: 'pending',
    },
  }));
  const fetchArtworkSummary = t.mock.fn(async () => ({
    cleanup: {
      retentionCutoff: '2026-01-31T12:00:00.000Z',
      unassignedRetentionDays: 90,
    },
    inventory: {
      eligibleAssetCount: 0,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 2,
    },
    latestRun: {
      id: 'run-1',
      status: 'pending',
    },
    summary: {
      status: 'pending',
      message: 'An artwork cleanup run has been queued but has not started yet.',
    },
  }));
  const startArtworkCleanupRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'run-1',
      status: 'pending',
    },
  }));
  const workflow = useArtworkSummary({
    fetchArtworkCleanupHistory,
    fetchArtworkCleanupRunDetail,
    fetchArtworkSummary,
    startArtworkCleanupRun,
  });

  await workflow.startArtworkCleanup();

  assert.equal(startArtworkCleanupRun.mock.callCount(), 1);
  assert.equal(fetchArtworkCleanupHistory.mock.callCount(), 1);
  assert.equal(fetchArtworkCleanupRunDetail.mock.callCount(), 1);
  assert.equal(fetchArtworkSummary.mock.callCount(), 1);
  assert.equal(workflow.actionErrorMessage.value, '');
  assert.equal(workflow.isStarting.value, false);
  assert.equal(workflow.recentRuns.value[0].id, 'run-1');
  assert.equal(workflow.selectedRun.value.id, 'run-1');
  assert.equal(workflow.summary.value.status, 'pending');
  assert.equal(workflow.latestRun.value.status, 'pending');
});

test('useArtworkSummary can load a selected cleanup run detail independently of summary refresh', async (t) => {
  const fetchArtworkCleanupRunDetail = t.mock.fn(async (runId) => ({
    checkedAt: '2026-05-01T12:07:00.000Z',
    run: {
      failures: [{ code: 'EACCES' }],
      id: runId,
      status: 'failed',
    },
  }));
  const workflow = useArtworkSummary({
    fetchArtworkCleanupHistory: async () => ({ runs: [] }),
    fetchArtworkCleanupRunDetail,
    fetchArtworkSummary: async () => ({ latestRun: null }),
  });

  await workflow.selectArtworkCleanupRun('run-22');

  assert.equal(fetchArtworkCleanupRunDetail.mock.callCount(), 1);
  assert.equal(workflow.selectedRunId.value, 'run-22');
  assert.equal(workflow.selectedRun.value.status, 'failed');
  assert.equal(workflow.runDetailErrorMessage.value, '');
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { useLibraryDiscoverySummary } from '../../src/client/composables/useLibraryDiscoverySummary.js';

test('useLibraryDiscoverySummary loads the shared discovery payload', async (t) => {
  const fetchLibraryDiscoverySummary = t.mock.fn(async () => ({
    heartbeat: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
    latestRun: {
      dispatchedCount: 2,
      id: 'run-2',
      status: 'completed',
    },
    nextEligibleAt: '2026-04-30T18:00:00.000Z',
    requestCounts: {
      blocked: 1,
      cooldown: 2,
      ready: 3,
      totalRequests: 6,
    },
    summary: {
      status: 'ready',
      message: '3 discovery requests are ready to search now.',
    },
  }));
  const workflow = useLibraryDiscoverySummary({ fetchLibraryDiscoverySummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadLibraryDiscoverySummary();

  assert.equal(fetchLibraryDiscoverySummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.requestCounts.value, {
    blocked: 1,
    cooldown: 2,
    ready: 3,
    totalRequests: 6,
  });
  assert.equal(workflow.latestRun.value.id, 'run-2');
  assert.equal(workflow.summary.value.status, 'ready');
});

test('useLibraryDiscoverySummary clears stale state when the summary fetch fails', async () => {
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoverySummary: async () => {
      throw new Error('library discovery summary unavailable');
    },
  });

  await workflow.loadLibraryDiscoverySummary();

  assert.equal(workflow.libraryDiscoverySummary.value, null);
  assert.equal(workflow.errorMessage.value, 'library discovery summary unavailable');
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.requestCounts.value, null);
});

test('useLibraryDiscoverySummary starts a protected discovery run and refreshes the summary', async (t) => {
  const fetchLibraryDiscoverySummary = t.mock.fn(async () => ({
    heartbeat: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    lastEvaluatedAt: '2026-04-30T14:30:00.000Z',
    latestRun: {
      dispatchedCount: 1,
      id: 'run-9',
      status: 'pending',
    },
    nextEligibleAt: '2026-04-30T18:00:00.000Z',
    requestCounts: {
      blocked: 0,
      cooldown: 2,
      ready: 1,
      totalRequests: 3,
    },
    summary: {
      status: 'ready',
      message: '1 discovery request is ready to search now.',
    },
  }));
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'run-9',
      status: 'pending',
    },
  }));
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoverySummary,
    startLibraryDiscoveryRun,
  });

  await workflow.startDiscoveryRun();

  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 1);
  assert.equal(fetchLibraryDiscoverySummary.mock.callCount(), 1);
  assert.equal(workflow.actionErrorMessage.value, '');
  assert.equal(workflow.isStarting.value, false);
  assert.equal(workflow.latestRun.value.id, 'run-9');
});

test('useLibraryDiscoverySummary can load an exact historical discovery run independently of the latest summary run', async () => {
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoveryRunDetail: async (runId) => ({
      libraryDiscoveryRun: {
        checkedAt: '2026-05-01T01:05:00.000Z',
        run: {
          candidateCount: 4,
          dispatchedCount: 2,
          id: runId,
          status: 'failed',
          triggerSource: 'manual',
        },
      },
    }),
    fetchLibraryDiscoverySummary: async () => ({
      heartbeat: {
        intervalLabel: '15 minutes',
        intervalMs: 900000,
        mode: 'automatic',
        source: 'default',
      },
      lastEvaluatedAt: '2026-05-01T00:30:00.000Z',
      latestRun: {
        id: 'discovery-run-latest',
        status: 'completed',
      },
      nextEligibleAt: '2026-05-01T02:00:00.000Z',
      requestCounts: {
        blocked: 0,
        cooldown: 2,
        ready: 1,
        totalRequests: 3,
      },
      summary: {
        status: 'ready',
        message: '1 discovery request is ready to search now.',
      },
    }),
  });

  await workflow.loadLibraryDiscoverySummary({ preferredRunId: 'discovery-run-older-3' });

  assert.equal(workflow.selectedRunId.value, 'discovery-run-older-3');
  assert.equal(workflow.currentRun.value.id, 'discovery-run-older-3');
  assert.equal(workflow.runDetailErrorMessage.value, '');
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { useLibraryDiscoverySummary } from '../../src/client/composables/useLibraryDiscoverySummary.js';

function makeSummary(overrides = {}) {
  return {
    checkedAt: '2026-06-27T22:00:00.000Z',
    heartbeat: {
      intervalLabel: '15 minutes',
      state: { lastOutcome: 'skipped', lastSkipReason: 'not_due' },
    },
    latestRun: null,
    requestCounts: {
      blocked: 0,
      cooldown: 1,
      ready: 2,
      totalRequests: 3,
    },
    summary: {
      message: '2 discovery requests are ready to search now.',
      status: 'ready',
    },
    ...overrides,
  };
}

test('useLibraryDiscoverySummary loads queue state and derived start readiness', async (t) => {
  const fetchLibraryDiscoverySummary = t.mock.fn(async () => makeSummary());
  const workflow = useLibraryDiscoverySummary({ fetchLibraryDiscoverySummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadLibraryDiscoverySummary();

  assert.equal(fetchLibraryDiscoverySummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.requestCounts.value.ready, 2);
  assert.equal(workflow.summary.value.status, 'ready');
  assert.equal(workflow.canStartDiscovery.value, true);

  workflow.destroy();
});

test('useLibraryDiscoverySummary preserves stale summary on revalidation error', async () => {
  let callCount = 0;
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoverySummary: async () => {
      callCount += 1;
      if (callCount === 1) {
        return makeSummary();
      }
      throw new Error('summary failed');
    },
  });

  await workflow.loadLibraryDiscoverySummary();
  assert.equal(workflow.requestCounts.value.ready, 2);

  await workflow.loadLibraryDiscoverySummary();

  assert.equal(workflow.requestCounts.value.ready, 2);
  assert.equal(workflow.errorMessage.value, 'summary failed');

  workflow.destroy();
});

test('useLibraryDiscoverySummary starts discovery dispatch and reloads summary', async (t) => {
  const fetchLibraryDiscoverySummary = t.mock.fn(async () => makeSummary({
    latestRun: { id: 'run-1', status: 'completed' },
  }));
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({
    accepted: true,
    run: { id: 'run-2', status: 'pending' },
  }));
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoverySummary,
    startLibraryDiscoveryRun,
  });

  await workflow.loadLibraryDiscoverySummary();
  const result = await workflow.startDiscoveryDispatch();

  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 1);
  assert.equal(fetchLibraryDiscoverySummary.mock.callCount(), 2);
  assert.equal(result.run.id, 'run-2');
  assert.equal(workflow.startErrorMessage.value, '');

  workflow.destroy();
});

test('useLibraryDiscoverySummary does not start discovery when a run is active', async (t) => {
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true }));
  const workflow = useLibraryDiscoverySummary({
    fetchLibraryDiscoverySummary: async () => makeSummary({
      latestRun: { id: 'run-active', status: 'running' },
    }),
    startLibraryDiscoveryRun,
  });

  await workflow.loadLibraryDiscoverySummary();
  const result = await workflow.startDiscoveryDispatch();

  assert.equal(result, null);
  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 0);
  assert.equal(workflow.canStartDiscovery.value, false);

  workflow.destroy();
});

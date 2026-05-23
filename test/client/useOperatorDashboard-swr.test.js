import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('useLibraryWantedSummary SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useLibraryWantedSummary } = await import('../../src/client/composables/useLibraryWantedSummary.js');

    const workflow = useLibraryWantedSummary({
      fetchLibraryWantedSummary: async () => ({ releaseCounts: { totalWanted: 0 } }),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadLibraryWantedSummary();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useLibraryWantedSummary } = await import('../../src/client/composables/useLibraryWantedSummary.js');

    const workflow = useLibraryWantedSummary({
      fetchLibraryWantedSummary: async () => ({ releaseCounts: { totalWanted: 1 } }),
    });

    await workflow.loadLibraryWantedSummary();
    const secondLoad = workflow.loadLibraryWantedSummary();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useLibraryWantedSummary } = await import('../../src/client/composables/useLibraryWantedSummary.js');

    let callCount = 0;
    const fetchLibraryWantedSummary = async () => {
      callCount += 1;
      return { releaseCounts: { totalWanted: callCount } };
    };

    const workflow = useLibraryWantedSummary({ fetchLibraryWantedSummary, pollIntervalMs: 30 });

    await workflow.loadLibraryWantedSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useLibraryWantedSummary } = await import('../../src/client/composables/useLibraryWantedSummary.js');

    let callCount = 0;
    const fetchLibraryWantedSummary = async () => {
      callCount += 1;
      return { releaseCounts: { totalWanted: 1 } };
    };

    const workflow = useLibraryWantedSummary({ fetchLibraryWantedSummary, pollIntervalMs: 30 });

    await workflow.loadLibraryWantedSummary();
    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useLibraryWantedSummary } = await import('../../src/client/composables/useLibraryWantedSummary.js');

    let callCount = 0;
    const fetchLibraryWantedSummary = async () => {
      callCount += 1;
      return { releaseCounts: { totalWanted: 1 } };
    };

    const workflow = useLibraryWantedSummary({ fetchLibraryWantedSummary, pollIntervalMs: 0 });

    await workflow.loadLibraryWantedSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});

describe('useLibraryWantedReleases SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useLibraryWantedReleases } = await import('../../src/client/composables/useLibraryWantedReleases.js');

    const composable = useLibraryWantedReleases({
      fetchLibraryWantedReleases: async () => ({ total: 0, wantedReleases: [] }),
    });

    assert.equal(composable.isRevalidating.value, false);
    await composable.loadWantedReleases();
    assert.equal(composable.isRevalidating.value, false);

    composable.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useLibraryWantedReleases } = await import('../../src/client/composables/useLibraryWantedReleases.js');

    const composable = useLibraryWantedReleases({
      fetchLibraryWantedReleases: async () => ({ total: 1, wantedReleases: [{ id: 'r-1', wantedStatus: 'missing' }] }),
    });

    await composable.loadWantedReleases();
    const secondLoad = composable.loadWantedReleases();
    assert.equal(composable.isRevalidating.value, true);
    await secondLoad;
    assert.equal(composable.isRevalidating.value, false);

    composable.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useLibraryWantedReleases } = await import('../../src/client/composables/useLibraryWantedReleases.js');

    let callCount = 0;
    const fetchLibraryWantedReleases = async () => {
      callCount += 1;
      return { total: 1, wantedReleases: [{ id: `r-${callCount}`, wantedStatus: 'missing' }] };
    };

    const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases, pollIntervalMs: 30 });

    await composable.loadWantedReleases();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    composable.destroy();
  });

  test('destroy stops polling', async () => {
    const { useLibraryWantedReleases } = await import('../../src/client/composables/useLibraryWantedReleases.js');

    let callCount = 0;
    const fetchLibraryWantedReleases = async () => {
      callCount += 1;
      return { total: 1, wantedReleases: [{ id: 'r-1', wantedStatus: 'missing' }] };
    };

    const composable = useLibraryWantedReleases({ fetchLibraryWantedReleases, pollIntervalMs: 30 });

    await composable.loadWantedReleases();
    composable.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });
});

describe('useOperatorRequests SWR', () => {
  function makeSummary() {
    return { counts: { totalRequests: 5 }, fulfillmentCounts: { active: 2 }, summary: { message: '2 active' } };
  }

  function makeRequests() {
    return { mediaRequests: [{ id: 'req-1', requestKind: 'release' }] };
  }

  test('isRevalidating is false initially and after first load', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary: async () => makeSummary(),
      fetchMediaRequests: async () => makeRequests(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadRequests();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary: async () => makeSummary(),
      fetchMediaRequests: async () => makeRequests(),
    });

    await workflow.loadRequests();
    const secondLoad = workflow.loadRequests();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    let callCount = 0;
    const fetchMediaRequestSummary = async () => {
      callCount += 1;
      if (callCount === 1) return makeSummary();
      throw new Error('network fail');
    };

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary,
      fetchMediaRequests: async () => makeRequests(),
    });

    await workflow.loadRequests();
    assert.equal(workflow.mediaRequests.value.length, 1);

    await workflow.loadRequests();
    assert.equal(workflow.mediaRequests.value.length, 1, 'stale requests preserved');
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary: async () => { throw new Error('first fail'); },
      fetchMediaRequests: async () => makeRequests(),
    });

    await workflow.loadRequests();
    assert.equal(workflow.requestSummary.value, null);
    assert.equal(workflow.mediaRequests.value.length, 0);
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    let callCount = 0;
    const fetchMediaRequestSummary = async () => {
      callCount += 1;
      return makeSummary();
    };

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary,
      fetchMediaRequests: async () => makeRequests(),
      pollIntervalMs: 30,
    });

    await workflow.loadRequests();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    let callCount = 0;
    const fetchMediaRequestSummary = async () => {
      callCount += 1;
      return makeSummary();
    };

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary,
      fetchMediaRequests: async () => makeRequests(),
      pollIntervalMs: 30,
    });

    await workflow.loadRequests();
    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useOperatorRequests } = await import('../../src/client/composables/useOperatorRequests.js');

    let callCount = 0;
    const fetchMediaRequestSummary = async () => {
      callCount += 1;
      return makeSummary();
    };

    const workflow = useOperatorRequests({
      fetchMediaRequestSummary,
      fetchMediaRequests: async () => makeRequests(),
      pollIntervalMs: 0,
    });

    await workflow.loadRequests();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});

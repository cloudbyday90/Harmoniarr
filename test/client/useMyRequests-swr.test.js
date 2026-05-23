import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeRequest(code) {
  return { id: `r-${code}`, fulfillmentStatus: { code } };
}

function createFetchDouble(requests, summary = {}) {
  return async () => ({
    mediaRequests: requests,
    totalCount: requests.length,
    ...summary,
  });
}

describe('useMyRequests SWR polling', () => {
  test('hasActiveFulfillment drives isRevalidating on re-fetch', async () => {
    const { useMyRequests } = await import('../../src/client/composables/useMyRequests.js');

    const activeRequests = [makeRequest('downloading')];
    const fetchRequests = createFetchDouble(activeRequests, {
      fulfillmentCounts: { active: 1, downloading: 1 },
    });

    const { requests, isLoading, isRevalidating, loadRequests, destroy } = useMyRequests({
      fetchRequests,
      pollIntervalMs: 50,
    });

    try {
      assert.equal(isLoading.value, true);
      await loadRequests();
      assert.equal(isLoading.value, false);
      assert.equal(requests.value.length, 1);
      assert.equal(isRevalidating.value, false);
    } finally {
      destroy();
    }
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useMyRequests } = await import('../../src/client/composables/useMyRequests.js');

    const activeRequests = [makeRequest('downloading')];
    const fetchRequests = createFetchDouble(activeRequests);

    const { requests, loadRequests, destroy } = useMyRequests({
      fetchRequests,
      pollIntervalMs: 0,
    });

    try {
      await loadRequests();
      assert.equal(requests.value.length, 1);
    } finally {
      destroy();
    }
  });

  test('destroy clears polling timer', async () => {
    const { useMyRequests } = await import('../../src/client/composables/useMyRequests.js');

    let callCount = 0;
    const fetchRequests = async () => {
      callCount += 1;
      return { mediaRequests: [makeRequest('downloading')], totalCount: 1 };
    };

    const { loadRequests, destroy } = useMyRequests({
      fetchRequests,
      pollIntervalMs: 50,
    });

    await loadRequests();
    assert.equal(callCount, 1);
    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('isRevalidating is true during background re-fetch', async () => {
    const { useMyRequests } = await import('../../src/client/composables/useMyRequests.js');

    const fetchRequests = async () => {
      return { mediaRequests: [makeRequest('downloading')], totalCount: 1 };
    };

    const { isRevalidating, loadRequests, destroy } = useMyRequests({
      fetchRequests,
      pollIntervalMs: 0,
    });

    try {
      await loadRequests();
      assert.equal(isRevalidating.value, false);

      const secondLoad = loadRequests();
      assert.equal(isRevalidating.value, true);
      await secondLoad;
      assert.equal(isRevalidating.value, false);
    } finally {
      destroy();
    }
  });

  test('preserves stale data on revalidation failure', async () => {
    const { useMyRequests } = await import('../../src/client/composables/useMyRequests.js');

    let callCount = 0;
    const fetchRequests = async () => {
      callCount += 1;
      if (callCount === 1) {
        return { mediaRequests: [makeRequest('downloading')], totalCount: 1 };
      }
      throw new Error('network error');
    };

    const { requests, errorMessage, loadRequests, destroy } = useMyRequests({
      fetchRequests,
      pollIntervalMs: 0,
    });

    try {
      await loadRequests();
      assert.equal(requests.value.length, 1);

      await loadRequests();
      assert.equal(requests.value.length, 1, 'stale data preserved on revalidation failure');
      assert.equal(errorMessage.value, 'network error');
    } finally {
      destroy();
    }
  });
});

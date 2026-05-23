import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeEntry(overrides = {}) {
  return {
    id: 'entry-1',
    entryType: 'operation_run',
    title: 'Library scan',
    status: 'completed',
    message: 'Scan finished',
    occurredAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('useActivityHistory SWR', () => {
  test('exposes isRevalidating from useAsyncResource', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({ entries: [makeEntry()] }),
    });

    assert.equal(history.isRevalidating.value, false);
    await history.load();
    assert.equal(history.isRevalidating.value, false);
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({ entries: [makeEntry()] }),
    });

    await history.load();

    const secondLoad = history.load();
    assert.equal(history.isRevalidating.value, true);
    await secondLoad;
    assert.equal(history.isRevalidating.value, false);
  });

  test('preserves stale entries on revalidation error', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    let callCount = 0;
    const fetchSystemActivityFeed = async () => {
      callCount += 1;
      if (callCount === 1) return { entries: [makeEntry()] };
      throw new Error('revalidation fail');
    };

    const history = useActivityHistory({ fetchSystemActivityFeed });

    await history.load();
    assert.equal(history.entries.value.length, 1);

    await history.load();
    assert.equal(history.entries.value.length, 1, 'stale entries preserved');
    assert.equal(history.errorMessage.value, 'revalidation fail');
  });

  test('exposes lastRefreshedAt after successful load', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({ entries: [makeEntry()] }),
    });

    assert.equal(history.lastRefreshedAt.value, null);

    await history.load();
    assert.ok(history.lastRefreshedAt.value !== null, 'lastRefreshedAt set after load');
  });

  test('accepts pollIntervalMs and revalidateOnFocus options', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const fetchSystemActivityFeed = async () => ({ entries: [] });
    const history = useActivityHistory({
      fetchSystemActivityFeed,
      pollIntervalMs: 5000,
      revalidateOnFocus: true,
    });

    assert.equal(history.isRevalidating.value, false);
    assert.equal(history.isLoading.value, false);
  });
});

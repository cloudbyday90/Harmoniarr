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

describe('useActivityHistory', () => {
  test('starts with empty entries and no loading', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({ entries: [] }),
    });

    assert.deepEqual(history.entries.value, []);
    assert.equal(history.entryCount.value, 0);
    assert.equal(history.isLoading.value, false);
    assert.equal(history.errorMessage.value, '');
  });

  test('load populates entries from API response', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const entry = makeEntry();
    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({ entries: [entry] }),
    });

    await history.load();

    assert.equal(history.entries.value.length, 1);
    assert.equal(history.entries.value[0].id, 'entry-1');
    assert.equal(history.entryCount.value, 1);
    assert.equal(history.isLoading.value, false);
  });

  test('load passes limit to fetcher', async (t) => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const fetchSystemActivityFeed = t.mock.fn(async () => ({ entries: [] }));
    const history = useActivityHistory({
      fetchSystemActivityFeed,
      limit: 25,
    });

    await history.load();

    const [{ limit }] = fetchSystemActivityFeed.mock.calls[0].arguments;
    assert.equal(limit, 25);
  });

  test('load handles missing entries field gracefully', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => ({}),
    });

    await history.load();

    assert.deepEqual(history.entries.value, []);
    assert.equal(history.entryCount.value, 0);
  });

  test('load sets errorMessage on failure', async () => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const history = useActivityHistory({
      fetchSystemActivityFeed: async () => { throw new Error('server error'); },
    });

    await history.load();

    assert.equal(history.errorMessage.value, 'server error');
    assert.equal(history.isLoading.value, false);
    assert.deepEqual(history.entries.value, []);
  });

  test('uses injectable fetchSystemActivityFeed', async (t) => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const fetchSystemActivityFeed = t.mock.fn(async () => ({ entries: [] }));
    const history = useActivityHistory({ fetchSystemActivityFeed });

    await history.load();

    assert.equal(fetchSystemActivityFeed.mock.callCount(), 1);
  });

  test('defaults limit to 100', async (t) => {
    const { useActivityHistory } = await import('../../src/client/composables/useActivityHistory.js');

    const fetchSystemActivityFeed = t.mock.fn(async () => ({ entries: [] }));
    const history = useActivityHistory({ fetchSystemActivityFeed });

    await history.load();

    const [{ limit }] = fetchSystemActivityFeed.mock.calls[0].arguments;
    assert.equal(limit, 100);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makePagePayload(overrides = {}) {
  return {
    checkedAt: '2026-06-01T12:00:00.000Z',
    entries: [],
    pageInfo: { hasMore: false, nextCursor: null },
    ...overrides,
  };
}

describe('useActivityFeedPagination', () => {
  test('starts with empty entries and no pagination state', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const feed = useActivityFeedPagination({
      fetchActivityFeed: async () => makePagePayload(),
    });

    assert.deepEqual(feed.entries.value, []);
    assert.equal(feed.checkedAt.value, null);
    assert.equal(feed.hasMore.value, false);
    assert.equal(feed.isLoadingMore.value, false);
    assert.equal(feed.errorMessage.value, '');
    assert.deepEqual(feed.pageInfo.value, { hasMore: false, nextCursor: null });
  });

  test('reset sets entries, checkedAt, and pageInfo', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const feed = useActivityFeedPagination({
      fetchActivityFeed: async () => makePagePayload(),
    });

    feed.reset(
      [{ id: 'e1', title: 'Test' }],
      '2026-06-01T10:00:00.000Z',
      { hasMore: true, nextCursor: 'cursor-1' },
    );

    assert.equal(feed.entries.value.length, 1);
    assert.equal(feed.checkedAt.value, '2026-06-01T10:00:00.000Z');
    assert.equal(feed.hasMore.value, true);
  });

  test('loadMore appends entries and updates cursor', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    let callCount = 0;
    const fetchActivityFeed = async ({ before }) => {
      callCount += 1;
      if (callCount === 1) {
        assert.equal(before, 'cursor-1');
        return makePagePayload({
          entries: [{ id: 'e2', title: 'Second' }],
          pageInfo: { hasMore: false, nextCursor: null },
        });
      }
      return makePagePayload();
    };

    const feed = useActivityFeedPagination({ fetchActivityFeed });

    feed.reset(
      [{ id: 'e1', title: 'First' }],
      '2026-06-01T10:00:00.000Z',
      { hasMore: true, nextCursor: 'cursor-1' },
    );

    await feed.loadMore();

    assert.equal(feed.entries.value.length, 2);
    assert.equal(feed.entries.value[0].id, 'e1');
    assert.equal(feed.entries.value[1].id, 'e2');
    assert.equal(feed.hasMore.value, false);
    assert.equal(callCount, 1);
  });

  test('loadMore is no-op when hasMore is false', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const fetchActivityFeed = async () => {
      throw new Error('should not be called');
    };

    const feed = useActivityFeedPagination({ fetchActivityFeed });
    feed.reset([], null, { hasMore: false, nextCursor: null });

    await feed.loadMore();

    assert.equal(feed.entries.value.length, 0);
  });

  test('loadMore is no-op when already loading', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    let callCount = 0;
    const fetchActivityFeed = async () => {
      callCount += 1;
      return makePagePayload({
        entries: [{ id: 'e2' }],
        pageInfo: { hasMore: false, nextCursor: null },
      });
    };

    const feed = useActivityFeedPagination({ fetchActivityFeed });
    feed.reset([], null, { hasMore: true, nextCursor: 'c1' });

    const first = feed.loadMore();
    feed.isLoadingMore.value = true;
    await feed.loadMore();
    await first;

    assert.equal(callCount, 1, 'only one fetch despite concurrent loadMore calls');
  });

  test('loadMore sets errorMessage on fetch failure', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const fetchActivityFeed = async () => {
      throw new Error('network failure');
    };

    const feed = useActivityFeedPagination({ fetchActivityFeed });
    feed.reset([], null, { hasMore: true, nextCursor: 'c1' });

    await feed.loadMore();

    assert.equal(feed.errorMessage.value, 'network failure');
    assert.equal(feed.isLoadingMore.value, false);
  });

  test('loadMore preserves stale entries on failure', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const fetchActivityFeed = async () => {
      throw new Error('fail');
    };

    const feed = useActivityFeedPagination({ fetchActivityFeed });
    feed.reset(
      [{ id: 'e1', title: 'Existing' }],
      '2026-06-01T10:00:00.000Z',
      { hasMore: true, nextCursor: 'c1' },
    );

    await feed.loadMore();

    assert.equal(feed.entries.value.length, 1);
    assert.equal(feed.entries.value[0].id, 'e1');
  });

  test('reset with no arguments clears to defaults', async () => {
    const { useActivityFeedPagination } = await import('../../src/client/composables/useActivityFeedPagination.js');

    const feed = useActivityFeedPagination({
      fetchActivityFeed: async () => makePagePayload(),
    });

    feed.reset(
      [{ id: 'e1' }],
      '2026-06-01T10:00:00.000Z',
      { hasMore: true, nextCursor: 'c1' },
    );

    feed.reset();

    assert.deepEqual(feed.entries.value, []);
    assert.equal(feed.checkedAt.value, null);
    assert.equal(feed.hasMore.value, false);
    assert.equal(feed.errorMessage.value, '');
  });
});

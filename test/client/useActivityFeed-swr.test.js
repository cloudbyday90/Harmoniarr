import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    eventType: 'request_created',
    actorUserId: 'user-1',
    entityType: 'media_request',
    entityId: 'req-1',
    entityTitle: 'OK Computer',
    entityArtist: 'Radiohead',
    extraPayload: null,
    occurredAt: '2026-06-01T11:00:00.000Z',
    ...overrides,
  };
}

function makeFeedPayload(overrides = {}) {
  return {
    ok: true,
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [],
    total: 0,
    ...overrides,
  };
}

describe('useActivityFeed SWR', () => {
  test('isRevalidating is false on first load', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    const feed = useActivityFeed({
      fetchFeedFn: async () => makeFeedPayload({ events: [makeEvent()] }),
    });

    assert.equal(feed.isRevalidating.value, false);
    await feed.load();
    assert.equal(feed.isRevalidating.value, false);
  });

  test('isRevalidating is true during second load', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    const feed = useActivityFeed({
      fetchFeedFn: async () => makeFeedPayload({ events: [makeEvent()] }),
    });

    await feed.load();
    assert.equal(feed.isRevalidating.value, false);

    const secondLoad = feed.load();
    assert.equal(feed.isRevalidating.value, true);
    await secondLoad;
    assert.equal(feed.isRevalidating.value, false);
  });

  test('preserves stale events on revalidation failure', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    let callCount = 0;
    const fetchFeedFn = async () => {
      callCount += 1;
      if (callCount === 1) return makeFeedPayload({ events: [makeEvent()], total: 1 });
      throw new Error('network error');
    };

    const feed = useActivityFeed({ fetchFeedFn });

    await feed.load();
    assert.equal(feed.events.value.length, 1);

    await feed.load();
    assert.equal(feed.events.value.length, 1, 'stale events preserved');
    assert.equal(feed.checkedAt.value, '2026-06-01T12:00:00.000Z', 'stale checkedAt preserved');
    assert.equal(feed.total.value, 1, 'stale total preserved');
    assert.equal(feed.errorMessage.value, 'network error');
  });

  test('clears data on first-load error', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    const fetchFeedFn = async () => { throw new Error('first fail'); };
    const feed = useActivityFeed({ fetchFeedFn });

    await feed.load();
    assert.deepEqual(feed.events.value, []);
    assert.equal(feed.checkedAt.value, null);
    assert.equal(feed.total.value, 0);
    assert.equal(feed.errorMessage.value, 'first fail');
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    let callCount = 0;
    const fetchFeedFn = async () => {
      callCount += 1;
      return makeFeedPayload({ events: [makeEvent()] });
    };

    const feed = useActivityFeed({ fetchFeedFn, pollIntervalMs: 30 });

    await feed.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    feed.destroy();
  });

  test('destroy stops polling', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    let callCount = 0;
    const fetchFeedFn = async () => {
      callCount += 1;
      return makeFeedPayload();
    };

    const feed = useActivityFeed({ fetchFeedFn, pollIntervalMs: 30 });

    await feed.load();
    assert.equal(callCount, 1);

    feed.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('destroy is safe to call multiple times', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    const fetchFeedFn = async () => makeFeedPayload();
    const feed = useActivityFeed({ fetchFeedFn });

    await feed.load();
    feed.destroy();
    feed.destroy();
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useActivityFeed } = await import('../../src/client/composables/useActivityFeed.js');

    let callCount = 0;
    const fetchFeedFn = async () => {
      callCount += 1;
      return makeFeedPayload();
    };

    const feed = useActivityFeed({ fetchFeedFn, pollIntervalMs: 0 });

    await feed.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1, 'no polling when pollIntervalMs is 0');

    feed.destroy();
  });
});

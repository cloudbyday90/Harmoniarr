import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeQueuePayload(candidates = [], overrides = {}) {
  return {
    importCandidates: {
      candidates: candidates.map((c, i) => ({
        id: c.id ?? `cand-${i}`,
        status: c.status ?? 'pending',
        folderPath: c.folderPath ?? `/music/album-${i}`,
        ...c,
      })),
      pagination: { limit: 25, offset: 0, total: candidates.length },
      filters: {},
    },
    ...overrides,
  };
}

describe('useImportReviewQueue SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    const queue = useImportReviewQueue({
      listCandidates: async () => makeQueuePayload(),
    });

    assert.equal(queue.isRevalidating.value, false);
    await queue.loadQueue();
    assert.equal(queue.isRevalidating.value, false);
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    const queue = useImportReviewQueue({
      listCandidates: async () => makeQueuePayload(),
    });

    await queue.loadQueue();
    assert.equal(queue.isRevalidating.value, false);

    const secondLoad = queue.loadQueue();
    assert.equal(queue.isRevalidating.value, true);
    await secondLoad;
    assert.equal(queue.isRevalidating.value, false);
  });

  test('preserves stale data on revalidation error', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    let callCount = 0;
    const listCandidates = async () => {
      callCount += 1;
      if (callCount === 1) {
        return makeQueuePayload([{ id: 'c-1', status: 'pending' }]);
      }
      throw new Error('network fail');
    };

    const queue = useImportReviewQueue({ listCandidates });

    await queue.loadQueue();
    assert.equal(queue.candidates.value.length, 1);
    assert.equal(queue.candidates.value[0].id, 'c-1');

    await queue.loadQueue();
    assert.equal(queue.candidates.value.length, 1, 'stale candidates preserved');
    assert.equal(queue.candidates.value[0].id, 'c-1', 'stale candidate data preserved');
  });

  test('clears data on first-load error', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    const listCandidates = async () => { throw new Error('first fail'); };
    const queue = useImportReviewQueue({ listCandidates });

    await queue.loadQueue();
    assert.equal(queue.candidates.value.length, 0);
    assert.ok(queue.listError.value);
  });

  test('pollIntervalMs schedules recurring loads while active candidates', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    let callCount = 0;
    const listCandidates = async () => {
      callCount += 1;
      return makeQueuePayload([{ status: 'downloading' }]);
    };

    const queue = useImportReviewQueue({ listCandidates, pollIntervalMs: 30 });

    await queue.loadQueue();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    queue.destroy();
  });

  test('polling stops when no active candidates remain', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    let callCount = 0;
    const listCandidates = async () => {
      callCount += 1;
      if (callCount <= 2) {
        return makeQueuePayload([{ status: 'downloading' }]);
      }
      return makeQueuePayload([{ status: 'completed' }]);
    };

    const queue = useImportReviewQueue({ listCandidates, pollIntervalMs: 40 });

    await queue.loadQueue();

    await new Promise((resolve) => { setTimeout(resolve, 150); });
    const countAfterPoll = callCount;

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, countAfterPoll, 'polling stopped after candidates became inactive');

    queue.destroy();
  });

  test('destroy stops polling', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    let callCount = 0;
    const listCandidates = async () => {
      callCount += 1;
      return makeQueuePayload([{ status: 'pending' }]);
    };

    const queue = useImportReviewQueue({ listCandidates, pollIntervalMs: 30 });

    await queue.loadQueue();
    assert.equal(callCount, 1);

    queue.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useImportReviewQueue } = await import('../../src/client/composables/useImportReviewQueue.js');

    let callCount = 0;
    const listCandidates = async () => {
      callCount += 1;
      return makeQueuePayload([{ status: 'pending' }]);
    };

    const queue = useImportReviewQueue({ listCandidates, pollIntervalMs: 0 });

    await queue.loadQueue();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    queue.destroy();
  });
});

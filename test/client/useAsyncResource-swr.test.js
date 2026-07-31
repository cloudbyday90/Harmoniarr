import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('useAsyncResource SWR', () => {
  test('isRevalidating is false on first load', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    const fetcher = async () => ({ items: [1, 2, 3] });
    const { isLoading, isRevalidating, data, load } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
    });

    assert.equal(isLoading.value, false);
    await load();
    assert.equal(isLoading.value, false);
    assert.equal(isRevalidating.value, false);
    assert.deepEqual(data.value, [1, 2, 3]);
  });

  test('isRevalidating is true during second load', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    const fetcher = async () => ({ items: [1] });
    const { isRevalidating, load } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
    });

    await load();
    assert.equal(isRevalidating.value, false);

    const secondLoad = load();
    assert.equal(isRevalidating.value, true);
    await secondLoad;
    assert.equal(isRevalidating.value, false);
  });

  test('preserves stale data on revalidation failure', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    let callCount = 0;
    const failure = Object.assign(new Error('fail'), {
      code: 'music_queue_release_not_found',
      status: 404,
    });
    const fetcher = async () => {
      callCount += 1;
      if (callCount === 1) return { items: [1, 2] };
      throw failure;
    };

    const { data, error: resourceError, errorMessage, load } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
      fallbackErrorMessage: 'Failed',
    });

    await load();
    assert.deepEqual(data.value, [1, 2]);

    await load();
    assert.deepEqual(data.value, [1, 2], 'stale data preserved');
    assert.equal(errorMessage.value, 'fail');
    assert.equal(resourceError.value, failure);
    assert.equal(resourceError.value.code, 'music_queue_release_not_found');
    assert.equal(resourceError.value.status, 404);
  });

  test('pollWhile returns false when data has no active flag', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    const fetcher = async () => ({ active: false });
    const { data, load } = useAsyncResource({
      fetcher,
      immediate: false,
      pollIntervalMs: 30,
      pollWhile: (d) => d?.active === true,
    });

    await load();
    assert.equal(data.value.active, false);
  });

  test('clears a structured error after a successful retry', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    let shouldFail = true;
    const failure = Object.assign(new Error('release unavailable'), {
      code: 'music_queue_release_not_found',
      status: 404,
    });
    const { data, error: resourceError, errorMessage, load } = useAsyncResource({
      fetcher: async () => {
        if (shouldFail) throw failure;
        return { recovered: true };
      },
      immediate: false,
    });

    await load();
    assert.equal(resourceError.value, failure);
    assert.equal(errorMessage.value, 'release unavailable');

    shouldFail = false;
    await load();
    assert.deepEqual(data.value, { recovered: true });
    assert.equal(resourceError.value, null);
    assert.equal(errorMessage.value, '');
  });

  test('requires a fetcher function', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    assert.throws(() => useAsyncResource(), {
      name: 'TypeError',
      message: /requires a fetcher function/,
    });
  });

  test('reset clears data and error state', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    const fetcher = async () => ({ items: [1, 2] });
    const { data, error: resourceError, errorMessage, isLoading, isRevalidating, lastRefreshedAt, load, reset } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
    });

    await load();
    assert.deepEqual(data.value, [1, 2]);
    assert.ok(lastRefreshedAt.value !== null);

    reset();

    assert.deepEqual(data.value, null, 'data reset to initial');
    assert.equal(resourceError.value, null);
    assert.equal(errorMessage.value, '');
    assert.equal(isLoading.value, false);
    assert.equal(isRevalidating.value, false);
    assert.equal(lastRefreshedAt.value, null);
  });

  test('reset allows next load to be treated as first load', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    const fetcher = async () => ({ items: [1] });
    const { isLoading, isRevalidating, load, reset } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
    });

    await load();
    reset();

    const loadPromise = load();
    assert.equal(isLoading.value, true, 'treated as first load after reset');
    assert.equal(isRevalidating.value, false);
    await loadPromise;
  });

  test('destroy stops polling', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return { items: [callCount] };
    };
    const { load, destroy } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
      pollIntervalMs: 30,
    });

    await load();
    assert.equal(callCount, 1);

    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no polling after destroy');
  });

  test('load returns early after destroy', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return { items: [callCount] };
    };
    const { load, destroy } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
    });

    await load();
    assert.equal(callCount, 1);

    destroy();
    await load();
    assert.equal(callCount, 1, 'no fetch after destroy');
  });

  test('schedulePoll fires after manual load', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return { items: [callCount] };
    };
    const { load, destroy } = useAsyncResource({
      fetcher,
      immediate: false,
      project: (p) => p.items,
      pollIntervalMs: 30,
    });

    await load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling started after manual load');

    destroy();
  });
});

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
    const fetcher = async () => {
      callCount += 1;
      if (callCount === 1) return { items: [1, 2] };
      throw new Error('fail');
    };

    const { data, errorMessage, load } = useAsyncResource({
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

  test('requires a fetcher function', async () => {
    const { useAsyncResource } = await import('../../src/client/composables/useAsyncResource.js');

    assert.throws(() => useAsyncResource(), {
      name: 'TypeError',
      message: /requires a fetcher function/,
    });
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useAdminUserList } from '../../src/client/composables/useAdminUserList.js';

describe('useAdminUserList SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const list = useAdminUserList({
      fetchUsersFn: async () => ({ users: [{ id: 'u-1' }], totalCount: 1 }),
    });

    assert.equal(list.isRevalidating.value, false);
    await list.load();
    assert.equal(list.isRevalidating.value, false);

    list.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const list = useAdminUserList({
      fetchUsersFn: async () => ({ users: [{ id: 'u-1' }], totalCount: 1 }),
    });

    await list.load();
    const p = list.revalidate();
    assert.equal(list.isRevalidating.value, true);
    await p;
    assert.equal(list.isRevalidating.value, false);

    list.destroy();
  });

  test('pollIntervalMs schedules recurring revalidations', async () => {
    let callCount = 0;
    const list = useAdminUserList({
      fetchUsersFn: async () => {
        callCount += 1;
        return { users: [{ id: `u-${callCount}` }], totalCount: callCount };
      },
      pollIntervalMs: 30,
    });

    await list.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional fetches');

    list.destroy();
  });

  test('destroy stops polling', async () => {
    let callCount = 0;
    const list = useAdminUserList({
      fetchUsersFn: async () => {
        callCount += 1;
        return { users: [{ id: 'u-1' }], totalCount: 1 };
      },
      pollIntervalMs: 30,
    });

    await list.load();
    list.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let callCount = 0;
    const list = useAdminUserList({
      fetchUsersFn: async () => {
        callCount += 1;
        return { users: [{ id: 'u-1' }], totalCount: 1 };
      },
      pollIntervalMs: 0,
    });

    await list.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    list.destroy();
  });

  test('reset clears hasLoaded and stops polling', async () => {
    let callCount = 0;
    const list = useAdminUserList({
      fetchUsersFn: async () => {
        callCount += 1;
        return { users: [{ id: 'u-1' }], totalCount: 1 };
      },
      pollIntervalMs: 30,
    });

    await list.load();
    assert.equal(callCount, 1);
    list.reset();

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1, 'no polling after reset cleared hasLoaded');

    list.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const list = useAdminUserList({
      fetchUsersFn: async () => {
        callCount += 1;
        return { users: [{ id: 'u-1' }], totalCount: 1 };
      },
    });

    await list.load();
    assert.equal(callCount, 1);
    list.destroy();

    await list.revalidate();
    assert.equal(callCount, 1);
  });
});

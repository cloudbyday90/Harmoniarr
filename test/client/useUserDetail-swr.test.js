import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useUserDetail } from '../../src/client/composables/useUserDetail.js';

function makeUserDetailPayload(overrides = {}) {
  return {
    requestSummary: { asRequester: {}, asTarget: {}, total: 0 },
    sessions: [{ id: 'rt-1', isRevoked: false, issuedAt: '2026-05-23T10:00:00.000Z' }],
    user: { id: 'u-1', username: 'alice', role: 'admin' },
    ...overrides,
  };
}

describe('useUserDetail SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => makeUserDetailPayload(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.load({ userId: 'u-1' });
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => makeUserDetailPayload(),
    });

    await workflow.load({ userId: 'u-1' });

    const secondLoad = workflow.load({ userId: 'u-1' });
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        if (callCount === 1) return makeUserDetailPayload();
        throw new Error('network fail');
      },
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(workflow.user.value.username, 'alice');

    await workflow.load({ userId: 'u-1' });
    assert.equal(workflow.user.value.username, 'alice', 'stale user preserved');
    assert.equal(workflow.sessions.value.length, 1, 'stale sessions preserved');
    assert.equal(workflow.errorMessage.value, 'network fail');

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        throw new Error('first fail');
      },
    });

    await workflow.load({ userId: 'u-1' });

    assert.equal(workflow.user.value, null);
    assert.equal(workflow.sessions.value.length, 0);
    assert.equal(workflow.errorMessage.value, 'first fail');

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
      pollIntervalMs: 30,
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
      pollIntervalMs: 30,
    });

    await workflow.load({ userId: 'u-1' });
    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
      pollIntervalMs: 0,
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });

  test('reset clears currentUserId and stops polling from re-fetching', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
      pollIntervalMs: 30,
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(callCount, 1);
    workflow.reset();

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1, 'no polling after reset cleared userId');

    workflow.destroy();
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useUserDetail } from '../../src/client/composables/useUserDetail.js';

function makeUserDetailPayload(overrides = {}) {
  return {
    requestSummary: { asRequester: {}, asTarget: {}, total: 0 },
    sessions: [],
    user: { id: 'u-1', username: 'alice', role: 'admin' },
    ...overrides,
  };
}

describe('useUserDetail revalidate', () => {
  test('revalidate forces a re-fetch without checking isLoading', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(callCount, 1);

    await workflow.revalidate();
    assert.equal(callCount, 2);

    workflow.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        if (callCount === 1) return makeUserDetailPayload();
        throw new Error('revalidation failed');
      },
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(workflow.user.value.username, 'alice');

    await workflow.revalidate();
    assert.equal(workflow.user.value.username, 'alice', 'stale user preserved');
    assert.equal(workflow.errorMessage.value, 'revalidation failed');

    workflow.destroy();
  });

  test('revalidate is no-op when no user has been loaded', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
    });

    await workflow.revalidate();
    assert.equal(callCount, 0);

    workflow.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const workflow = useUserDetail({
      fetchUserDetailFn: async () => {
        callCount += 1;
        return makeUserDetailPayload();
      },
    });

    await workflow.load({ userId: 'u-1' });
    workflow.destroy();

    await workflow.revalidate();
    assert.equal(callCount, 1);
  });

  test('revokeUserSession triggers background revalidation', async () => {
    let fetchCount = 0;
    const workflow = useUserDetail({
      adminRevokeUserSessionFn: async () => ({ ok: true }),
      fetchUserDetailFn: async () => {
        fetchCount += 1;
        return makeUserDetailPayload({
          sessions: [{ id: 'rt-1', isRevoked: fetchCount > 1 }],
        });
      },
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(fetchCount, 1);

    await workflow.revokeUserSession('rt-1');

    await new Promise((resolve) => { setTimeout(resolve, 10); });
    assert.ok(fetchCount >= 2, 'revalidation was triggered after revoke');

    workflow.destroy();
  });

  test('revokeAllUserSessions triggers background revalidation', async () => {
    let fetchCount = 0;
    const workflow = useUserDetail({
      adminRevokeAllUserSessionsFn: async () => ({ ok: true, revokedSessionCount: 1 }),
      fetchUserDetailFn: async () => {
        fetchCount += 1;
        return makeUserDetailPayload({
          sessions: [{ id: 'rt-1', isRevoked: fetchCount > 1 }],
        });
      },
    });

    await workflow.load({ userId: 'u-1' });
    assert.equal(fetchCount, 1);

    await workflow.revokeAllUserSessions();

    await new Promise((resolve) => { setTimeout(resolve, 10); });
    assert.ok(fetchCount >= 2, 'revalidation was triggered after revoke all');

    workflow.destroy();
  });
});

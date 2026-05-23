import assert from 'node:assert/strict';
import test from 'node:test';
import { useUserDetail } from '../../src/client/composables/useUserDetail.js';

test('useUserDetail load fetches user detail', async () => {
  const { user, requestSummary, sessions, isLoading, load } = useUserDetail({
    fetchUserDetailFn: async () => ({
      user: { id: 'u-1', username: 'admin', role: 'admin' },
      requestSummary: { total: 5, asRequester: { needsFetch: 3 }, asTarget: { needsReview: 2 } },
      sessions: [{ id: 'rt-1', isRevoked: false }],
    }),
  });

  await load({ userId: 'u-1' });

  assert.equal(user.value.id, 'u-1');
  assert.equal(requestSummary.value.total, 5);
  assert.equal(sessions.value.length, 1);
  assert.equal(isLoading.value, false);
});

test('useUserDetail load sets error on failure', async () => {
  const { errorMessage, load } = useUserDetail({
    fetchUserDetailFn: async () => { throw new Error('Server error'); },
  });

  await load({ userId: 'u-1' });

  assert.equal(errorMessage.value, 'Server error');
});

test('useUserDetail loadActivity fetches and appends events', async () => {
  let callCount = 0;
  const { activityEvents, hasMoreActivity, loadActivity } = useUserDetail({
    fetchUserActivityFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          events: [{ id: 'e-1', eventType: 'login' }, { id: 'e-2', eventType: 'logout' }],
          hasMore: true,
          nextCursor: 'cursor-1',
        };
      }
      return {
        events: [{ id: 'e-3', eventType: 'update' }],
        hasMore: false,
        nextCursor: null,
      };
    },
    pageSize: 2,
  });

  await loadActivity({ userId: 'u-1' });

  assert.equal(activityEvents.value.length, 2);
  assert.equal(hasMoreActivity.value, true);

  await loadActivity({ userId: 'u-1' });

  assert.equal(activityEvents.value.length, 3);
  assert.equal(hasMoreActivity.value, false);
});

test('useUserDetail loadActivity silently ignores errors', async () => {
  const { activityEvents, loadActivity } = useUserDetail({
    fetchUserActivityFn: async () => { throw new Error('fail'); },
  });

  await loadActivity({ userId: 'u-1' });

  assert.equal(activityEvents.value.length, 0);
});

test('useUserDetail reset clears all state', async () => {
  const { user, activityEvents, errorMessage, reset, load } = useUserDetail({
    fetchUserDetailFn: async () => ({
      user: { id: 'u-1' },
      requestSummary: null,
      sessions: [],
    }),
  });

  await load({ userId: 'u-1' });
  assert.ok(user.value);

  reset();

  assert.equal(user.value, null);
  assert.equal(activityEvents.value.length, 0);
  assert.equal(errorMessage.value, '');
});

test('useUserDetail does not load while already loading', async () => {
  let resolveFirst;
  const firstCall = new Promise((resolve) => { resolveFirst = resolve; });
  let callCount = 0;
  const { load, user } = useUserDetail({
    fetchUserDetailFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        await firstCall;
      }
      return { user: { id: 'u-1' }, requestSummary: null, sessions: [] };
    },
  });

  const p1 = load({ userId: 'u-1' });
  const p2 = load({ userId: 'u-1' });

  resolveFirst();
  await p1;
  await p2;

  assert.equal(callCount, 1);
});

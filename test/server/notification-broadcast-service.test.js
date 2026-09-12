import assert from 'node:assert/strict';
import test from 'node:test';
import { broadcastNotification } from '../../src/server/notification/notification-broadcast-service.js';

function options(overrides = {}) {
  return {
    category: 'artistMonitored',
    listAppUsers: async () => [{ id: 'recipient-1' }],
    getUserPreferences: async () => ({ notificationPreferences: { artistMonitored: true } }),
    payload: { title: 'Private artist', body: 'Private notification', url: '/app/activity/releases' },
    sendNotificationToUser: async () => ({ failed: 0, sent: 1 }),
    ...overrides,
  };
}

test('notification broadcast returns only an aggregate failure when recipient listing rejects', async (t) => {
  const sendNotificationToUser = t.mock.fn();
  const getUserPreferences = t.mock.fn();
  const result = await broadcastNotification(options({
    listAppUsers: async () => { throw new Error('password=sentinel https://private.example\nprivate recipient'); },
    getUserPreferences,
    sendNotificationToUser,
  }));
  assert.deepEqual(result, { failed: 1 });
  assert.equal(getUserPreferences.mock.callCount(), 0);
  assert.equal(sendNotificationToUser.mock.callCount(), 0);
});

test('notification broadcast counts rejected and downstream-failed recipients once while preserving other sends', async (t) => {
  const sendNotificationToUser = t.mock.fn(async ({ userId }) => {
    if (userId === 'recipient-1') throw new Error('private transport detail');
    if (userId === 'recipient-2') return { failed: 5, sent: 2, privateDetail: 'must not be returned' };
    if (userId === 'recipient-3') return undefined;
    return { failed: 0, sent: 1 };
  });
  const markDispatched = t.mock.fn(async () => {});
  const result = await broadcastNotification(options({
    listAppUsers: async () => [1, 2, 3, 4].map((number) => ({ id: `recipient-${number}` })),
    sendNotificationToUser,
    dispatchCooldownService: { markDispatched },
  }));
  assert.deepEqual(result, { failed: 2 });
  assert.equal(sendNotificationToUser.mock.callCount(), 4);
  assert.deepEqual(markDispatched.mock.calls.map(({ arguments: [input] }) => input.userId), [
    'recipient-2', 'recipient-3', 'recipient-4',
  ]);
});

test('notification broadcast reports a failed preference read while preserving the existing send fallback', async (t) => {
  const sendNotificationToUser = t.mock.fn(async () => ({ failed: 3, sent: 1 }));
  const markDispatched = t.mock.fn(async () => {});
  const result = await broadcastNotification(options({
    getUserPreferences: async () => { throw new Error('private preferences read failed'); },
    sendNotificationToUser,
    dispatchCooldownService: { markDispatched },
  }));
  assert.deepEqual(result, { failed: 1 }, 'Preference and send failures count once for the same recipient');
  assert.equal(sendNotificationToUser.mock.callCount(), 1);
  assert.equal(markDispatched.mock.callCount(), 1);
});

test('notification broadcast keeps normal preference, explicit suppression and cooldown skips successful', async (t) => {
  const sendNotificationToUser = t.mock.fn();
  const getUserPreferences = t.mock.fn(async ({ userId }) => ({
    notificationPreferences: { artistMonitored: userId !== 'disabled' },
  }));
  const shouldDispatch = t.mock.fn(async () => false);
  const markDispatched = t.mock.fn();
  const result = await broadcastNotification(options({
    listAppUsers: async () => ['disabled', 'suppressed', 'cooldown'].map((id) => ({ id })),
    suppressUserIds: ['suppressed'],
    getUserPreferences,
    sendNotificationToUser,
    dispatchCooldownService: { shouldDispatch, markDispatched },
  }));
  assert.deepEqual(result, { failed: 0 });
  assert.deepEqual(getUserPreferences.mock.calls.map(({ arguments: [input] }) => input.userId), ['disabled', 'cooldown']);
  assert.equal(shouldDispatch.mock.callCount(), 1);
  assert.equal(sendNotificationToUser.mock.callCount(), 0);
  assert.equal(markDispatched.mock.callCount(), 0);
});

test('notification broadcast reports cooldown failures without changing successful recipient execution', async (t) => {
  const sendNotificationToUser = t.mock.fn(async () => ({ failed: 0 }));
  const markDispatched = t.mock.fn(async ({ userId }) => {
    if (userId === 'mark-failed') throw new Error('private cooldown detail');
  });
  const result = await broadcastNotification(options({
    listAppUsers: async () => ['check-failed', 'mark-failed', 'sent'].map((id) => ({ id })),
    sendNotificationToUser,
    dispatchCooldownService: {
      shouldDispatch: async ({ userId }) => {
        if (userId === 'check-failed') throw new Error('private cooldown read');
        return true;
      },
      markDispatched,
    },
  }));
  assert.deepEqual(result, { failed: 2 });
  assert.deepEqual(sendNotificationToUser.mock.calls.map(({ arguments: [input] }) => input.userId), ['mark-failed', 'sent']);
  assert.equal(markDispatched.mock.callCount(), 2);
});

test('notification broadcast reports a degraded preference read even when an existing cooldown suppresses sending', async (t) => {
  const sendNotificationToUser = t.mock.fn();
  const result = await broadcastNotification(options({
    getUserPreferences: async () => { throw new Error('unavailable'); },
    dispatchCooldownService: { shouldDispatch: async () => false },
    sendNotificationToUser,
  }));
  assert.deepEqual(result, { failed: 1 });
  assert.equal(sendNotificationToUser.mock.callCount(), 0);
});

test('notification broadcast returns zero failures for empty recipients and successful void send callbacks', async () => {
  assert.deepEqual(await broadcastNotification(options({ listAppUsers: async () => [] })), { failed: 0 });
  assert.deepEqual(await broadcastNotification(options({ sendNotificationToUser: () => {} })), { failed: 0 });
});

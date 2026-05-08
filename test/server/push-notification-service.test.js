/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushNotificationService } from '../../src/server/push/push-notification-service.js';

const VAPID_KEYS = { publicKey: 'test-pub-key', privateKey: 'test-priv-key' };
const VAPID_CONTACT = 'mailto:test@example.com';

function makeStore(overrides = {}) {
  return {
    upsertSubscription: async (args) => ({ id: 'sub-id', ...args }),
    deleteSubscription: async () => {},
    deleteSubscriptionByEndpoint: async () => {},
    listSubscriptionsForUser: async () => [],
    listAllSubscriptions: async () => [],
    ...overrides,
  };
}

function makeWebPushLib(overrides = {}) {
  return {
    setVapidDetails: () => {},
    sendNotification: async () => {},
    ...overrides,
  };
}

function makeStderr() {
  const lines = [];
  return { write: (msg) => lines.push(msg), lines };
}

// ── construction ─────────────────────────────────────────────────────────────

test('createPushNotificationService: calls setVapidDetails at construction time', (t) => {
  const setVapidDetails = t.mock.fn();
  const webPushLib = makeWebPushLib({ setVapidDetails });

  createPushNotificationService({
    pushSubscriptionStore: makeStore(),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib,
    stderr: makeStderr(),
  });

  assert.equal(setVapidDetails.mock.callCount(), 1);
  const [contact, pub, priv] = setVapidDetails.mock.calls[0].arguments;
  assert.equal(contact, VAPID_CONTACT);
  assert.equal(pub, VAPID_KEYS.publicKey);
  assert.equal(priv, VAPID_KEYS.privateKey);
});

// ── getVapidPublicKey ─────────────────────────────────────────────────────────

test('getVapidPublicKey: returns the configured public key', () => {
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore(),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib(),
    stderr: makeStderr(),
  });

  assert.equal(service.getVapidPublicKey(), VAPID_KEYS.publicKey);
});

// ── subscribe ─────────────────────────────────────────────────────────────────

test('subscribe: delegates to pushSubscriptionStore.upsertSubscription with correct args', async (t) => {
  const upsertSubscription = t.mock.fn(async (args) => ({ id: 'new-id', ...args }));
  const store = makeStore({ upsertSubscription });

  const service = createPushNotificationService({
    pushSubscriptionStore: store,
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib(),
    stderr: makeStderr(),
  });

  const result = await service.subscribe({
    userId: 'user-1',
    endpoint: 'https://push.example.com/endpoint',
    p256dh: 'p256dh-key',
    auth: 'auth-key',
    userAgent: 'TestBrowser/1.0',
  });

  assert.equal(upsertSubscription.mock.callCount(), 1);
  const args = upsertSubscription.mock.calls[0].arguments[0];
  assert.equal(args.userId, 'user-1');
  assert.equal(args.endpoint, 'https://push.example.com/endpoint');
  assert.equal(args.p256dh, 'p256dh-key');
  assert.equal(args.auth, 'auth-key');
  assert.equal(args.userAgent, 'TestBrowser/1.0');
  assert.equal(result.id, 'new-id');
});

test('subscribe: defaults userAgent to null when not provided', async (t) => {
  const upsertSubscription = t.mock.fn(async (args) => ({ id: 'x', ...args }));
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({ upsertSubscription }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib(),
    stderr: makeStderr(),
  });

  await service.subscribe({ userId: 'u', endpoint: 'e', p256dh: 'p', auth: 'a' });

  const args = upsertSubscription.mock.calls[0].arguments[0];
  assert.equal(args.userAgent, null);
});

// ── unsubscribe ───────────────────────────────────────────────────────────────

test('unsubscribe: delegates to pushSubscriptionStore.deleteSubscription', async (t) => {
  const deleteSubscription = t.mock.fn(async () => {});
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({ deleteSubscription }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib(),
    stderr: makeStderr(),
  });

  await service.unsubscribe('user-1', 'https://push.example.com/endpoint');

  assert.equal(deleteSubscription.mock.callCount(), 1);
  const [userId, endpoint] = deleteSubscription.mock.calls[0].arguments;
  assert.equal(userId, 'user-1');
  assert.equal(endpoint, 'https://push.example.com/endpoint');
});

// ── sendNotificationToUser ────────────────────────────────────────────────────

test('sendNotificationToUser: no-ops and returns 0 counts when user has no subscriptions', async () => {
  const store = makeStore({ listSubscriptionsForUser: async () => [] });
  const sendNotification = async () => {};
  const service = createPushNotificationService({
    pushSubscriptionStore: store,
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification }),
    stderr: makeStderr(),
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: { type: 'test' } });

  assert.deepEqual(result, { sent: 0, failed: 0, removed: 0 });
});

test('sendNotificationToUser: sends to all subscriptions for a user', async (t) => {
  const subs = [
    { id: '1', endpoint: 'https://ep1', p256dh: 'p1', auth: 'a1' },
    { id: '2', endpoint: 'https://ep2', p256dh: 'p2', auth: 'a2' },
  ];
  const sendNotification = t.mock.fn(async () => {});
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({ listSubscriptionsForUser: async () => subs }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification }),
    stderr: makeStderr(),
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: { type: 'test' } });

  assert.equal(sendNotification.mock.callCount(), 2);
  assert.deepEqual(result, { sent: 2, failed: 0, removed: 0 });
});

test('sendNotificationToUser: auto-removes subscription on 410 response', async (t) => {
  const sub = { id: '1', endpoint: 'https://ep-expired', p256dh: 'p', auth: 'a' };
  const expiredError = Object.assign(new Error('Gone'), { statusCode: 410 });
  const deleteSubscriptionByEndpoint = t.mock.fn(async () => {});
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({
      listSubscriptionsForUser: async () => [sub],
      deleteSubscriptionByEndpoint,
    }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification: async () => { throw expiredError; } }),
    stderr: makeStderr(),
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: { type: 'test' } });

  assert.deepEqual(result, { sent: 0, failed: 0, removed: 1 });
  // Deletion is fire-and-forget — give it a tick to complete
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(deleteSubscriptionByEndpoint.mock.callCount(), 1);
  assert.equal(deleteSubscriptionByEndpoint.mock.calls[0].arguments[0], 'https://ep-expired');
});

test('sendNotificationToUser: auto-removes subscription on 404 response', async (t) => {
  const sub = { id: '1', endpoint: 'https://ep-notfound', p256dh: 'p', auth: 'a' };
  const notFoundError = Object.assign(new Error('Not Found'), { statusCode: 404 });
  const deleteSubscriptionByEndpoint = t.mock.fn(async () => {});
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({
      listSubscriptionsForUser: async () => [sub],
      deleteSubscriptionByEndpoint,
    }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification: async () => { throw notFoundError; } }),
    stderr: makeStderr(),
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: { type: 'test' } });

  assert.deepEqual(result, { sent: 0, failed: 0, removed: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(deleteSubscriptionByEndpoint.mock.callCount(), 1);
});

test('sendNotificationToUser: logs non-410/404 errors and counts as failed without throwing', async (t) => {
  const sub = { id: '1', endpoint: 'https://ep-error', p256dh: 'p', auth: 'a' };
  const serverError = Object.assign(new Error('Server error'), { statusCode: 500 });
  const stderr = makeStderr();
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({ listSubscriptionsForUser: async () => [sub] }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification: async () => { throw serverError; } }),
    stderr,
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: { type: 'test' } });

  assert.deepEqual(result, { sent: 0, failed: 1, removed: 0 });
  assert.ok(stderr.lines.length > 0, 'should write to stderr');
});

test('sendNotificationToUser: continues delivering to remaining subscriptions after one failure', async (t) => {
  const subs = [
    { id: '1', endpoint: 'https://ep-fail', p256dh: 'p1', auth: 'a1' },
    { id: '2', endpoint: 'https://ep-ok', p256dh: 'p2', auth: 'a2' },
  ];
  const networkError = Object.assign(new Error('Network'), { statusCode: 500 });
  let callCount = 0;
  const sendNotification = async (sub) => {
    callCount++;
    if (sub.endpoint === 'https://ep-fail') {
      throw networkError;
    }
  };
  const service = createPushNotificationService({
    pushSubscriptionStore: makeStore({ listSubscriptionsForUser: async () => subs }),
    vapidKeys: VAPID_KEYS,
    vapidContact: VAPID_CONTACT,
    webPushLib: makeWebPushLib({ sendNotification }),
    stderr: makeStderr(),
  });

  const result = await service.sendNotificationToUser({ userId: 'user-1', payload: {} });

  assert.equal(callCount, 2, 'should attempt all subscriptions');
  assert.deepEqual(result, { sent: 1, failed: 1, removed: 0 });
});

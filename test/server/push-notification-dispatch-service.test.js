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
import { createPushNotificationDispatchService } from '../../src/server/push/push-notification-dispatch-service.js';

function createQueueStore(overrides = {}) {
  return {
    claimPendingNotifications: async () => [],
    enqueueNotification: async () => ({}),
    listPendingNotificationsForCoalesce: async () => [],
    markNotificationFailed: async () => {},
    markNotificationSent: async () => {},
    updatePendingNotificationPayload: async () => [],
    ...overrides,
  };
}

function createSubscriptionStore(overrides = {}) {
  return {
    getSubscriptionById: async () => null,
    listSubscriptionsForUser: async () => [],
    ...overrides,
  };
}

function createPushService(overrides = {}) {
  return {
    sendNotificationToSubscription: async () => ({ status: 'sent' }),
    ...overrides,
  };
}

test('dispatch service enqueues one row per active subscription', async () => {
  const enqueued = [];
  const service = createPushNotificationDispatchService({
    pushNotificationQueueStore: createQueueStore({
      enqueueNotification: async (args) => { enqueued.push(args); return args; },
    }),
    pushSubscriptionStore: createSubscriptionStore({
      listSubscriptionsForUser: async () => [
        { id: 'sub-1' },
        { id: 'sub-2' },
      ],
    }),
    pushNotificationService: createPushService(),
  });

  const result = await service.sendNotificationToUser({
    eventType: 'releaseAdded',
    payload: { title: 'Release added' },
    ttl: 120,
    userId: 'user-1',
  });

  assert.equal(enqueued.length, 2);
  assert.deepEqual(enqueued.map((entry) => entry.subscriptionId), ['sub-1', 'sub-2']);
  assert.deepEqual(result, { failed: 0, queued: 2, removed: 0, sent: 0, updated: 0 });
});

test('dispatch service coalesces pending rows and enqueues only missing subscriptions', async () => {
  const enqueued = [];
  const updated = [];
  const service = createPushNotificationDispatchService({
    coalesceWindowMs: 120000,
    nowFn: () => new Date('2026-05-22T12:00:00.000Z'),
    pushNotificationQueueStore: createQueueStore({
      enqueueNotification: async (args) => { enqueued.push(args); return args; },
      listPendingNotificationsForCoalesce: async () => [
        { id: 'queue-1', subscriptionId: 'sub-1' },
      ],
      updatePendingNotificationPayload: async (args) => { updated.push(args); return []; },
    }),
    pushSubscriptionStore: createSubscriptionStore({
      listSubscriptionsForUser: async () => [{ id: 'sub-1' }, { id: 'sub-2' }],
    }),
    pushNotificationService: createPushService(),
  });

  const result = await service.sendNotificationToUser({
    coalesceKey: 'releaseAdded:radiohead:kid-a',
    eventType: 'releaseAdded',
    payload: { title: 'Release added' },
    ttl: 120,
    userId: 'user-1',
  });

  assert.deepEqual(updated, [{ ids: ['queue-1'], payload: { title: 'Release added' }, ttlSeconds: 120 }]);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].subscriptionId, 'sub-2');
  assert.deepEqual(result, { failed: 0, queued: 1, removed: 0, sent: 0, updated: 1 });
});

test('dispatch service delivers claimed rows and retries transient failures with exponential backoff', async () => {
  const markedSent = [];
  const markedFailed = [];
  const service = createPushNotificationDispatchService({
    nowFn: () => new Date('2026-05-22T12:00:00.000Z'),
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => [{
        attempts: 1,
        id: 'queue-2',
        payload: { title: 'Queued' },
        subscriptionId: 'sub-2',
        ttlSeconds: 120,
        userId: 'user-2',
      }],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); },
      markNotificationSent: async (id) => { markedSent.push(id); },
    }),
    pushNotificationService: createPushService({
      sendNotificationToSubscription: async () => ({ retryAt: null, retryable: true, status: 'failed' }),
    }),
    pushSubscriptionStore: createSubscriptionStore({
      getSubscriptionById: async () => ({ endpoint: 'https://ep-2', id: 'sub-2', userId: 'user-2' }),
    }),
  });

  const result = await service.deliverPendingNotifications({ limit: 20 });

  assert.deepEqual(markedSent, []);
  assert.deepEqual(markedFailed, [{
    id: 'queue-2',
    nextAttemptAt: '2026-05-22T12:01:00.000Z',
  }]);
  assert.deepEqual(result, {
    claimedCount: 1,
    deliveredCount: 0,
    expiredCount: 0,
    failedCount: 0,
    retriedCount: 1,
  });
});

test('dispatch service marks invalid subscriptions expired and caps retries into failed status', async () => {
  const markedFailed = [];
  const service = createPushNotificationDispatchService({
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => [
        {
          attempts: 1,
          id: 'queue-expired',
          payload: { title: 'Expired' },
          subscriptionId: 'sub-expired',
          ttlSeconds: 120,
          userId: 'user-3',
        },
        {
          attempts: 3,
          id: 'queue-failed',
          payload: { title: 'Failed' },
          subscriptionId: 'sub-failed',
          ttlSeconds: 120,
          userId: 'user-4',
        },
      ],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); },
      markNotificationSent: async () => {},
    }),
    pushNotificationService: createPushService({
      sendNotificationToSubscription: async ({ subscription }) => {
        if (subscription.id === 'sub-expired') {
          return { retryAt: null, retryable: false, status: 'expired' };
        }

        return { retryAt: null, retryable: true, status: 'failed' };
      },
    }),
    pushSubscriptionStore: createSubscriptionStore({
      getSubscriptionById: async (subscriptionId) => ({ endpoint: `https://${subscriptionId}`, id: subscriptionId }),
    }),
  });

  const result = await service.deliverPendingNotifications();

  assert.deepEqual(markedFailed, [
    { id: 'queue-expired', expired: true },
    { id: 'queue-failed', failed: true },
  ]);
  assert.deepEqual(result, {
    claimedCount: 2,
    deliveredCount: 0,
    expiredCount: 1,
    failedCount: 1,
    retriedCount: 0,
  });
});

test('dispatch service expires queue rows when the active subscription no longer exists', async () => {
  const markedFailed = [];
  const service = createPushNotificationDispatchService({
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => [{
        attempts: 1,
        id: 'queue-missing-sub',
        payload: { title: 'Missing sub' },
        subscriptionId: 'missing-sub',
        ttlSeconds: 120,
        userId: 'user-5',
      }],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); },
      markNotificationSent: async () => {},
    }),
    pushNotificationService: createPushService(),
    pushSubscriptionStore: createSubscriptionStore({
      getSubscriptionById: async () => null,
    }),
  });

  const result = await service.deliverPendingNotifications();

  assert.deepEqual(markedFailed, [{ id: 'queue-missing-sub', expired: true }]);
  assert.equal(result.expiredCount, 1);
});

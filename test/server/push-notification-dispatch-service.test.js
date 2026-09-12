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
import { createPushNotificationDeliveryPolicyService } from '../../src/server/push/push-notification-delivery-policy-service.js';

function createDeliveryPolicyService(getDeliveryAccount = async ({ userId }) => ({
  id: userId, isDisabled: false, role: 'requester', userPreferences: {},
})) {
  return createPushNotificationDeliveryPolicyService({ pushNotificationDeliveryPolicyStore: { getDeliveryAccount } });
}

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
    pushNotificationDeliveryPolicyService: createDeliveryPolicyService(),
    nowFn: () => new Date('2026-05-22T12:00:00.000Z'),
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => [{
        attempts: 1,
        eventType: 'releaseAdded',
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
    pushNotificationDeliveryPolicyService: createDeliveryPolicyService(),
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => [
        {
          attempts: 1,
          eventType: 'releaseAdded',
          id: 'queue-expired',
          payload: { title: 'Expired' },
          subscriptionId: 'sub-expired',
          ttlSeconds: 120,
          userId: 'user-3',
        },
        {
          attempts: 3,
          eventType: 'releaseAdded',
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
      getSubscriptionById: async (subscriptionId) => ({ endpoint: `https://${subscriptionId}`, id: subscriptionId,
        userId: subscriptionId === 'sub-expired' ? 'user-3' : 'user-4' }),
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

function queuedNotification(overrides = {}) {
  return { attempts: 1, eventType: 'releaseAdded', id: 'queued-1', userId: 'user-1', subscriptionId: 'sub-1',
    payload: { title: 'Private queued message' }, ttlSeconds: 120, ...overrides };
}

function createDeliveryHarness({ claims = [[queuedNotification()]], getDeliveryAccount, policy,
  getSubscriptionById = async (id) => ({ id, userId: 'user-1', endpoint: 'https://push.example.invalid/private' }),
  send = async () => ({ status: 'sent' }), stderr = { write() {} },
} = {}) {
  const marked = [];
  const sent = [];
  const service = createPushNotificationDispatchService({
    nowFn: () => new Date('2026-09-12T12:00:00.000Z'), stderr,
    pushNotificationDeliveryPolicyService: policy ?? createDeliveryPolicyService(getDeliveryAccount),
    pushSubscriptionStore: createSubscriptionStore({ getSubscriptionById }),
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => claims.shift() ?? [],
      markNotificationSent: async (id) => { marked.push({ id, sent: true }); },
      markNotificationFailed: async (id, state) => { marked.push({ id, ...state }); },
    }),
    pushNotificationService: createPushService({ sendNotificationToSubscription: async (input) => {
      sent.push(input); return send(input);
    } }),
  });
  return { ...service, marked, sent };
}

test('delivery rechecks preferences after a transport retry and never sends opted-out retained work', async () => {
  let enabled = true;
  let reads = 0;
  const harness = createDeliveryHarness({ claims: [[queuedNotification()], [queuedNotification({ attempts: 2 })]],
    getDeliveryAccount: async ({ userId }) => { reads++; return { id: userId, role: 'requester', isDisabled: false,
      userPreferences: { notificationPreferences: { releaseAdded: enabled } } }; },
    send: async () => ({ status: 'failed', retryable: true }),
  });
  assert.equal((await harness.deliverPendingNotifications()).retriedCount, 1);
  enabled = false;
  assert.equal((await harness.deliverPendingNotifications()).expiredCount, 1);
  assert.equal(reads, 2);
  assert.equal(harness.sent.length, 1);
  assert.deepEqual(harness.marked, [{ id: 'queued-1', nextAttemptAt: '2026-09-12T12:01:00.000Z' },
    { id: 'queued-1', expired: true }]);
});

test('a valid account decision is not cached across subscriptions within one claimed batch', async () => {
  let enabled = true;
  const harness = createDeliveryHarness({ claims: [[queuedNotification(), queuedNotification({ id: 'queued-2', subscriptionId: 'sub-2' })]],
    getDeliveryAccount: async ({ userId }) => ({ id: userId, role: 'requester', isDisabled: false,
      userPreferences: { notificationPreferences: { releaseAdded: enabled } } }),
    send: async () => { enabled = false; return { status: 'sent' }; },
  });
  assert.deepEqual(await harness.deliverPendingNotifications(), { claimedCount: 2, deliveredCount: 1,
    expiredCount: 1, failedCount: 0, retriedCount: 0 });
  assert.equal(harness.sent.length, 1);
  assert.deepEqual(harness.marked, [{ id: 'queued-1', sent: true }, { id: 'queued-2', expired: true }]);
});

test('an unavailable recipient lookup retries without sending and does not block an eligible sibling or later recovery', async () => {
  let unavailable = true;
  const sibling = queuedNotification({ id: 'queued-2', userId: 'user-2', subscriptionId: 'sub-2' });
  const logs = [];
  const harness = createDeliveryHarness({ claims: [[queuedNotification(), sibling], [queuedNotification({ attempts: 2 })]],
    stderr: { write: (value) => logs.push(value) },
    getSubscriptionById: async (id) => ({ id, userId: id === 'sub-2' ? 'user-2' : 'user-1' }),
    getDeliveryAccount: async ({ userId }) => {
      if (userId === 'user-1' && unavailable) throw new Error('private database password');
      return { id: userId, isDisabled: false, role: 'requester', userPreferences: {} };
    },
  });
  assert.deepEqual(await harness.deliverPendingNotifications(), { claimedCount: 2, deliveredCount: 1,
    expiredCount: 0, failedCount: 0, retriedCount: 1 });
  assert.deepEqual(harness.sent.map((entry) => entry.userId), ['user-2']);
  unavailable = false;
  assert.equal((await harness.deliverPendingNotifications()).deliveredCount, 1);
  assert.deepEqual(harness.sent.map((entry) => entry.userId), ['user-2', 'user-1']);
  assert.deepEqual(logs, []);
});

test('unavailable and malformed preference reads exhaust the existing three-claim budget without network access', async () => {
  for (const getDeliveryAccount of [async () => { throw new Error('private failure'); },
    async ({ userId }) => ({ id: userId, isDisabled: false, role: 'requester', userPreferences: null })]) {
    const harness = createDeliveryHarness({ claims: [1, 2, 3].map((attempts) => [queuedNotification({ attempts })]), getDeliveryAccount });
    assert.equal((await harness.deliverPendingNotifications()).retriedCount, 1);
    assert.equal((await harness.deliverPendingNotifications()).retriedCount, 1);
    assert.equal((await harness.deliverPendingNotifications()).failedCount, 1);
    assert.equal(harness.sent.length, 0);
    assert.deepEqual(harness.marked, [
      { id: 'queued-1', nextAttemptAt: '2026-09-12T12:01:00.000Z' },
      { id: 'queued-1', nextAttemptAt: '2026-09-12T12:02:00.000Z' },
      { id: 'queued-1', failed: true },
    ]);
  }
});

test('disabled, missing, demoted, opted-out and unknown-category recipients are permanently suppressed', async () => {
  const active = { id: 'user-1', isDisabled: false, role: 'requester', userPreferences: {} };
  for (const [eventType, account] of [['releaseAdded', null], ['releaseAdded', { ...active, isDisabled: true }],
    ['trustOverride', active], ['releaseAdded', { ...active, userPreferences: { notificationPreferences: { releaseAdded: false } } }],
    ['generic', active], ['unknown', active], [undefined, active]]) {
    const harness = createDeliveryHarness({ claims: [[queuedNotification({ eventType })]], getDeliveryAccount: async () => account });
    assert.equal((await harness.deliverPendingNotifications()).expiredCount, 1);
    assert.deepEqual(harness.marked, [{ id: 'queued-1', expired: true }]);
    assert.equal(harness.sent.length, 0);
  }
});

test('a reassigned subscription cannot receive its previous owner queued payload or borrow the new owner preferences', async () => {
  const harness = createDeliveryHarness({
    getSubscriptionById: async (id) => ({ id, userId: 'another-user' }),
    getDeliveryAccount: async () => { assert.fail('ownership failure must precede account lookup'); },
  });
  assert.equal((await harness.deliverPendingNotifications()).expiredCount, 1);
  assert.equal(harness.sent.length, 0);
  assert.deepEqual(harness.marked, [{ id: 'queued-1', expired: true }]);
});

test('an unavailable or malformed injected policy cannot bypass delivery checks', async () => {
  for (const getDeliveryDecision of [async () => { throw new Error('private evaluator error'); },
    async () => undefined, async () => ({ allowed: true }), async () => ({ allowed: true, retryable: true })]) {
    const harness = createDeliveryHarness({ policy: { getDeliveryDecision } });
    assert.equal((await harness.deliverPendingNotifications()).retriedCount, 1);
    assert.equal(harness.sent.length, 0);
  }
});

test('the direct dispatcher default rejects generic queued work without an application-supplied policy', async () => {
  let sent = 0;
  const marked = [];
  const service = createPushNotificationDispatchService({
    pushSubscriptionStore: createSubscriptionStore({ getSubscriptionById: async () => ({ id: 'sub-1', userId: 'user-1' }) }),
    pushNotificationQueueStore: createQueueStore({ claimPendingNotifications: async () => [queuedNotification({ eventType: 'generic' })],
      markNotificationFailed: async (id, state) => marked.push({ id, ...state }) }),
    pushNotificationService: createPushService({ sendNotificationToSubscription: async () => { sent++; return { status: 'sent' }; } }),
  });
  assert.equal((await service.deliverPendingNotifications()).expiredCount, 1);
  assert.equal(sent, 0);
  assert.deepEqual(marked, [{ id: 'queued-1', expired: true }]);
});

test('throwing or rejected diagnostic sinks cannot abort sibling delivery or expose raw queue errors', async () => {
  for (const asyncSink of [false, true]) {
    const logs = [];
    const harness = createDeliveryHarness({
      claims: [[queuedNotification(), queuedNotification({ id: 'queued-2', subscriptionId: 'sub-2' })]],
      getSubscriptionById: async (id) => { if (id === 'sub-1') throw new Error('private endpoint and password');
        return { id, userId: 'user-1' }; },
      stderr: { write: (value) => { logs.push(value); if (asyncSink) return Promise.reject(new Error('logger failed'));
        throw new Error('logger failed'); } },
    });
    const result = await harness.deliverPendingNotifications();
    assert.equal(result.failedCount, 1);
    assert.equal(result.deliveredCount, 1);
    assert.deepEqual(logs, ['[harmoniarr-push] Notification queue worker could not complete a queued delivery.\n']);
  }
});

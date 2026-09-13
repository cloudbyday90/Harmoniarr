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

const CLAIM_TOKEN = '01234567-89ab-4cde-8fab-0123456789ab';

function createDeliveryPolicyService(getDeliveryAccount = async ({ userId }) => ({
  id: userId, isDisabled: false, role: 'requester', userPreferences: {},
})) {
  return createPushNotificationDeliveryPolicyService({ pushNotificationDeliveryPolicyStore: { getDeliveryAccount } });
}

function createQueueStore(overrides = {}) {
  const claimBatch = overrides.claimPendingNotifications ?? (async () => []);
  let pending = [];
  let batchLoaded = false;
  return {
    enqueueNotification: async () => ({}),
    getNotificationClaimRemainingMs: async () => 60_000,
    listPendingNotificationsForCoalesce: async () => [],
    markNotificationFailed: async () => true,
    markNotificationSent: async () => true,
    updatePendingNotificationPayload: async () => [],
    ...overrides,
    // Existing scenarios describe one logical tick per array. Expose one row per database claim.
    claimPendingNotifications: async (input) => {
      assert.equal(input.limit, 1);
      if (!batchLoaded) { pending = [...await claimBatch(input)]; batchLoaded = true; }
      if (pending.length) return [pending.shift()];
      batchLoaded = false;
      return [];
    },
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
      updatePendingNotificationPayload: async (args) => { updated.push(args); return [{ id: 'queue-1', subscriptionId: 'sub-1' }]; },
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
        claimToken: CLAIM_TOKEN,
        eventType: 'releaseAdded',
        id: 'queue-2',
        payload: { title: 'Queued' },
        subscriptionId: 'sub-2',
        ttlSeconds: 120,
        userId: 'user-2',
      }],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); return true; },
      markNotificationSent: async (id) => { markedSent.push(id); return true; },
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
    claimToken: CLAIM_TOKEN,
    nextAttemptAt: '2026-05-22T12:01:00.000Z',
  }]);
  assert.deepEqual(result, {
    claimedCount: 1,
    claimLostCount: 0,
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
          claimToken: CLAIM_TOKEN,
          eventType: 'releaseAdded',
          id: 'queue-expired',
          payload: { title: 'Expired' },
          subscriptionId: 'sub-expired',
          ttlSeconds: 120,
          userId: 'user-3',
        },
        {
          attempts: 3,
          claimToken: CLAIM_TOKEN,
          eventType: 'releaseAdded',
          id: 'queue-failed',
          payload: { title: 'Failed' },
          subscriptionId: 'sub-failed',
          ttlSeconds: 120,
          userId: 'user-4',
        },
      ],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); return true; },
      markNotificationSent: async () => true,
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
    { id: 'queue-expired', claimToken: CLAIM_TOKEN, expired: true },
    { id: 'queue-failed', claimToken: CLAIM_TOKEN, failed: true },
  ]);
  assert.deepEqual(result, {
    claimedCount: 2,
    claimLostCount: 0,
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
        claimToken: CLAIM_TOKEN,
        id: 'queue-missing-sub',
        payload: { title: 'Missing sub' },
        subscriptionId: 'missing-sub',
        ttlSeconds: 120,
        userId: 'user-5',
      }],
      markNotificationFailed: async (id, args) => { markedFailed.push({ id, ...args }); return true; },
      markNotificationSent: async () => true,
    }),
    pushNotificationService: createPushService(),
    pushSubscriptionStore: createSubscriptionStore({
      getSubscriptionById: async () => null,
    }),
  });

  const result = await service.deliverPendingNotifications();

  assert.deepEqual(markedFailed, [{ id: 'queue-missing-sub', claimToken: CLAIM_TOKEN, expired: true }]);
  assert.equal(result.expiredCount, 1);
});

function queuedNotification(overrides = {}) {
  return { attempts: 1, claimToken: CLAIM_TOKEN, eventType: 'releaseAdded', id: 'queued-1', userId: 'user-1', subscriptionId: 'sub-1',
    payload: { title: 'Private queued message' }, ttlSeconds: 120, ...overrides };
}

function createDeliveryHarness({ claims = [[queuedNotification()]], getDeliveryAccount, policy,
  getSubscriptionById = async (id) => ({ id, userId: 'user-1', endpoint: 'https://push.example.invalid/private' }),
  send = async () => ({ status: 'sent' }), stderr = { write() {} }, queueOverrides = {}, monotonicNowFn = () => 0,
} = {}) {
  const marked = [];
  const sent = [];
  const completionCalls = [];
  const service = createPushNotificationDispatchService({
    nowFn: () => new Date('2026-09-12T12:00:00.000Z'), stderr, monotonicNowFn,
    pushNotificationDeliveryPolicyService: policy ?? createDeliveryPolicyService(getDeliveryAccount),
    pushSubscriptionStore: createSubscriptionStore({ getSubscriptionById }),
    pushNotificationQueueStore: createQueueStore({
      claimPendingNotifications: async () => claims.shift() ?? [],
      markNotificationSent: async (id, state) => {
        completionCalls.push({ id, ...state, sent: true }); marked.push({ id, sent: true }); return true;
      },
      markNotificationFailed: async (id, { claimToken, ...state }) => {
        completionCalls.push({ id, claimToken, ...state }); marked.push({ id, ...state }); return true;
      },
      ...queueOverrides,
    }),
    pushNotificationService: createPushService({ sendNotificationToSubscription: async (input) => {
      sent.push(input); return send(input);
    } }),
  });
  return { ...service, marked, sent, completionCalls };
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
  assert.deepEqual(await harness.deliverPendingNotifications(), { claimedCount: 2, claimLostCount: 0, deliveredCount: 1,
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
  assert.deepEqual(await harness.deliverPendingNotifications(), { claimedCount: 2, claimLostCount: 0, deliveredCount: 1,
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
      markNotificationFailed: async (id, { claimToken, ...state }) => {
        assert.equal(claimToken, CLAIM_TOKEN); marked.push({ id, ...state }); return true;
      } }),
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

function deliverySummary(overrides = {}) {
  return { claimedCount: 1, claimLostCount: 0, deliveredCount: 0, expiredCount: 0, failedCount: 0, retriedCount: 0, ...overrides };
}

test('empty delivery summaries include claim loss without inventing claims', async () => {
  for (const rows of [[], null, undefined]) {
    const harness = createDeliveryHarness({ claims: [rows] });
    assert.deepEqual(await harness.deliverPendingNotifications(), deliverySummary({ claimedCount: 0 }));
  }
});

test('missing or malformed tokens cannot read recipient state, send, or attempt an unfenced completion', async () => {
  const rows = [undefined, null, '', 'not-a-token', {}, 1].map((claimToken) => queuedNotification({ claimToken }));
  const harness = createDeliveryHarness({ claims: [rows],
    getSubscriptionById: async () => { assert.fail('token validation must precede preparation'); },
  });
  assert.deepEqual(await harness.deliverPendingNotifications(), deliverySummary({ claimedCount: 6, claimLostCount: 6 }));
  assert.deepEqual(harness.sent, []);
  assert.deepEqual(harness.completionCalls, []);
});

test('final preflight observes ownership lost during a slow policy read and leaves eligible siblings independent', async () => {
  let resolveReadStarted;
  let releaseRead;
  const readStarted = new Promise((resolve) => { resolveReadStarted = resolve; });
  const blockedRead = new Promise((resolve) => { releaseRead = resolve; });
  let firstClaimActive = true;
  const calls = [];
  const harness = createDeliveryHarness({
    claims: [[queuedNotification(), queuedNotification({ id: 'queued-2', userId: 'user-2', subscriptionId: 'sub-2' })]],
    getSubscriptionById: async (id) => { calls.push(`subscription:${id}`); return { id, userId: id === 'sub-1' ? 'user-1' : 'user-2' }; },
    policy: { getDeliveryDecision: async ({ userId }) => {
      calls.push(`policy:${userId}`);
      if (userId === 'user-1') { resolveReadStarted(); await blockedRead; }
      return { allowed: true, retryable: false };
    } },
    queueOverrides: { getNotificationClaimRemainingMs: async (id, { claimToken }) => {
      calls.push(`preflight:${id}`); assert.equal(claimToken, CLAIM_TOKEN);
      return id === 'queued-1' && !firstClaimActive ? null : 60_000;
    } },
  });
  const delivery = harness.deliverPendingNotifications();
  await readStarted;
  firstClaimActive = false;
  releaseRead();
  assert.deepEqual(await delivery, deliverySummary({ claimedCount: 2, claimLostCount: 1, deliveredCount: 1 }));
  assert.deepEqual(calls, ['subscription:sub-1', 'policy:user-1', 'preflight:queued-1',
    'subscription:sub-2', 'policy:user-2', 'preflight:queued-2']);
  assert.deepEqual(harness.sent.map((entry) => entry.userId), ['user-2']);
  assert.deepEqual(harness.completionCalls, [{ id: 'queued-2', claimToken: CLAIM_TOKEN, sent: true }]);
});

test('every transport outcome counts only a strict true completion and passes the exact claim token', async () => {
  for (const [transportResult, counter, expectedState] of [
    [{ status: 'sent' }, 'deliveredCount', { sent: true }],
    [{ status: 'expired' }, 'expiredCount', { expired: true }],
    [{ status: 'failed', retryable: false }, 'failedCount', { failed: true }],
    [{ status: 'failed', retryable: true }, 'retriedCount', { nextAttemptAt: '2026-09-12T12:01:00.000Z' }],
  ]) {
    for (const persisted of [true, false, undefined, 1]) {
      const writes = [];
      const token = 'deadbeef-89ab-4cde-8fab-0123456789ab';
      const harness = createDeliveryHarness({ claims: [[queuedNotification({ claimToken: token })]],
        send: async () => transportResult,
        queueOverrides: {
          getNotificationClaimRemainingMs: async (id, options) => {
            assert.equal(id, 'queued-1'); assert.deepEqual(options, { claimToken: token }); return 60_000;
          },
          markNotificationSent: async (id, options) => { writes.push({ id, ...options, sent: true }); return persisted; },
          markNotificationFailed: async (id, options) => { writes.push({ id, ...options }); return persisted; },
        },
      });
      const result = await harness.deliverPendingNotifications();
      assert.deepEqual(result, deliverySummary(persisted === true ? { [counter]: 1 } : { claimLostCount: 1 }));
      assert.equal(harness.sent.length, 1);
      assert.deepEqual(writes, [{ id: 'queued-1', claimToken: token, ...expectedState }]);
    }
  }
});

test('suppression and unavailable-policy retries also lose cleanly when conditional completion loses ownership', async () => {
  for (const decision of [{ allowed: false, retryable: false }, { allowed: false, retryable: true }]) {
    const writes = [];
    const harness = createDeliveryHarness({ policy: { getDeliveryDecision: async () => decision },
      queueOverrides: {
        getNotificationClaimRemainingMs: async () => { assert.fail('no transport preflight is needed for a suppressed send'); },
        markNotificationFailed: async (id, options) => { writes.push({ id, ...options }); return false; },
      },
    });
    assert.deepEqual(await harness.deliverPendingNotifications(), deliverySummary({ claimLostCount: 1 }));
    assert.equal(harness.sent.length, 0);
    assert.deepEqual(writes, [{ id: 'queued-1', claimToken: CLAIM_TOKEN,
      ...(decision.retryable ? { nextAttemptAt: '2026-09-12T12:01:00.000Z' } : { expired: true }) }]);
  }
});

test('an ambiguous sent completion failure never issues a second failure update or returns false success', async () => {
  let sentWrites = 0;
  const harness = createDeliveryHarness({ queueOverrides: {
    markNotificationSent: async () => { sentWrites++; throw new Error('private database connection state'); },
    markNotificationFailed: async () => { assert.fail('a failed acknowledgement cannot justify rewriting sent state'); },
  } });
  await assert.rejects(harness.deliverPendingNotifications(), (error) => {
    assert.equal(error.message, 'Notification queue completion could not be persisted');
    assert.equal(error.cause, undefined); return true;
  });
  assert.equal(harness.sent.length, 1);
  assert.equal(sentWrites, 1);
});

test('preflight database outages stop before network and do not manufacture lost-claim or failed-completion outcomes', async () => {
  const harness = createDeliveryHarness({ queueOverrides: {
    getNotificationClaimRemainingMs: async () => { throw new Error('private database connection state'); },
    markNotificationFailed: async () => { assert.fail('a claim read outage cannot authorize an unrelated status write'); },
  } });
  await assert.rejects(harness.deliverPendingNotifications(), (error) => {
    assert.equal(error.message, 'Notification queue claim could not be verified');
    assert.equal(error.cause, undefined); return true;
  });
  assert.equal(harness.sent.length, 0);
  assert.deepEqual(harness.completionCalls, []);
});

test('failed-state persistence errors are attempted once and do not fabricate failed delivery accounting', async () => {
  let writes = 0;
  const harness = createDeliveryHarness({ send: async () => ({ status: 'failed' }), queueOverrides: {
    markNotificationFailed: async () => { writes++; throw new Error('private database failure'); },
  } });
  await assert.rejects(harness.deliverPendingNotifications(), /Notification queue completion could not be persisted/);
  assert.equal(writes, 1);
  assert.equal(harness.sent.length, 1);
});

test('coalescing uses returned updates and preserves a new payload when every observed row loses its claim race', async () => {
  const enqueued = [];
  const service = createPushNotificationDispatchService({ pushNotificationService: createPushService(),
    pushSubscriptionStore: createSubscriptionStore({ listSubscriptionsForUser: async () => [{ id: 'sub-1' }, { id: 'sub-2' }] }),
    pushNotificationQueueStore: createQueueStore({
      listPendingNotificationsForCoalesce: async () => [{ id: 'old-1', subscriptionId: 'sub-1' }, { id: 'old-2', subscriptionId: 'sub-2' }],
      updatePendingNotificationPayload: async () => [],
      enqueueNotification: async (input) => { enqueued.push(input); return {}; },
    }),
  });
  assert.deepEqual(await service.sendNotificationToUser({ userId: 'user-1', eventType: 'releaseAdded',
    coalesceKey: 'same-release', payload: { title: 'Newer message' }, ttl: 90 }),
  { failed: 0, queued: 2, removed: 0, sent: 0, updated: 0 });
  assert.deepEqual(enqueued.map((row) => row.subscriptionId), ['sub-1', 'sub-2']);
  assert.ok(enqueued.every((row) => row.payload.title === 'Newer message' && row.ttlSeconds === 90 && row.userId === 'user-1'));
});

test('partially successful coalescing counts actual rows and enqueues only once per subscription with any lost candidate', async () => {
  const enqueued = [];
  const service = createPushNotificationDispatchService({ pushNotificationService: createPushService(),
    pushSubscriptionStore: createSubscriptionStore({ listSubscriptionsForUser: async () => [{ id: 'sub-1' }, { id: 'sub-2' }, { id: 'sub-3' }] }),
    pushNotificationQueueStore: createQueueStore({
      listPendingNotificationsForCoalesce: async () => [
        { id: 'old-1a', subscriptionId: 'sub-1' }, { id: 'old-1b', subscriptionId: 'sub-1' },
        { id: 'old-1c', subscriptionId: 'sub-1' }, { id: 'old-2', subscriptionId: 'sub-2' },
      ],
      updatePendingNotificationPayload: async ({ ids }) => {
        assert.deepEqual(ids, ['old-1a', 'old-1b', 'old-1c', 'old-2']);
        return [{ id: 'old-1a', subscriptionId: 'sub-1' }, { id: 'old-2', subscriptionId: 'sub-2' }];
      },
      enqueueNotification: async (input) => { enqueued.push(input); return {}; },
    }),
  });
  assert.deepEqual(await service.sendNotificationToUser({ userId: 'user-1', eventType: 'releaseAdded',
    coalesceKey: 'same-release', payload: { title: 'Newest message' } }),
  { failed: 0, queued: 2, removed: 0, sent: 0, updated: 2 });
  assert.deepEqual(enqueued.map((row) => row.subscriptionId).sort(), ['sub-1', 'sub-3']);
});


test('insufficient remaining lease budget defers without network and uses bounded existing retries', async () => {
  for (const attempts of [1, 3]) {
    const harness = createDeliveryHarness({ claims: [[queuedNotification({ attempts })]],
      queueOverrides: { getNotificationClaimRemainingMs: async () => 19_999 } });
    const result = await harness.deliverPendingNotifications();
    assert.equal(attempts === 1 ? result.retriedCount : result.failedCount, 1);
    assert.equal(harness.sent.length, 0);
    assert.equal(harness.completionCalls[0].claimToken, CLAIM_TOKEN);
  }
  const enough = createDeliveryHarness({ queueOverrides: { getNotificationClaimRemainingMs: async () => 20_000 } });
  assert.equal((await enough.deliverPendingNotifications()).deliveredCount, 1);
  assert.equal(enough.sent[0].timeoutMs, 15_000);
});

test('preflight latency is deducted using monotonic elapsed time before transport', async () => {
  let clock = 0;
  const harness = createDeliveryHarness({ monotonicNowFn: () => clock,
    queueOverrides: { getNotificationClaimRemainingMs: async () => { clock = 11_000; return 30_000; } } });
  assert.equal((await harness.deliverPendingNotifications()).retriedCount, 1);
  assert.equal(harness.sent.length, 0);
});

test('delivery claims one row only after the previous attempt completes and stops at tick limit', async () => {
  let finish;
  let started;
  const waiting = new Promise((resolve) => { finish = resolve; });
  const entered = new Promise((resolve) => { started = resolve; });
  let claims = 0;
  const service = createPushNotificationDispatchService({
    pushNotificationQueueStore: { ...createQueueStore(), claimPendingNotifications: async ({ limit }) => {
      assert.equal(limit, 1); claims++; return [queuedNotification({ id: `queued-${claims}` })];
    } },
    pushSubscriptionStore: createSubscriptionStore({ getSubscriptionById: async (id) => ({ id, userId: 'user-1' }) }),
    pushNotificationDeliveryPolicyService: createDeliveryPolicyService(),
    pushNotificationService: createPushService({ sendNotificationToSubscription: async () => {
      if (claims === 1) { started(); await waiting; } return { status: 'sent' };
    } }),
  });
  const delivery = service.deliverPendingNotifications({ limit: 2 });
  await entered;
  assert.equal(claims, 1, 'Later work must remain unclaimed while transport is pending');
  finish();
  assert.equal((await delivery).deliveredCount, 2);
  assert.equal(claims, 2);
  for (const limit of [0, -1, 1.2, 51, Infinity]) {
    await assert.rejects(service.deliverPendingNotifications({ limit }), /limit must be an integer/);
  }
  assert.equal(claims, 2);
});

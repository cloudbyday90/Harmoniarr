/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createPushModule } from '../../src/server/push/push-module.js';
import { createStartupServiceSupervisor } from '../../src/server/startup-service-supervisor.js';

function dependencies() {
  return { pushNotificationService: { getVapidPublicKey() {}, subscribe() {}, unsubscribe() {} },
    pushNotificationDispatchService: { deliverPendingNotifications: async () => ({}) },
    pushNotificationDeliveryHeartbeat: { start() {}, stop() {} },
    pushSubscriptionStore: {}, pushNotificationQueueStore: {},
  };
}

test('push module wires both bounded cleanup stores to one heartbeat and preserves route dependencies', async () => {
  const calls = [];
  const input = dependencies();
  const pushNotificationRetentionStore = { deleteTerminalNotificationHistory: async (options) => { calls.push(options); return { deletedCount: 4 }; } };
  const pushSubscriptionPruningStore = { pruneInvalidatedSubscriptions: async (options) => {
    calls.push({ phase: 'subscriptions', ...options }); return { deletedCount: 2 };
  } };
  const module = createPushModule({ ...input, pushNotificationRetentionStore, pushSubscriptionPruningStore });
  assert.equal(module.pushNotificationRetentionStore, pushNotificationRetentionStore);
  assert.equal(module.pushNotificationQueueStore, input.pushNotificationQueueStore);
  assert.equal(module.pushSubscriptionPruningStore, pushSubscriptionPruningStore);
  assert.deepEqual(await module.pushNotificationHistoryCleanupHeartbeat.tick(), {
    deletedCount: 4, batchesCompleted: 1, batchLimitReached: false, skipped: false,
    subscriptionPruning: { deletedCount: 2, batchesCompleted: 1, batchLimitReached: false, skipped: false },
  });
  assert.deepEqual(calls, [{ limit: 500 }, { phase: 'subscriptions', limit: 500 }]);
  assert.deepEqual(module.routeDependencies, input.pushNotificationService);
  assert.equal(module.pushNotificationDeliveryHeartbeat, input.pushNotificationDeliveryHeartbeat);
});

test('push module preserves an explicitly supplied history heartbeat without starting cleanup at construction', () => {
  const heartbeat = { start() {}, stop() {}, tick() {} };
  const module = createPushModule({ ...dependencies(), pushNotificationHistoryCleanupHeartbeat: heartbeat,
    pushNotificationRetentionStore: { deleteTerminalNotificationHistory: () => assert.fail('constructing the module must not delete history') },
    pushSubscriptionPruningStore: { pruneInvalidatedSubscriptions: () => assert.fail('constructing the module must not prune subscriptions') } });
  assert.equal(module.pushNotificationHistoryCleanupHeartbeat, heartbeat);
});

test('the existing startup lifecycle starts and stops both cleanup phases through one registered service', async (t) => {
  const calls = [];
  const module = createPushModule({ ...dependencies(),
    pushNotificationRetentionStore: { deleteTerminalNotificationHistory: async () => { calls.push('history'); return { deletedCount: 0 }; } },
    pushSubscriptionPruningStore: { pruneInvalidatedSubscriptions: async () => { calls.push('subscriptions'); return { deletedCount: 0 }; } },
  });
  const supervisor = createStartupServiceSupervisor({ processEmitter: new EventEmitter() });
  supervisor.registerService(module.pushNotificationHistoryCleanupHeartbeat);
  t.after(() => supervisor.stopAll());
  assert.deepEqual(calls, [], 'module construction does not access the database');
  supervisor.startAll();
  await nextTurn();
  assert.deepEqual(calls, ['history', 'subscriptions']);
  await supervisor.stopAll();
  const skipped = { deletedCount: 0, batchesCompleted: 0, batchLimitReached: false, skipped: true, reason: 'stopped' };
  assert.deepEqual(await module.pushNotificationHistoryCleanupHeartbeat.tick(), { ...skipped, subscriptionPruning: skipped });
  assert.deepEqual(calls, ['history', 'subscriptions']);
});

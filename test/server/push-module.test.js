/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushModule } from '../../src/server/push/push-module.js';

function dependencies() {
  return { pushNotificationService: { getVapidPublicKey() {}, subscribe() {}, unsubscribe() {} },
    pushNotificationDispatchService: { deliverPendingNotifications: async () => ({}) },
    pushNotificationDeliveryHeartbeat: { start() {}, stop() {} },
    pushSubscriptionStore: {}, pushNotificationQueueStore: {},
  };
}

test('push module wires bounded history cleanup to the dedicated retention store and preserves route dependencies', async () => {
  const calls = [];
  const input = dependencies();
  const pushNotificationRetentionStore = { deleteTerminalNotificationHistory: async (options) => { calls.push(options); return { deletedCount: 4 }; } };
  const module = createPushModule({ ...input, pushNotificationRetentionStore });
  assert.equal(module.pushNotificationRetentionStore, pushNotificationRetentionStore);
  assert.equal(module.pushNotificationQueueStore, input.pushNotificationQueueStore);
  assert.deepEqual(await module.pushNotificationHistoryCleanupHeartbeat.tick(), { deletedCount: 4, batchesCompleted: 1, batchLimitReached: false, skipped: false });
  assert.deepEqual(calls, [{ limit: 500 }]);
  assert.deepEqual(module.routeDependencies, input.pushNotificationService);
  assert.equal(module.pushNotificationDeliveryHeartbeat, input.pushNotificationDeliveryHeartbeat);
});

test('push module preserves an explicitly supplied history heartbeat without starting cleanup at construction', () => {
  const heartbeat = { start() {}, stop() {}, tick() {} };
  const module = createPushModule({ ...dependencies(), pushNotificationHistoryCleanupHeartbeat: heartbeat,
    pushNotificationRetentionStore: { deleteTerminalNotificationHistory: () => assert.fail('constructing the module must not delete history') } });
  assert.equal(module.pushNotificationHistoryCleanupHeartbeat, heartbeat);
});

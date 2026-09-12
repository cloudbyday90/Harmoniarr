/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushModule } from '../../src/server/push/push-module.js';
import { createPushNotificationDeliveryPolicyStore } from '../../src/server/push/push-notification-delivery-policy-store.js';
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';
import { createPushSubscriptionStore } from '../../src/server/push/push-subscription-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('queued delivery rechecks persisted policy and subscription ownership on every attempt', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const { rows: users } = await pool.query(`INSERT INTO app_users (username, password_hash, role)
      VALUES ('queue-owner', 'test-only', 'admin'), ('queue-other', 'test-only', 'requester') RETURNING id, username`);
    const userId = users.find((row) => row.username === 'queue-owner').id;
    const otherId = users.find((row) => row.username === 'queue-other').id;
    const subscriptions = createPushSubscriptionStore({ getPoolFn });
    const endpoint = 'https://push.example.test/queued-policy';
    const subscription = await subscriptions.upsertSubscription({ userId, endpoint, p256dh: 'test-key', auth: 'test-auth' });
    const queue = createPushNotificationQueueStore({ getPoolFn });
    let unavailable = false;
    const policyStore = createPushNotificationDeliveryPolicyStore({ getPoolFn: () => ({ query: async (...args) => {
      if (unavailable) throw new Error('private database detail');
      return pool.query(...args);
    } }) });
    const sent = [];
    let transportRetry = false;
    const module = createPushModule({
      pushNotificationDeliveryPolicyStore: policyStore,
      pushNotificationQueueStore: queue,
      pushSubscriptionStore: subscriptions,
      pushNotificationService: { sendNotificationToSubscription: async (input) => {
        sent.push(input);
        return transportRetry ? { status: 'failed', retryable: true } : { status: 'sent' };
      } },
    });
    const deliver = () => module.pushNotificationDispatchService.deliverPendingNotifications();
    const enqueue = (eventType = 'requestFulfilled') => queue.enqueueNotification({ userId,
      subscriptionId: subscription.id, eventType, payload: { title: 'Music ready' }, ttlSeconds: 120 });
    const state = async (id) => (await pool.query('SELECT status, attempts, next_attempt_at > NOW() AS deferred FROM notification_queue WHERE id = $1', [id])).rows[0];
    const ready = (id) => pool.query('UPDATE notification_queue SET next_attempt_at = NOW() WHERE id = $1', [id]);
    const preferences = (value) => pool.query('UPDATE app_users SET user_preferences = $1::jsonb WHERE id = $2', [JSON.stringify(value), userId]);

    const optedOut = await enqueue();
    await preferences({ notificationPreferences: { requestFulfilled: false } });
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal((await state(optedOut.id)).status, 'expired');
    assert.equal(sent.length, 0);

    await preferences({});
    const outage = await enqueue();
    unavailable = true;
    assert.equal((await deliver()).retriedCount, 1);
    assert.deepEqual(await state(outage.id), { status: 'pending', attempts: 1, deferred: true });
    assert.equal(sent.length, 0);
    unavailable = false;
    await ready(outage.id);
    assert.equal((await deliver()).deliveredCount, 1);
    assert.equal((await state(outage.id)).status, 'sent');

    const retry = await enqueue();
    transportRetry = true;
    assert.equal((await deliver()).retriedCount, 1);
    const sendsBeforeOptOut = sent.length;
    await preferences({ notificationPreferences: { requestFulfilled: false } });
    await ready(retry.id);
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal(sent.length, sendsBeforeOptOut, 'A transport retry must honor a subsequent opt-out');
    transportRetry = false;
    await preferences({});

    const exhausted = await enqueue();
    unavailable = true;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await ready(exhausted.id);
      const result = await deliver();
      assert.equal(attempt < 3 ? result.retriedCount : result.failedCount, 1);
      assert.equal((await state(exhausted.id)).attempts, attempt);
    }
    assert.equal((await state(exhausted.id)).status, 'failed');
    unavailable = false;
    assert.equal(sent.length, sendsBeforeOptOut);

    const malformed = await enqueue();
    await preferences({ notificationPreferences: { requestFulfilled: 'false' } });
    assert.equal((await deliver()).retriedCount, 1, 'Raw malformed stored values cannot normalize to permission');
    await preferences({ notificationPreferences: { requestFulfilled: false } });
    await ready(malformed.id);
    assert.equal((await deliver()).expiredCount, 1);
    await preferences({});

    const disabled = await enqueue();
    await pool.query('UPDATE app_users SET is_disabled = TRUE WHERE id = $1', [userId]);
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal((await state(disabled.id)).status, 'expired');
    await pool.query('UPDATE app_users SET is_disabled = FALSE WHERE id = $1', [userId]);
    const demoted = await enqueue('trustOverride');
    await pool.query("UPDATE app_users SET role = 'requester' WHERE id = $1", [userId]);
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal((await state(demoted.id)).status, 'expired');

    const unknown = await enqueue('generic');
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal((await state(unknown.id)).status, 'expired');
    const transferred = await enqueue();
    await subscriptions.upsertSubscription({ userId: otherId, endpoint, p256dh: 'new-key', auth: 'new-auth' });
    assert.equal((await deliver()).expiredCount, 1);
    assert.equal((await state(transferred.id)).status, 'expired');
    assert.equal(sent.length, sendsBeforeOptOut, 'No suppressed row reaches the transport');
  } });
});

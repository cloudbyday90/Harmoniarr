/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';
import { createPushNotificationDispatchService } from '../../src/server/push/push-notification-dispatch-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('just-in-time PostgreSQL claims leave waiting work unclaimed and defer insufficient lease budgets', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const userId = (await pool.query("INSERT INTO app_users (username, password_hash, role) VALUES ('budget-owner', 'test-only', 'requester') RETURNING id")).rows[0].id;
    const subscriptionId = (await pool.query(`INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, 'https://push.example.test/budget', 'test-key', 'test-auth') RETURNING id`, [userId])).rows[0].id;
    const queue = createPushNotificationQueueStore({ getPoolFn });
    const enqueue = () => queue.enqueueNotification({ userId, subscriptionId, eventType: 'releaseAdded', payload: { title: 'Ready' }, ttlSeconds: 120 });
    const first = await enqueue();
    const second = await enqueue();
    let releaseSend;
    let enteredSend;
    const blocked = new Promise((resolve) => { releaseSend = resolve; });
    const entered = new Promise((resolve) => { enteredSend = resolve; });
    let sent = 0;
    let reduceBudget = false;
    const service = createPushNotificationDispatchService({
      pushNotificationQueueStore: queue,
      pushSubscriptionStore: { getSubscriptionById: async () => ({ id: subscriptionId, userId }) },
      pushNotificationDeliveryPolicyService: { getDeliveryDecision: async () => {
        if (reduceBudget) await pool.query("UPDATE notification_queue SET next_attempt_at = clock_timestamp() + INTERVAL '10 seconds' WHERE claim_token IS NOT NULL AND status = 'pending'");
        return { allowed: true, retryable: false };
      } },
      pushNotificationService: { sendNotificationToSubscription: async ({ timeoutMs }) => {
        assert.equal(timeoutMs, 15_000);
        sent++;
        if (sent === 1) { enteredSend(); await blocked; }
        return { status: 'sent' };
      } },
    });
    const delivery = service.deliverPendingNotifications({ limit: 2 });
    await entered;
    try {
      const rows = (await pool.query('SELECT id, attempts, claim_token FROM notification_queue ORDER BY created_at, id')).rows;
      assert.equal(rows.find((row) => row.id === first.id).attempts, 1);
      const waiting = rows.find((row) => row.id === second.id);
      assert.equal(waiting.attempts, 0);
      assert.equal(waiting.claim_token, null);
    } finally { releaseSend(); }
    const result = await delivery;
    assert.equal(result.deliveredCount, 2);
    assert.equal(result.claimedCount, 2);
    assert.equal(sent, 2);
    assert.equal(await queue.getNotificationClaimRemainingMs(first.id, { claimToken: null }), null);

    const deferred = await enqueue();
    reduceBudget = true;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await pool.query('UPDATE notification_queue SET next_attempt_at = clock_timestamp() WHERE id = $1', [deferred.id]);
      const attemptResult = await service.deliverPendingNotifications({ limit: 1 });
      assert.equal(attempt < 3 ? attemptResult.retriedCount : attemptResult.failedCount, 1);
      const row = (await pool.query('SELECT status, attempts, claim_token FROM notification_queue WHERE id = $1', [deferred.id])).rows[0];
      assert.deepEqual(row, { status: attempt < 3 ? 'pending' : 'failed', attempts: attempt, claim_token: null });
    }
    assert.equal(sent, 2, 'No attempt without the required lease reserve may enter transport');
  } });
});

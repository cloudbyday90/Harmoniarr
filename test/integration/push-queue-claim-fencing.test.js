/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';
import { createPushNotificationDispatchService } from '../../src/server/push/push-notification-dispatch-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('PostgreSQL claim fences reject expired and reclaimed workers and preserve coalesced events', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const userId = (await pool.query("INSERT INTO app_users (username, password_hash, role) VALUES ('fence-owner', 'test-only', 'requester') RETURNING id")).rows[0].id;
    const subscriptionId = (await pool.query(`INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, 'https://push.example.test/fence', 'test-key', 'test-auth') RETURNING id`, [userId])).rows[0].id;
    const store = createPushNotificationQueueStore({ getPoolFn });
    const enqueue = (payload = { title: 'Original' }) => store.enqueueNotification({ userId, subscriptionId,
      eventType: 'releaseAdded', coalesceKey: 'release-added', ttlSeconds: 120, payload });
    const rowState = async (id) => (await pool.query('SELECT status, claim_token, attempts, payload, next_attempt_at, sent_at FROM notification_queue WHERE id = $1', [id])).rows[0];
    const row = await enqueue();
    assert.equal(row.claimToken, null);
    const [first] = await store.claimPendingNotifications({ limit: 1 });
    assert.ok(first.claimToken);
    assert.equal(await store.isNotificationClaimActive(row.id, first), true);
    await pool.query("UPDATE notification_queue SET next_attempt_at = clock_timestamp() - INTERVAL '1 second' WHERE id = $1", [row.id]);
    assert.equal(await store.isNotificationClaimActive(row.id, first), false);
    assert.equal(await store.markNotificationSent(row.id, first), false);
    const [second] = await store.claimPendingNotifications({ limit: 1 });
    assert.notEqual(second.claimToken, first.claimToken);
    assert.equal(second.attempts, 2);
    const before = await rowState(row.id);
    for (const result of [{ failed: true }, { expired: true }, { nextAttemptAt: '2099-01-01T00:00:00Z' }]) {
      assert.equal(await store.markNotificationFailed(row.id, { claimToken: first.claimToken, ...result }), false);
    }
    assert.deepEqual(await rowState(row.id), before, 'Stale decisions cannot change the new owner scheduling or payload');
    assert.equal(await store.markNotificationSent(row.id, second), true);
    assert.equal(await store.markNotificationFailed(row.id, { claimToken: second.claimToken, failed: true }), false);
    assert.equal((await rowState(row.id)).status, 'sent');
    assert.equal((await rowState(row.id)).claim_token, null);

    const retryRow = await enqueue();
    const [retryClaim] = await store.claimPendingNotifications({ limit: 1 });
    assert.equal(await store.markNotificationFailed(retryRow.id, { claimToken: retryClaim.claimToken, nextAttemptAt: '2099-01-01T00:00:00Z' }), true);
    assert.equal(await store.isNotificationClaimActive(retryRow.id, retryClaim), false);
    assert.equal(await store.markNotificationSent(retryRow.id, retryClaim), false, 'A consumed retry token cannot later report success');
    assert.equal((await rowState(retryRow.id)).status, 'pending');

    await enqueue();
    await enqueue();
    const [left, right] = await Promise.all([store.claimPendingNotifications({ limit: 1 }), store.claimPendingNotifications({ limit: 1 })]);
    assert.equal(left.length, 1);
    assert.equal(right.length, 1);
    assert.notEqual(left[0].id, right[0].id, 'Competing consumers claim distinct available rows');
    assert.equal(await store.markNotificationFailed(left[0].id, { ...left[0], expired: true }), true);
    assert.equal(await store.markNotificationFailed(right[0].id, { ...right[0], expired: true }), true);

    // Observe a blocked completion, then let its lease expire without changing the locked tuple.
    // The completion must evaluate its deadline after acquiring that lock.
    const lockedRow = await enqueue();
    const [lockedClaim] = await store.claimPendingNotifications({ limit: 1, claimWindowMs: 2000 });
    const locker = await pool.connect();
    const waiter = await pool.connect();
    try {
      await waiter.query("SET statement_timeout = '8s'");
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM notification_queue WHERE id = $1 FOR UPDATE', [lockedRow.id]);
      const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const waitingStore = createPushNotificationQueueStore({ getPoolFn: () => waiter });
      const completion = waitingStore.markNotificationSent(lockedRow.id, lockedClaim)
        .then((value) => ({ value }), (error) => ({ error }));
      async function waitForDatabaseCondition(sql, params) {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          if ((await pool.query(sql, params)).rows[0]?.ready) return;
          await setImmediate();
        }
        assert.fail('Expected database condition was not observed');
      }
      await waitForDatabaseCondition("SELECT wait_event_type = 'Lock' AS ready FROM pg_stat_activity WHERE pid = $1", [pid]);
      await waitForDatabaseCondition('SELECT clock_timestamp() >= next_attempt_at AS ready FROM notification_queue WHERE id = $1', [lockedRow.id]);
      await locker.query('COMMIT');
      assert.deepEqual(await completion, { value: false });
      assert.equal((await rowState(lockedRow.id)).status, 'pending');
    } finally {
      await locker.query('ROLLBACK');
      locker.release();
      waiter.release(true);
    }
    const [recoveredLock] = await store.claimPendingNotifications({ limit: 1 });
    assert.equal(recoveredLock.id, lockedRow.id);
    assert.equal(await store.markNotificationFailed(lockedRow.id, { ...recoveredLock, expired: true }), true);

    const coalesceRow = await enqueue();
    let racedClaim;
    const service = createPushNotificationDispatchService({
      pushSubscriptionStore: { listSubscriptionsForUser: async () => [{ id: subscriptionId }] },
      pushNotificationQueueStore: { ...store, updatePendingNotificationPayload: async (input) => {
        [racedClaim] = await store.claimPendingNotifications({ limit: 1 });
        return store.updatePendingNotificationPayload(input);
      } },
    });
    const result = await service.sendNotificationToUser({ userId, eventType: 'releaseAdded', coalesceKey: 'release-added', payload: { title: 'Newer' } });
    assert.equal(racedClaim.id, coalesceRow.id);
    assert.equal(result.updated, 0);
    assert.equal(result.queued, 1);
    assert.deepEqual((await rowState(coalesceRow.id)).payload, { title: 'Original' });
    const unclaimed = await store.listPendingNotificationsForCoalesce({ userId, eventType: 'releaseAdded', coalesceKey: 'release-added' });
    assert.equal(unclaimed.length, 1);
    assert.deepEqual(unclaimed[0].payload, { title: 'Newer' });
    assert.equal(unclaimed[0].claimToken, null);
  } });
});

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';
import { createPushNotificationDispatchService } from '../../src/server/push/push-notification-dispatch-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('PostgreSQL queue freshness expires stale work without reviving payloads or shortening other active claims', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const userId = (await pool.query("INSERT INTO app_users (username, password_hash, role) VALUES ('expiry-owner', 'test-only', 'requester') RETURNING id")).rows[0].id;
    const subscriptionId = (await pool.query(`INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, 'https://push-fixture.example.com/expiry', 'test-key', 'test-auth') RETURNING id`, [userId])).rows[0].id;
    // Reconstruct the legacy queue shape in this disposable database, then execute the exact forward migration.
    // This exercises its backfill, not migration-ledger bookkeeping (already verified by applyPendingMigrations).
    await pool.query('ALTER TABLE notification_queue DROP COLUMN expires_at');
    const legacy = (await pool.query(`INSERT INTO notification_queue
      (user_id, subscription_id, event_type, payload, ttl_seconds, status, created_at)
      VALUES ($1, $2, 'releaseAdded', '{}', 120, 'sent', '2026-01-01T00:00:00Z') RETURNING id`, [userId, subscriptionId])).rows[0];
    await pool.query(await readFile(new URL('../../src/server/migrations/20260913_103213_add_push_notification_expiry.sql', import.meta.url), 'utf8'));
    const backfilled = (await pool.query(`SELECT expires_at = created_at + ttl_seconds * INTERVAL '1 second' AS exact,
      expires_at < clock_timestamp() AS already_expired FROM notification_queue WHERE id = $1`, [legacy.id])).rows[0];
    assert.deepEqual(backfilled, { exact: true, already_expired: true });

    const queue = createPushNotificationQueueStore({ getPoolFn });
    const enqueue = (coalesceKey = null) => queue.enqueueNotification({ userId, subscriptionId, eventType: 'releaseAdded',
      coalesceKey, payload: { title: 'Original' }, ttlSeconds: 120 });
    const read = async (id) => (await pool.query('SELECT * FROM notification_queue WHERE id = $1', [id])).rows[0];
    let sends = 0;
    const service = createPushNotificationDispatchService({
      pushNotificationQueueStore: queue,
      pushSubscriptionStore: { getSubscriptionById: async () => ({ id: subscriptionId, userId }),
        listSubscriptionsForUser: async () => [{ id: subscriptionId, userId }] },
      pushNotificationDeliveryPolicyService: { getDeliveryDecision: async () => ({ allowed: true, retryable: false }) },
      pushNotificationService: { sendNotificationToSubscription: async ({ ttl, timeoutMs }) => {
        sends++;
        assert.equal(ttl, 1);
        assert.ok(timeoutMs > 0 && timeoutMs <= 11000);
        return { status: 'sent' };
      } },
    });

    const expired = await enqueue();
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() - INTERVAL '1 second', next_attempt_at = clock_timestamp() + INTERVAL '1 hour' WHERE id = $1", [expired.id]);
    const outcome = await service.deliverPendingNotifications({ limit: 1 });
    assert.equal(outcome.expiredCount, 1);
    assert.equal(sends, 0, 'Expired rows must never enter the transport that performs DNS and HTTP');
    assert.equal((await read(expired.id)).status, 'expired');
    assert.equal((await read(expired.id)).claim_token, null);

    const active = await enqueue();
    const [claim] = await queue.claimPendingNotifications({ limit: 1 });
    assert.equal(claim.id, active.id);
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() - INTERVAL '1 second' WHERE id = $1", [active.id]);
    assert.deepEqual(await queue.claimPendingNotifications({ limit: 1 }), [], 'Expired freshness must not steal an unexpired lease');
    assert.equal((await read(active.id)).claim_token, claim.claimToken);
    assert.equal(await queue.markNotificationFailed(active.id, { claimToken: claim.claimToken, expired: true }), true);

    const short = await enqueue();
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() + INTERVAL '12 seconds' WHERE id = $1", [short.id]);
    assert.equal((await service.deliverPendingNotifications({ limit: 1 })).deliveredCount, 1);
    assert.equal(sends, 1);

    const fresh = await enqueue('fresh');
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() + INTERVAL '20 seconds' WHERE id = $1", [fresh.id]);
    const prior = await read(fresh.id);
    assert.equal((await queue.updatePendingNotificationPayload({ ids: [fresh.id], payload: { title: 'Fresh update' }, ttlSeconds: 120 })).length, 1);
    const updated = await read(fresh.id);
    assert.ok(updated.expires_at > prior.expires_at);
    assert.deepEqual(updated.payload, { title: 'Fresh update' });
    const [freshClaim] = await queue.claimPendingNotifications({ limit: 1 });
    assert.equal(freshClaim.id, fresh.id);
    assert.deepEqual(await queue.updatePendingNotificationPayload({ ids: [fresh.id], payload: { title: 'Must not replace' }, ttlSeconds: 300 }), []);
    assert.equal(await queue.markNotificationFailed(fresh.id, { claimToken: freshClaim.claimToken, expired: true }), true);

    const stale = await enqueue('stale');
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() - INTERVAL '1 second' WHERE id = $1", [stale.id]);
    assert.deepEqual(await queue.listPendingNotificationsForCoalesce({ userId, eventType: 'releaseAdded', coalesceKey: 'stale' }), []);
    assert.deepEqual(await queue.updatePendingNotificationPayload({ ids: [stale.id], payload: { title: 'Must not revive' }, ttlSeconds: 120 }), []);
    const producing = await service.sendNotificationToUser({ userId, eventType: 'releaseAdded', coalesceKey: 'stale', payload: { title: 'New event' } });
    assert.equal(producing.queued, 1);
    assert.equal(producing.updated, 0);
    assert.deepEqual((await read(stale.id)).payload, { title: 'Original' });
    const replacements = await queue.listPendingNotificationsForCoalesce({ userId, eventType: 'releaseAdded', coalesceKey: 'stale' });
    assert.equal(replacements.length, 1);
    assert.notEqual(replacements[0].id, stale.id);

    const locked = await enqueue('locked');
    await pool.query("UPDATE notification_queue SET expires_at = clock_timestamp() + INTERVAL '2 seconds' WHERE id = $1", [locked.id]);
    const locker = await pool.connect();
    let waiter;
    let completion;
    try {
      waiter = await pool.connect();
      await waiter.query("SET statement_timeout = '8s'");
      const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM notification_queue WHERE id = $1 FOR UPDATE', [locked.id]);
      const waitingStore = createPushNotificationQueueStore({ getPoolFn: () => waiter });
      completion = waitingStore.updatePendingNotificationPayload({ ids: [locked.id], payload: { title: 'Too late' }, ttlSeconds: 120 })
        .then((value) => ({ value }), (error) => ({ error }));
      async function waitForCondition(sql, parameters) {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          if ((await pool.query(sql, parameters)).rows[0]?.ready) return;
          await setImmediate();
        }
        assert.fail('Expected database synchronization condition was not observed');
      }
      await waitForCondition("SELECT wait_event_type = 'Lock' AS ready FROM pg_stat_activity WHERE pid = $1", [pid]);
      await waitForCondition('SELECT expires_at <= clock_timestamp() AS ready FROM notification_queue WHERE id = $1', [locked.id]);
      await locker.query('COMMIT');
      assert.deepEqual(await completion, { value: [] });
      assert.deepEqual((await read(locked.id)).payload, { title: 'Original' });
    } finally {
      try { await locker.query('ROLLBACK'); }
      finally { if (completion) await completion; locker.release(); waiter?.release(true); }
    }
  } });
});

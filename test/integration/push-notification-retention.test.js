/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';
import { createPushNotificationRetentionStore } from '../../src/server/push/push-notification-retention-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('PostgreSQL terminal retention preserves live work, backfills grace, and bounds concurrent rollback-safe cleanup', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const userId = (await pool.query("INSERT INTO app_users (username, password_hash, role) VALUES ('retention-owner', 'test-only', 'requester') RETURNING id")).rows[0].id;
    // Reconstruct the legacy shape inside this disposable database, then replay the exact forward migration.
    await pool.query('ALTER TABLE notification_queue DROP COLUMN terminal_at');
    const legacy = (await pool.query(`INSERT INTO notification_queue
      (user_id, event_type, payload, ttl_seconds, status, created_at, sent_at, expires_at, next_attempt_at)
      SELECT $1, 'releaseAdded', '{}', 120, state, clock_timestamp() - INTERVAL '30 days',
        CASE WHEN marker = 'known' THEN clock_timestamp() - INTERVAL '20 days' ELSE NULL END,
        clock_timestamp() - INTERVAL '29 days', clock_timestamp() + INTERVAL '1 day'
      FROM (VALUES ('sent','known'), ('sent','unknown'), ('failed','unknown'), ('expired','unknown'), ('pending','unknown')) AS source(state, marker)
      RETURNING id, status, sent_at`, [userId])).rows;
    const beforeMigration = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
    await pool.query(await readFile(new URL('../../src/server/migrations/20260913_104834_add_notification_terminal_retention.sql', import.meta.url), 'utf8'));
    const afterMigration = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
    const read = async (id) => (await pool.query('SELECT * FROM notification_queue WHERE id = $1', [id])).rows[0];
    const baselines = [];
    for (const row of legacy) {
      const current = await read(row.id);
      if (row.status === 'pending') assert.equal(current.terminal_at, null);
      else if (row.sent_at) assert.equal(current.terminal_at.getTime(), row.sent_at.getTime());
      else {
        assert.ok(current.terminal_at >= beforeMigration && current.terminal_at <= afterMigration);
        baselines.push(current.terminal_at.getTime());
      }
    }
    assert.equal(new Set(baselines).size, 1, 'Unknown terminal ages receive one migration baseline');
    const retention = createPushNotificationRetentionStore({ getPoolFn });
    assert.deepEqual(await retention.deleteTerminalNotificationHistory({ limit: 500 }), { deletedCount: 1 });
    for (const row of legacy.filter((entry) => !entry.sent_at)) assert.ok(await read(row.id), 'Migration grace and pending work survive cleanup');

    const queue = createPushNotificationQueueStore({ getPoolFn });
    const enqueue = () => queue.enqueueNotification({ userId, eventType: 'releaseAdded', payload: { title: 'Retained work' }, ttlSeconds: 120 });
    for (const status of ['sent', 'failed', 'expired']) {
      const row = await enqueue();
      const [claim] = await queue.claimPendingNotifications({ limit: 1 });
      assert.equal(claim.id, row.id);
      assert.equal(await queue.markNotificationFailed(row.id, { claimToken: randomUUID(), failed: true }), false);
      assert.equal((await read(row.id)).terminal_at, null);
      assert.equal(await queue.markNotificationFailed(row.id, { claimToken: claim.claimToken, nextAttemptAt: new Date(Date.now() - 1000).toISOString() }), true);
      assert.equal((await read(row.id)).terminal_at, null, 'Retry must not start terminal retention');
      const [retry] = await queue.claimPendingNotifications({ limit: 1 });
      assert.equal(retry.id, row.id);
      assert.notEqual(retry.claimToken, claim.claimToken);
      assert.equal(await queue.markNotificationSent(row.id, claim), false);
      assert.equal((await read(row.id)).terminal_at, null);
      assert.equal(status === 'sent' ? await queue.markNotificationSent(row.id, retry)
        : await queue.markNotificationFailed(row.id, { claimToken: retry.claimToken, [status]: true }), true);
      const terminal = await read(row.id);
      assert.equal(terminal.status, status);
      assert.ok(terminal.terminal_at instanceof Date);
      assert.equal(terminal.claim_token, null);
      if (status === 'sent') assert.equal(terminal.sent_at.getTime(), terminal.terminal_at.getTime());
      assert.equal(await queue.markNotificationFailed(row.id, { claimToken: retry.claimToken, failed: true }), false);
      assert.equal((await read(row.id)).terminal_at.getTime(), terminal.terminal_at.getTime());
      await pool.query("UPDATE notification_queue SET created_at = clock_timestamp() - INTERVAL '60 days' WHERE id = $1", [row.id]);
    }
    const direct = await queue.recordSentNotification({ userId, eventType: 'releaseAdded', payload: {}, ttlSeconds: 120 });
    const directRow = await read(direct.id);
    assert.equal(directRow.sent_at.getTime(), directRow.terminal_at.getTime());
    await assert.rejects(pool.query('UPDATE notification_queue SET terminal_at = NULL WHERE id = $1', [direct.id]), { code: '23514' });
    await assert.rejects(pool.query("UPDATE notification_queue SET terminal_at = 'infinity' WHERE id = $1", [direct.id]), { code: '23514' });

    const active = await enqueue();
    const [activeClaim] = await queue.claimPendingNotifications({ limit: 1 });
    assert.equal(activeClaim.id, active.id);
    await assert.rejects(pool.query('UPDATE notification_queue SET terminal_at = clock_timestamp() WHERE id = $1', [active.id]), { code: '23514' });
    assert.deepEqual(await retention.deleteTerminalNotificationHistory({ limit: 500 }), { deletedCount: 0 }, 'Old creation times do not age recent terminal outcomes');
    assert.equal((await read(active.id)).claim_token, activeClaim.claimToken);

    async function seedOld(count) {
      return (await pool.query(`INSERT INTO notification_queue
        (user_id, event_type, payload, ttl_seconds, status, expires_at, terminal_at)
        SELECT $1, 'releaseAdded', '{"title":"Old terminal payload"}', 120,
          (ARRAY['sent','failed','expired'])[1 + (number % 3)],
          clock_timestamp() - INTERVAL '9 days', clock_timestamp() - INTERVAL '8 days'
        FROM generate_series(1, $2::integer) AS source(number) RETURNING id`, [userId, count])).rows.map(({ id }) => id);
    }
    const old = await seedOld(7);
    for (const deletedCount of [2, 2, 2, 1, 0]) assert.deepEqual(await retention.deleteTerminalNotificationHistory({ limit: 2 }), { deletedCount });
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM notification_queue WHERE id = ANY($1::uuid[])', [old])).rows[0].count, 0);
    assert.ok(await read(active.id));

    const concurrent = await seedOld(6);
    const locker = await pool.connect();
    let second;
    try {
      second = await pool.connect();
      await locker.query('BEGIN');
      const firstStore = createPushNotificationRetentionStore({ getPoolFn: () => locker });
      assert.deepEqual(await firstStore.deleteTerminalNotificationHistory({ limit: 2 }), { deletedCount: 2 });
      await second.query("SET statement_timeout = '5s'");
      const secondStore = createPushNotificationRetentionStore({ getPoolFn: () => second });
      assert.deepEqual(await secondStore.deleteTerminalNotificationHistory({ limit: 2 }), { deletedCount: 2 }, 'Concurrent cleanup skips rows locked by an uncommitted cleaner');
      await locker.query('ROLLBACK');
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM notification_queue WHERE id = ANY($1::uuid[])', [concurrent])).rows[0].count, 4, 'Rollback restores the first cleaner rows without undoing committed sibling deletion');
      assert.deepEqual(await retention.deleteTerminalNotificationHistory({ limit: 500 }), { deletedCount: 4 });
      assert.deepEqual(await retention.deleteTerminalNotificationHistory({ limit: 500 }), { deletedCount: 0 });
      assert.equal((await read(active.id)).claim_token, activeClaim.claimToken);
    } finally {
      try { await locker.query('ROLLBACK'); }
      finally { locker.release(); second?.release(true); }
    }
  } });
});

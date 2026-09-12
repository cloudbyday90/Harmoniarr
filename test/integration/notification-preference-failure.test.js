/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { broadcastNotification } from '../../src/server/notification/notification-broadcast-service.js';
import { createNotificationPreferenceDispatchService } from '../../src/server/notification/notification-preference-dispatch-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('database preference failures cannot bypass saved opt-outs or block healthy recipients', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const { rows: users } = await pool.query(`INSERT INTO app_users (username, password_hash, role, user_preferences)
      VALUES ('opted-out', 'test-only', 'requester', $1::jsonb), ('enabled', 'test-only', 'requester', $2::jsonb)
      RETURNING id, username`, [JSON.stringify({ notificationPreferences: { requestFulfilled: false } }),
      JSON.stringify({ notificationPreferences: { requestFulfilled: true } })]);
    const optedOutId = users.find((user) => user.username === 'opted-out').id;
    const enabledId = users.find((user) => user.username === 'enabled').id;
    let unavailable = true;
    const appUsers = createAppUserService({ getPoolFn: () => ({ query: async (sql, values) => {
      if (unavailable && values?.[0] === optedOutId) throw new Error('private database detail');
      return pool.query(sql, values);
    } }) });
    const sent = [];
    const sendNotificationToUser = async ({ userId }) => { sent.push(userId); return { sent: 1, failed: 0 }; };
    const options = { category: 'requestFulfilled', payload: { title: 'Music ready' },
      listAppUsers: async () => users, getUserPreferences: appUsers.getUserPreferences, sendNotificationToUser };
    assert.deepEqual(await broadcastNotification(options), { failed: 1 });
    assert.deepEqual(sent, [enabledId]);
    const direct = createNotificationPreferenceDispatchService(options);
    assert.deepEqual(await direct.sendNotification({ category: options.category, userId: optedOutId, payload: options.payload }),
      { sent: 0, failed: 1, removed: 0 });
    unavailable = false;
    assert.deepEqual(await direct.sendNotification({ category: options.category, userId: optedOutId, payload: options.payload }),
      { sent: 0, failed: 0, removed: 0 });
    assert.deepEqual(sent, [enabledId]);
    await pool.query('UPDATE app_users SET user_preferences = $1::jsonb WHERE id = $2', [
      JSON.stringify({ notificationPreferences: { requestFulfilled: true } }), optedOutId,
    ]);
    assert.deepEqual(await direct.sendNotification({ category: options.category, userId: optedOutId, payload: options.payload }),
      { sent: 1, failed: 0 });
    assert.deepEqual(sent, [enabledId, optedOutId]);
    assert.deepEqual(await direct.sendNotification({ category: options.category,
      userId: '00000000-0000-4000-8000-000000000000', payload: options.payload }), { sent: 0, failed: 1, removed: 0 });
    assert.deepEqual(sent, [enabledId, optedOutId], 'A missing account cannot reach dispatch');
  } });
});

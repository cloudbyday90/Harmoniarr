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

import { getPool } from '../database.js';

export function createPushNotificationQueueStore({ getPoolFn = getPool } = {}) {
  async function enqueueNotification({ userId, subscriptionId = null, eventType, coalesceKey = null, payload, ttlSeconds }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO notification_queue (user_id, subscription_id, event_type, coalesce_key, payload, ttl_seconds, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [userId, subscriptionId, eventType, coalesceKey, payload, ttlSeconds]
    );
    return result.rows[0];
  }

  async function claimPendingNotifications({ limit = 50 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `UPDATE notification_queue
       SET status = 'pending', attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM notification_queue
         WHERE status = 'pending' AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit]
    );
    return result.rows;
  }

  async function markNotificationSent(id) {
    const pool = getPoolFn();
    await pool.query(
      `UPDATE notification_queue
       SET status = 'sent', sent_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async function markNotificationFailed(id, { nextAttemptAt = null, expired = false } = {}) {
    const pool = getPoolFn();
    const status = expired ? 'expired' : 'pending';
    const query = nextAttemptAt
      ? 'UPDATE notification_queue SET status = $1, next_attempt_at = $2 WHERE id = $3'
      : 'UPDATE notification_queue SET status = $1 WHERE id = $2';
    const params = nextAttemptAt ? [status, nextAttemptAt, id] : [status, id];
    await pool.query(query, params);
  }

  return {
    enqueueNotification,
    claimPendingNotifications,
    markNotificationSent,
    markNotificationFailed,
  };
}

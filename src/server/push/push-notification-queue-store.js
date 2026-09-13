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

import { validateQueueTtlSeconds } from './push-queue-ttl-policy.js';
import { getPool } from '../database.js';

function mapNotificationQueueRow(row) {
  return {
    attempts: row.attempts ?? 0,
    claimToken: row.claim_token ?? null,
    coalesceKey: row.coalesce_key ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    eventType: row.event_type,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at ?? null,
    id: row.id,
    nextAttemptAt: row.next_attempt_at instanceof Date ? row.next_attempt_at.toISOString() : row.next_attempt_at,
    payload: row.payload ?? null,
    sentAt: row.sent_at instanceof Date ? row.sent_at.toISOString() : row.sent_at,
    status: row.status,
    subscriptionId: row.subscription_id ?? null,
    ttlSeconds: row.ttl_seconds,
    userId: row.user_id,
  };
}

export function createPushNotificationQueueStore({ getPoolFn = getPool } = {}) {
  async function enqueueNotification({ userId, subscriptionId = null, eventType, coalesceKey = null, payload, ttlSeconds }) {
    validateQueueTtlSeconds(ttlSeconds);
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO notification_queue (user_id, subscription_id, event_type, coalesce_key, payload, ttl_seconds, status, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', clock_timestamp() + ($6::integer * INTERVAL '1 second'))
        RETURNING *`,
      [userId, subscriptionId, eventType, coalesceKey, JSON.stringify(payload ?? {}), ttlSeconds]
    );
    return mapNotificationQueueRow(result.rows[0]);
  }

  async function claimPendingNotifications({ claimWindowMs = 60000, limit = 50 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `UPDATE notification_queue
       SET status = 'pending',
           attempts = attempts + 1,
           claim_token = harmoniarr_generate_uuid(),
           next_attempt_at = clock_timestamp() + ($2 * INTERVAL '1 millisecond')
       WHERE id IN (
          SELECT id FROM notification_queue
          WHERE status = 'pending' AND (next_attempt_at <= clock_timestamp()
            OR (claim_token IS NULL AND expires_at <= clock_timestamp()))
          ORDER BY next_attempt_at ASC, id ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [limit, claimWindowMs]
    );
    return result.rows.map(mapNotificationQueueRow);
  }

  function validClaimToken(claimToken) {
    return typeof claimToken === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimToken);
  }

  async function getNotificationDeliveryBudget(id, { claimToken } = {}) {
    if (!validClaimToken(claimToken)) return null;
    const result = await getPoolFn().query(
      `WITH current_clock AS MATERIALIZED (SELECT clock_timestamp() AS checked_at)
       SELECT (EXTRACT(EPOCH FROM (next_attempt_at - checked_at)) * 1000)::double precision AS claim_remaining_ms,
              (EXTRACT(EPOCH FROM (expires_at - checked_at)) * 1000)::double precision AS freshness_remaining_ms
       FROM notification_queue CROSS JOIN current_clock
       WHERE id = $1 AND claim_token = $2::uuid AND status = 'pending' AND next_attempt_at > checked_at`,
      [id, claimToken],
    );
    const row = result.rows[0];
    return row ? { claimRemainingMs: row.claim_remaining_ms, freshnessRemainingMs: row.freshness_remaining_ms } : null;
  }

  async function getNotificationClaimRemainingMs(id, { claimToken } = {}) {
    if (!validClaimToken(claimToken)) return null;
    const result = await getPoolFn().query(
      `SELECT (EXTRACT(EPOCH FROM (next_attempt_at - clock_timestamp())) * 1000)::double precision AS remaining_ms
       FROM notification_queue
       WHERE id = $1 AND claim_token = $2::uuid AND status = 'pending'
         AND next_attempt_at > clock_timestamp()`,
      [id, claimToken],
    );
    return result.rows[0]?.remaining_ms ?? null;
  }

  async function isNotificationClaimActive(id, { claimToken } = {}) {
    if (!validClaimToken(claimToken)) return false;
    const result = await getPoolFn().query(
      `SELECT id FROM notification_queue
       WHERE id = $1 AND claim_token = $2::uuid AND status = 'pending'
         AND next_attempt_at > clock_timestamp()`,
      [id, claimToken],
    );
    return result.rows.length === 1;
  }

  async function markNotificationSent(id, { claimToken } = {}) {
    if (!validClaimToken(claimToken)) return false;
    const result = await getPoolFn().query(
      `WITH owned AS MATERIALIZED (
         SELECT id, next_attempt_at FROM notification_queue
         WHERE id = $1 AND claim_token = $2::uuid AND status = 'pending' FOR UPDATE
       )
       UPDATE notification_queue AS queue
       SET status = 'sent', sent_at = clock_timestamp(), claim_token = NULL
       FROM owned
       WHERE queue.id = owned.id AND queue.claim_token = $2::uuid AND queue.status = 'pending'
         AND owned.next_attempt_at > clock_timestamp()
       RETURNING queue.id`,
      [id, claimToken],
    );
    return result.rows.length === 1;
  }

  async function markNotificationFailed(id, { claimToken, expired = false, failed = false, nextAttemptAt = null } = {}) {
    if (!validClaimToken(claimToken)) return false;
    const status = expired ? 'expired' : (failed ? 'failed' : 'pending');
    const result = await getPoolFn().query(
      `WITH owned AS MATERIALIZED (
         SELECT id, next_attempt_at FROM notification_queue
         WHERE id = $1 AND claim_token = $2::uuid AND status = 'pending' FOR UPDATE
       )
       UPDATE notification_queue AS queue
       SET status = $3, next_attempt_at = COALESCE($4::timestamptz, queue.next_attempt_at), claim_token = NULL
       FROM owned
       WHERE queue.id = owned.id AND queue.claim_token = $2::uuid AND queue.status = 'pending'
         AND owned.next_attempt_at > clock_timestamp()
       RETURNING queue.id`,
      [id, claimToken, status, nextAttemptAt],
    );
    return result.rows.length === 1;
  }

  async function getLatestSentNotificationAt({ userId, eventType, coalesceKey = null, since = null }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT COALESCE(sent_at, created_at) AS dispatched_at
        FROM notification_queue
        WHERE user_id = $1
          AND event_type = $2
          AND (
            ($3::text IS NULL AND coalesce_key IS NULL)
            OR coalesce_key = $3::text
          )
          AND status = 'sent'
          AND ($4::timestamptz IS NULL OR COALESCE(sent_at, created_at) >= $4::timestamptz)
        ORDER BY COALESCE(sent_at, created_at) DESC
        LIMIT 1
      `,
      [userId, eventType, coalesceKey, since],
    );

    return result.rows[0]?.dispatched_at?.toISOString?.() ?? result.rows[0]?.dispatched_at ?? null;
  }

  async function listPendingNotificationsForCoalesce({ coalesceKey, eventType, since, userId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT *
         FROM notification_queue
        WHERE user_id = $1
          AND event_type = $2
          AND coalesce_key = $3
          AND status = 'pending' AND claim_token IS NULL AND attempts = 0
          AND expires_at > clock_timestamp()
          AND ($4::timestamptz IS NULL OR created_at >= $4::timestamptz)
        ORDER BY created_at DESC`,
      [userId, eventType, coalesceKey, since ?? null],
    );

    return result.rows.map(mapNotificationQueueRow);
  }

  async function updatePendingNotificationPayload({ ids, payload = {}, ttlSeconds }) {
    const normalizedIds = Array.isArray(ids)
      ? ids.filter((id) => typeof id === 'string' && id.length > 0)
      : [];

    if (normalizedIds.length < 1) {
      return [];
    }

    validateQueueTtlSeconds(ttlSeconds);
    const pool = getPoolFn();
    const result = await pool.query(
      `WITH eligible AS MATERIALIZED (
         SELECT id, expires_at FROM notification_queue
         WHERE id = ANY($1::uuid[]) AND status = 'pending' AND claim_token IS NULL AND attempts = 0
         FOR UPDATE
       )
       UPDATE notification_queue AS queue
       SET payload = $2::jsonb, ttl_seconds = $3,
           expires_at = clock_timestamp() + ($3::integer * INTERVAL '1 second')
       FROM eligible
       WHERE queue.id = eligible.id AND queue.status = 'pending' AND queue.claim_token IS NULL AND queue.attempts = 0
         AND eligible.expires_at > clock_timestamp()
       RETURNING queue.*`,
      [normalizedIds, JSON.stringify(payload), ttlSeconds],
    );

    return result.rows.map(mapNotificationQueueRow);
  }

  async function recordSentNotification({ userId, subscriptionId = null, eventType, coalesceKey = null, payload = {}, ttlSeconds }) {
    validateQueueTtlSeconds(ttlSeconds);
    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO notification_queue (
          user_id,
          subscription_id,
          event_type,
          coalesce_key,
          payload,
          ttl_seconds,
          status,
          sent_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'sent', clock_timestamp(), clock_timestamp() + ($6::integer * INTERVAL '1 second'))
        RETURNING *
      `,
      [userId, subscriptionId, eventType, coalesceKey, JSON.stringify(payload), ttlSeconds],
    );

    return mapNotificationQueueRow(result.rows[0]);
  }

  async function deleteSentNotificationHistory({ olderThan } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        DELETE FROM notification_queue
        WHERE status = 'sent'
          AND ($1::timestamptz IS NULL OR COALESCE(sent_at, created_at) < $1::timestamptz)
      `,
      [olderThan ?? null],
    );

    return {
      deletedCount: result.rowCount ?? 0,
    };
  }

  return {
    deleteSentNotificationHistory,
    enqueueNotification,
    getLatestSentNotificationAt,
    claimPendingNotifications,
    listPendingNotificationsForCoalesce,
    getNotificationClaimRemainingMs,
    getNotificationDeliveryBudget,
    isNotificationClaimActive,
    markNotificationSent,
    markNotificationFailed,
    recordSentNotification,
    updatePendingNotificationPayload,
  };
}

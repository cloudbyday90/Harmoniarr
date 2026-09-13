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

/**
 * Maps a raw DB row from `user_push_subscriptions` to a normalized camelCase shape.
 * @param {object} row
 * @returns {object}
 */
function mapSubscriptionRow(row) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    endpoint: row.endpoint,
    registrationToken: row.registration_token,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent ?? null,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
  };
}

/**
 * SQL store for `user_push_subscriptions`.
 *
 * Handles upsert, delete, and list operations. All business logic lives in
 * `push-notification-service.js`.
 *
 * @param {object} [options]
 * @param {function} [options.getPoolFn]
 * @returns {{ upsertSubscription, deleteSubscription, invalidateSubscriptionRegistration, getSubscriptionById, listSubscriptionsForUser, listAllSubscriptions }}
 */
export function createPushSubscriptionStore({ getPoolFn = getPool } = {}) {
  /**
   * Registers an endpoint, replacing its owner and keys on conflict.
   * Every registration rotates its token, including identical re-registration.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.endpoint
   * @param {string} params.p256dh
   * @param {string} params.auth
   * @param {string|null} [params.userAgent]
   * @returns {Promise<object>} The upserted row, normalized.
   */
  async function upsertSubscription({ userId, endpoint, p256dh, auth, userAgent = null }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, invalidated_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (endpoint)
       DO UPDATE SET
         user_id        = EXCLUDED.user_id,
         p256dh         = EXCLUDED.p256dh,
         auth           = EXCLUDED.auth,
         user_agent     = EXCLUDED.user_agent,
         registration_token = harmoniarr_generate_uuid(),
         invalidated_at = NULL
       RETURNING *`,
      [userId, endpoint, p256dh, auth, userAgent],
    );
    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Removes a specific subscription for a user+endpoint pair.
   * No-ops silently when the row does not exist.
   *
   * @param {string} userId
   * @param {string} endpoint
   * @returns {Promise<void>}
   */
  async function deleteSubscription(userId, endpoint) {
    const pool = getPoolFn();
    await pool.query(
      'DELETE FROM user_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint],
    );
  }

  /**
   * Invalidates only the active registration used by the original send.
   * A stale or incomplete identity is an expected no-op.
   * @returns {Promise<boolean>} Whether this registration was invalidated.
   */
  async function invalidateSubscriptionRegistration(identity = {}) {
    const { id, userId, endpoint, registrationToken } = identity ?? {};
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![id, userId, registrationToken].every((value) => typeof value === 'string' && uuidPattern.test(value))
      || typeof endpoint !== 'string' || endpoint.length === 0) return false;
    const result = await getPoolFn().query(
      `UPDATE user_push_subscriptions SET invalidated_at = clock_timestamp()
       WHERE id = $1 AND user_id = $2 AND endpoint = $3
         AND registration_token = $4::uuid AND invalidated_at IS NULL
       RETURNING id`,
      [id, userId, endpoint, registrationToken],
    );
    return result.rows.length === 1;
  }

  /**
   * Returns a single active subscription by id.
   *
   * @param {string} subscriptionId
   * @returns {Promise<object|null>}
   */
  async function getSubscriptionById(subscriptionId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT * FROM user_push_subscriptions WHERE id = $1 AND invalidated_at IS NULL LIMIT 1',
      [subscriptionId],
    );
    return result.rows[0] ? mapSubscriptionRow(result.rows[0]) : null;
  }

  /**
   * Returns all active subscriptions for a given user.
   *
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async function listSubscriptionsForUser(userId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT * FROM user_push_subscriptions WHERE user_id = $1 AND invalidated_at IS NULL ORDER BY created_at ASC',
      [userId],
    );
    return result.rows.map(mapSubscriptionRow);
  }

  /**
   * Returns all active subscriptions (used for broadcast sends).
   *
   * @returns {Promise<object[]>}
   */
  async function listAllSubscriptions() {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT * FROM user_push_subscriptions WHERE invalidated_at IS NULL ORDER BY created_at ASC',
    );
    return result.rows.map(mapSubscriptionRow);
  }

  return {
    upsertSubscription,
    deleteSubscription,
    invalidateSubscriptionRegistration,
    getSubscriptionById,
    listSubscriptionsForUser,
    listAllSubscriptions,
  };
}

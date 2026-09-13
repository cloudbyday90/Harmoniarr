/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { PUSH_SUBSCRIPTION_RETENTION_MS, PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT } from './push-subscription-pruning-policy.js';

/** Parent locks plus a fresh READ COMMITTED snapshot protect every retained queue reference. */
export function createPushSubscriptionPruningStore({ getPoolFn = getPool } = {}) {
  async function pruneInvalidatedSubscriptions({ limit = PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT) {
      throw new RangeError('Subscription pruning batch must contain between 1 and 500 rows');
    }
    let client;
    let transactionStarted = false;
    let discard = false;
    try {
      client = await getPoolFn().connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionStarted = true;
      const selected = await client.query(
        `WITH cutoff AS MATERIALIZED (
           SELECT clock_timestamp() - ($1::double precision * INTERVAL '1 millisecond') AS older_than
         )
         SELECT subscription.id, subscription.registration_token,
                subscription.invalidated_at::text AS invalidated_at, cutoff.older_than::text AS older_than
         FROM user_push_subscriptions AS subscription CROSS JOIN cutoff
         WHERE subscription.invalidated_at IS NOT NULL AND isfinite(subscription.invalidated_at)
           AND subscription.invalidated_at < cutoff.older_than
           AND NOT EXISTS (SELECT 1 FROM notification_queue WHERE subscription_id = subscription.id)
         ORDER BY subscription.invalidated_at, subscription.id LIMIT $2
         FOR UPDATE OF subscription SKIP LOCKED`,
        [PUSH_SUBSCRIPTION_RETENTION_MS, limit],
      );
      if (!Array.isArray(selected.rows) || selected.rows.length > limit) throw new Error();
      let deletedCount = 0;
      if (selected.rows.length > 0) {
        // This MUST remain a separate command. A CTE in the selection command
        // would retain its old snapshot and could miss a just-committed FK reference.
        const deleted = await client.query(
          `DELETE FROM user_push_subscriptions AS subscription
           USING unnest($1::uuid[], $2::uuid[], $3::timestamptz[]) AS original(id, registration_token, invalidated_at)
           WHERE subscription.id = original.id AND subscription.registration_token = original.registration_token
             AND subscription.invalidated_at = original.invalidated_at AND subscription.invalidated_at < $4::timestamptz
             AND NOT EXISTS (SELECT 1 FROM notification_queue WHERE subscription_id = subscription.id)`,
          [selected.rows.map((row) => row.id), selected.rows.map((row) => row.registration_token),
            selected.rows.map((row) => row.invalidated_at), selected.rows[0].older_than],
        );
        if (!Number.isSafeInteger(deleted.rowCount) || deleted.rowCount < 0 || deleted.rowCount > selected.rows.length) throw new Error();
        deletedCount = deleted.rowCount;
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return { deletedCount };
    } catch {
      discard = true;
      if (transactionStarted) {
        try { await client.query('ROLLBACK'); } catch { /* Discard the client when transaction recovery is uncertain. */ }
      }
      throw new Error('Invalidated subscription pruning failed');
    } finally {
      client?.release(discard);
    }
  }
  return { pruneInvalidatedSubscriptions };
}

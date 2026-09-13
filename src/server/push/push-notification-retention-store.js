/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { PUSH_NOTIFICATION_RETENTION_MS, PUSH_HISTORY_BATCH_LIMIT } from './push-notification-retention-policy.js';

/** One atomic, count-bounded removal of terminal history; never an unrestricted purge. */
export function createPushNotificationRetentionStore({ getPoolFn = getPool } = {}) {
  async function deleteTerminalNotificationHistory({ limit = PUSH_HISTORY_BATCH_LIMIT } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PUSH_HISTORY_BATCH_LIMIT) {
      throw new RangeError('Notification retention batch must contain between 1 and 500 rows');
    }
    const result = await getPoolFn().query(
      `WITH cutoff AS MATERIALIZED (
         SELECT clock_timestamp() - ($1::double precision * INTERVAL '1 millisecond') AS older_than
       ), eligible AS MATERIALIZED (
         SELECT id FROM notification_queue CROSS JOIN cutoff
         WHERE status IN ('sent', 'failed', 'expired') AND claim_token IS NULL AND terminal_at < older_than
         ORDER BY terminal_at, id LIMIT $2 FOR UPDATE OF notification_queue SKIP LOCKED
       )
       DELETE FROM notification_queue AS queue USING eligible, cutoff
       WHERE queue.id = eligible.id AND queue.status IN ('sent', 'failed', 'expired')
         AND queue.claim_token IS NULL AND queue.terminal_at < cutoff.older_than`,
      [PUSH_NOTIFICATION_RETENTION_MS, limit],
    );
    if (!Number.isSafeInteger(result.rowCount) || result.rowCount < 0 || result.rowCount > limit) {
      throw new Error('Notification retention result is invalid');
    }
    return { deletedCount: result.rowCount };
  }
  return { deleteTerminalNotificationHistory };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';

/** Read only delivery authorization fields; preserve malformed JSON for the policy to reject. */
export function createPushNotificationDeliveryPolicyStore({ getPoolFn = getPool } = {}) {
  async function getDeliveryAccount({ userId }) {
    const result = await getPoolFn().query(
      'SELECT id, is_disabled, role, user_preferences FROM app_users WHERE id = $1 LIMIT 1',
      [userId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, isDisabled: row.is_disabled, role: row.role, userPreferences: row.user_preferences } : null;
  }
  return { getDeliveryAccount };
}

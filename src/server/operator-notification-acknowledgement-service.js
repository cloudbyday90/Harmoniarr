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

import { getPool } from './database.js';

export function createOperatorNotificationAcknowledgementService({
  getPoolFn = getPool,
  nowFn = () => new Date(),
} = {}) {
  async function getAcknowledgedAt(userId) {
    const result = await getPoolFn().query(
      `SELECT user_preferences->>'operatorNotificationsAcknowledgedAt' AS acknowledged_at
       FROM app_users WHERE id = $1 LIMIT 1`,
      [userId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    const raw = result.rows[0]?.acknowledged_at;
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  async function setAcknowledgedAt(userId) {
    const timestamp = nowFn().toISOString();
    await getPoolFn().query(
      `UPDATE app_users
       SET user_preferences = jsonb_set(
         COALESCE(user_preferences, '{}'::jsonb),
         '{operatorNotificationsAcknowledgedAt}',
         $2::jsonb
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [userId, JSON.stringify(timestamp)],
    );
    return timestamp;
  }

  return { getAcknowledgedAt, setAcknowledgedAt };
}

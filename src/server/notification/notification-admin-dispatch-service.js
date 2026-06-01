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

import { broadcastNotification } from './notification-broadcast-service.js';

/**
 * Broadcast a push notification to every admin user who has the given
 * notification category enabled in their preferences.
 *
 * Fire-and-forget — errors are swallowed so notification failures never
 * block the originating domain operation.
 *
 * @param {object} options
 * @param {string} options.category - A key from NOTIFICATION_CATEGORIES.
 * @param {{ title: string, body: string, url: string }} options.payload
 * @param {function} options.listAppUsers - Returns all app users.
 * @param {function} options.getUserPreferences - Reads a user's preferences.
 * @param {function} options.sendNotificationToUser - Sends push to one user.
 * @param {string|null} [options.cooldownKey]
 * @param {number} [options.cooldownMs]
 * @param {object|null} [options.dispatchCooldownService]
 */
export async function broadcastAdminNotification({
  category,
  cooldownKey = null,
  cooldownMs = 0,
  dispatchCooldownService = null,
  payload,
  listAppUsers,
  getUserPreferences,
  sendNotificationToUser,
}) {
  return broadcastNotification({
    category,
    cooldownKey,
    cooldownMs,
    dispatchCooldownService,
    getUserPreferences,
    listAppUsers,
    payload,
    recipientFilter: (user) => user.role === 'admin',
    sendNotificationToUser,
  });
}

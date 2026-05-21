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
 * Broadcast a push notification to every app user who has the given category
 * enabled in their preferences.
 *
 * @param {object} options
 * @param {string} options.category
 * @param {{ title: string, body: string, url: string }} options.payload
 * @param {function} options.listAppUsers
 * @param {function} options.getUserPreferences
 * @param {function} options.sendNotificationToUser
 * @param {string|null} [options.cooldownKey]
 * @param {number} [options.cooldownMs]
 * @param {object|null} [options.dispatchCooldownService]
 * @param {string[]} [options.suppressUserIds]
 */
export async function broadcastHouseholdNotification({
  category,
  cooldownKey = null,
  cooldownMs = 0,
  dispatchCooldownService = null,
  payload,
  listAppUsers,
  getUserPreferences,
  sendNotificationToUser,
  suppressUserIds = [],
}) {
  return broadcastNotification({
    category,
    cooldownKey,
    cooldownMs,
    dispatchCooldownService,
    getUserPreferences,
    listAppUsers,
    payload,
    suppressUserIds,
    sendNotificationToUser,
  });
}

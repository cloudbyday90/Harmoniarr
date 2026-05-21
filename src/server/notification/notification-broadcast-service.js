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

import { shouldSendNotification } from './notification-preference-service.js';

/**
 * Broadcast a push notification to every matching user with the given category
 * enabled in their preferences.
 *
 * Fire-and-forget friendly: list and send failures are swallowed so
 * notification delivery never blocks the originating domain operation.
 *
 * @param {object} options
 * @param {string} options.category
 * @param {{ title: string, body: string, url: string }} options.payload
 * @param {function} options.listAppUsers
 * @param {function} options.getUserPreferences
 * @param {function} options.sendNotificationToUser
 * @param {function} [options.recipientFilter]
 */
export async function broadcastNotification({
  category,
  payload,
  listAppUsers,
  getUserPreferences,
  sendNotificationToUser,
  recipientFilter = () => true,
}) {
  let users;
  try {
    users = await listAppUsers();
  } catch {
    return;
  }

  const recipients = Array.isArray(users)
    ? users.filter((user) => user && recipientFilter(user))
    : [];

  await Promise.allSettled(
    recipients.map(async (recipient) => {
      const allowed = await shouldSendNotification({
        category,
        getUserPreferences,
        userId: recipient.id,
      });
      if (!allowed) return;

      return sendNotificationToUser({ userId: recipient.id, payload });
    }),
  );
}

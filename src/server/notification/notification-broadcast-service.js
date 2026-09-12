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
 * Fire-and-forget friendly: list and send failures become an aggregate result
 * so those failures do not reject the originating domain operation.
 *
 * @param {object} options
 * @param {string} options.category
 * @param {{ title: string, body: string, url: string }} options.payload
 * @param {function} options.listAppUsers
 * @param {function} options.getUserPreferences
 * @param {function} options.sendNotificationToUser
 * @param {function} [options.recipientFilter]
 * @returns {Promise<{failed: number}>} Failed or degraded recipient attempts,
 *   counted once per recipient; a failed recipient-list read counts as one.
 */
export async function broadcastNotification({
  category,
  cooldownKey = null,
  cooldownMs = 0,
  dispatchCooldownService = null,
  payload,
  listAppUsers,
  getUserPreferences,
  sendNotificationToUser,
  recipientFilter = () => true,
  suppressUserIds = [],
}) {
  let users;
  try {
    users = await listAppUsers();
  } catch {
    return { failed: 1 };
  }

  const recipients = Array.isArray(users)
    ? users.filter((user) => user && recipientFilter(user))
    : [];

  const suppressedUserIdSet = new Set(
    Array.isArray(suppressUserIds)
      ? suppressUserIds.filter((userId) => typeof userId === 'string' && userId.length > 0)
      : [],
  );

  const outcomes = await Promise.allSettled(
    recipients.map(async (recipient) => {
      if (suppressedUserIdSet.has(recipient.id)) {
        return;
      }

      let preferenceReadFailed = false;
      const allowed = await shouldSendNotification({
        category,
        getUserPreferences: async (input) => {
          try {
            return await getUserPreferences(input);
          } catch (error) {
            preferenceReadFailed = true;
            throw error;
          }
        },
        userId: recipient.id,
      });
      if (!allowed) return;

      if (dispatchCooldownService?.shouldDispatch && !await dispatchCooldownService.shouldDispatch({
        category,
        cooldownKey,
        cooldownMs,
        userId: recipient.id,
      })) {
        return { failed: preferenceReadFailed };
      }

      const result = await sendNotificationToUser({
        coalesceKey: cooldownKey,
        eventType: category,
        payload,
        userId: recipient.id,
      });
      await dispatchCooldownService?.markDispatched?.({
        category,
        cooldownKey,
        cooldownMs,
        payload,
        userId: recipient.id,
      });
      return { failed: preferenceReadFailed || (Number.isFinite(result?.failed) && result.failed > 0) };
    }),
  );

  return {
    failed: outcomes.filter((outcome) => outcome.status === 'rejected' || outcome.value?.failed === true).length,
  };
}

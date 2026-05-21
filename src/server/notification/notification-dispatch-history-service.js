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

import { createPushNotificationQueueStore } from '../push/push-notification-queue-store.js';

export function createNotificationDispatchHistoryService({
  pushNotificationQueueStore = createPushNotificationQueueStore(),
} = {}) {
  async function getLatestDispatchAt({ category, cooldownKey = null, since = null, userId }) {
    return pushNotificationQueueStore.getLatestSentNotificationAt({
      coalesceKey: cooldownKey,
      eventType: category,
      since,
      userId,
    });
  }

  async function recordDispatch({ category, cooldownKey = null, cooldownMs = 0, payload = {}, userId }) {
    const ttlSeconds = Math.max(1, Math.ceil(Number(cooldownMs) / 1000) || 1);
    return pushNotificationQueueStore.recordSentNotification({
      coalesceKey: cooldownKey,
      eventType: category,
      payload,
      ttlSeconds,
      userId,
    });
  }

  return {
    getLatestDispatchAt,
    recordDispatch,
  };
}

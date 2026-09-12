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

import { normalizeUserPreferences } from '../app-user-service.js';
import { NOTIFICATION_CATEGORY_KEYS } from './notification-preference-constants.js';

const isRecord = (value) => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** A missing preference retains its default; an unavailable or malformed read cannot authorize delivery. */
export async function getNotificationPreferenceDecision({ category, getUserPreferences, userId }) {
  if (!NOTIFICATION_CATEGORY_KEYS.includes(category)) return { allowed: false, failed: false };
  try {
    const preferences = await getUserPreferences({ userId });
    if (!isRecord(preferences)) return { allowed: false, failed: true };
    if (Object.hasOwn(preferences, 'notificationPreferences')) {
      const notificationPreferences = preferences.notificationPreferences;
      if (!isRecord(notificationPreferences)
        || (Object.hasOwn(notificationPreferences, category) && typeof notificationPreferences[category] !== 'boolean')) {
        return { allowed: false, failed: true };
      }
    }
    const normalized = normalizeUserPreferences(preferences);
    return { allowed: normalized.notificationPreferences[category] === true, failed: false };
  } catch {
    return { allowed: false, failed: true };
  }
}

/** Compatibility helper for callers that only need the allow/deny decision. */
export async function shouldSendNotification(input) {
  return (await getNotificationPreferenceDecision(input)).allowed;
}

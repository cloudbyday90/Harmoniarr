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

/**
 * Determine whether a push notification should be sent for the given category
 * to the given user.
 *
 * Reads the user's `notificationPreferences` and returns `true` when the
 * category is enabled (the default). Returns `false` when the user has
 * explicitly disabled the category or when the category is not recognised.
 *
 * Never throws — on any read error the notification is allowed through
 * (fail-open) so that misconfigured preferences never silently suppress
 * important alerts.
 *
 * @param {object} options
 * @param {string} options.userId
 * @param {string} options.category - A key from NOTIFICATION_CATEGORIES.
 * @param {function} options.getUserPreferences - Injectable preference reader.
 * @returns {Promise<boolean>}
 */
export async function shouldSendNotification({ category, getUserPreferences, userId }) {
  if (!NOTIFICATION_CATEGORY_KEYS.includes(category)) {
    return false;
  }

  try {
    const preferences = await getUserPreferences({ userId });
    const normalised = normalizeUserPreferences(preferences);
    return Boolean(normalised.notificationPreferences?.[category]);
  } catch {
    return true;
  }
}

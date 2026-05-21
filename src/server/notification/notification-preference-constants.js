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

/**
 * Recognised notification categories and their default enabled state.
 *
 * Each key is the canonical category identifier used in user preferences.
 * The `label` is a human-readable name shown in the preferences UI.
 * The `adminOnly` flag marks categories only relevant to admin users.
 */
export const NOTIFICATION_CATEGORIES = /** @type {const} */ ({
  requestFulfilled: { label: 'Request fulfilled', adminOnly: false, defaultEnabled: true },
  downloadCompleted: { label: 'Download completed', adminOnly: false, defaultEnabled: true },
  releaseAdded: { label: 'Release added', adminOnly: false, defaultEnabled: true },
  artistMonitored: { label: 'Artist monitored', adminOnly: false, defaultEnabled: true },
  requestCreated: { label: 'Request created', adminOnly: false, defaultEnabled: true },
  trustOverride: { label: 'Trust override', adminOnly: true, defaultEnabled: true },
  blocklistEvent: { label: 'Blocklist change', adminOnly: true, defaultEnabled: true },
  trustThresholdCrossed: { label: 'Trust threshold crossed', adminOnly: true, defaultEnabled: true },
});

/** Ordered list of category keys for stable iteration. */
export const NOTIFICATION_CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES);

/**
 * Build a fresh notification-preferences object with every category set to
 * its default enabled state. Used when normalising a user-preferences row
 * that has no `notificationPreferences` key yet.
 *
 * @returns {Record<string, boolean>}
 */
export function buildDefaultNotificationPreferences() {
  const result = {};
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    result[key] = NOTIFICATION_CATEGORIES[key].defaultEnabled;
  }
  return result;
}

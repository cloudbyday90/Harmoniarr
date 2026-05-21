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

import { apiRequest } from './api.js';

/**
 * Fetch the authenticated user's format/quality preferences.
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ ok: boolean, preferences: { preferredFormat: string, minimumQuality: string } }>}
 */
export function fetchMyPreferences({ signal } = {}) {
  return apiRequest('/api/v1/users/me/preferences', { signal });
}

/**
 * Update the authenticated user's format/quality and/or notification preferences.
 *
 * Accepts a partial patch — only specified keys are updated on the server.
 *
 * @param {object} patch
 * @param {string} [patch.preferredFormat]
 * @param {string} [patch.minimumQuality]
 * @param {Record<string, boolean>} [patch.notificationPreferences]
 * @param {AbortSignal} [patch.signal]
 * @returns {Promise<{ ok: boolean, preferences: object }>}
 */
export function updateMyPreferences({ preferredFormat, minimumQuality, notificationPreferences, signal } = {}) {
  const body = {};
  if (preferredFormat !== undefined) body.preferredFormat = preferredFormat;
  if (minimumQuality !== undefined) body.minimumQuality = minimumQuality;
  if (notificationPreferences !== undefined) body.notificationPreferences = notificationPreferences;

  return apiRequest('/api/v1/users/me/preferences', {
    body,
    includeCsrf: true,
    method: 'PATCH',
    signal,
  });
}

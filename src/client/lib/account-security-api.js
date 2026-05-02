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

export function changePassword({ currentPassword, newPassword }) {
  return apiRequest('/api/v1/auth/change-password', {
    method: 'POST',
    body: {
      currentPassword,
      newPassword,
    },
    includeCsrf: true,
  });
}

export function fetchActiveSessions() {
  return apiRequest('/api/v1/auth/sessions');
}

export function fetchRecentActivity() {
  return apiRequest('/api/v1/auth/activity');
}

export function revokeSession(refreshTokenId) {
  return apiRequest(`/api/v1/auth/sessions/${encodeURIComponent(refreshTokenId)}/revoke`, {
    method: 'POST',
    includeCsrf: true,
  });
}
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

export function fetchUsers({ search, role, isDisabled, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (isDisabled) params.set('isDisabled', isDisabled);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const query = params.toString();
  return apiRequest(query ? `/api/v1/users?${query}` : '/api/v1/users');
}

export function fetchPlexLinkedAccountsOverview() {
  return apiRequest('/api/v1/users/linked-accounts/plex');
}

export function createUser(user) {
  return apiRequest('/api/v1/users', {
    method: 'POST',
    includeCsrf: true,
    body: user,
  });
}

export function updateUser(userId, patch) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    includeCsrf: true,
    body: patch,
  });
}

export function issueUserClaimCode(userId, ttlMinutes) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/claim-code`, {
    method: 'POST',
    includeCsrf: true,
    body: { ttlMinutes },
  });
}

export function resetUserPassword(userId, password) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    includeCsrf: true,
    body: { password },
  });
}

export function provisionUserManagedLibraryRoot(userId) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/provision-managed-library-root`, {
    method: 'POST',
    includeCsrf: true,
  });
}

export function previewPlexUserImport() {
  return apiRequest('/api/v1/users/imports/plex/preview');
}

export function applyPlexUserImport() {
  return apiRequest('/api/v1/users/imports/plex/apply', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function relinkPlexUserConflict({ plexUserId, userId }) {
  return apiRequest('/api/v1/users/imports/plex/relink', {
    method: 'POST',
    includeCsrf: true,
    body: {
      plexUserId,
      userId,
    },
  });
}

export function reconcilePlexLinkedAccount(userId, action) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/plex-reconciliation`, {
    method: 'POST',
    includeCsrf: true,
    body: { action },
  });
}

export function unlinkPlexUser(userId) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/unlink-plex`, {
    method: 'POST',
    includeCsrf: true,
  });
}

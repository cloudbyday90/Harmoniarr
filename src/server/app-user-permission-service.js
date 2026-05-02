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

import { createApiError } from './auth.js';

const rolePermissionMap = Object.freeze({
  admin: Object.freeze([
    'admin.system',
    'admin.users',
    'import.execute',
    'import.review',
    'library.discovery',
    'library.scan',
    'media.request',
    'playlist.submit',
  ]),
  operator: Object.freeze([
    'import.execute',
    'import.review',
    'library.discovery',
    'library.scan',
    'media.request',
    'playlist.submit',
  ]),
  requester: Object.freeze([
    'import.preview.self',
    'media.request',
    'playlist.submit',
  ]),
});

export const appUserRoleOptions = Object.freeze(Object.keys(rolePermissionMap));

export function normalizeAppUserRole(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'User role must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!Object.hasOwn(rolePermissionMap, normalized)) {
    throw createApiError(400, 'validation_error', `User role must be one of: ${appUserRoleOptions.join(', ')}`);
  }

  return normalized;
}

export function listPermissionsForRole(role) {
  return [...rolePermissionMap[normalizeAppUserRole(role)]];
}

export function hasAppUserPermission(user, permission) {
  if (typeof permission !== 'string' || permission.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'Permission name must be a non-empty string');
  }

  return listPermissionsForRole(user?.role ?? user).includes(permission.trim());
}

export function createAppUserPermissionService() {
  return {
    hasAppUserPermission,
    listPermissionsForRole,
    normalizeAppUserRole,
    roleOptions: [...appUserRoleOptions],
  };
}
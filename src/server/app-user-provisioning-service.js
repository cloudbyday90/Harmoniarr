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

import { mkdir, realpath, stat } from 'node:fs/promises';
import { createApiError } from './auth.js';
import { recordAuditEvent } from './audit.js';
import {
  buildUserMusicRootPath,
  normalizeManagedLibraryRelativeRoot,
  normalizeOptionalManagedLibraryRelativeRoot,
} from './paths/user-music-root-service.js';
import { loadSettings } from './settings.js';

function normalizeUserId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'User id must be a non-empty string');
  }

  return value.trim();
}

function mapProvisioningError(error) {
  switch (error?.code) {
    case 'EACCES':
    case 'EPERM':
      throw createApiError(500, 'managed_library_root_provisioning_failed', 'Harmoniarr could not create the managed library directory because the shared music root is not writable.');
    case 'ENOTDIR':
    case 'EEXIST':
      throw createApiError(409, 'managed_library_root_path_conflict', 'The configured managed library path is already occupied by a non-directory entry.');
    default:
      throw error;
  }
}

function buildManagedLibraryRootSlug(username) {
  const normalized = typeof username === 'string'
    ? username.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    : '';

  return normalized || 'user';
}

function buildDefaultManagedLibraryRelativeRoot({ user }) {
  return normalizeManagedLibraryRelativeRoot(`listeners/${buildManagedLibraryRootSlug(user?.username)}`, {
    fieldName: 'managedLibraryRelativeRoot',
  });
}

export function createAppUserProvisioningService({
  getAppUserById,
  loadSettingsFn = loadSettings,
  mkdirFn = mkdir,
  realpathFn = realpath,
  recordAuditEventFn = recordAuditEvent,
  statFn = stat,
  updateAppUser,
} = {}) {
  if (typeof getAppUserById !== 'function') {
    throw new TypeError('getAppUserById must be provided');
  }

  async function provisionManagedLibraryRoot({ actorUserId, requestMetadata, userId }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedUserId = normalizeUserId(userId);
    const user = await getAppUserById({ userId: normalizedUserId });

    if (!user) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    if (!user.managedLibraryRelativeRoot) {
      throw createApiError(400, 'app_user_managed_library_root_unconfigured', 'The requested user does not have a managed library subdirectory configured yet');
    }

    const settings = await loadSettingsFn();
    const musicRoot = settings?.paths?.music;
    if (typeof musicRoot !== 'string' || musicRoot.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'The shared music root must be configured before provisioning user directories');
    }

    const userRootPath = buildUserMusicRootPath({
      musicRoot,
      relativeRoot: user.managedLibraryRelativeRoot,
    });

    let createdPath;
    try {
      createdPath = await mkdirFn(userRootPath, { recursive: true });
    } catch (error) {
      mapProvisioningError(error);
    }

    let stats;
    try {
      stats = await statFn(userRootPath);
    } catch (error) {
      mapProvisioningError(error);
    }

    if (!stats.isDirectory()) {
      throw createApiError(409, 'managed_library_root_path_conflict', 'The configured managed library path exists but is not a directory');
    }

    let resolvedPath = null;
    try {
      resolvedPath = await realpathFn(userRootPath);
    } catch {
      // Leave the unresolved path as null when the real path is not yet available.
    }

    const provisioning = {
      authProvider: user.authProvider ?? 'local',
      configuredBy: 'app_user',
      created: typeof createdPath === 'string' && createdPath.length > 0,
      id: user.id,
      relativeRoot: user.managedLibraryRelativeRoot,
      resolvedPath,
      userRootPath,
      username: user.username,
    };

    await recordAuditEventFn({
      actorUserId: normalizedActorUserId,
      actorType: 'user',
      details: {
        created: provisioning.created,
        managedLibraryRelativeRoot: provisioning.relativeRoot,
        userRootPath: provisioning.userRootPath,
        username: provisioning.username,
      },
      entityId: user.id,
      entityType: 'app_user',
      eventType: 'app_user_managed_library_root_provisioned',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'App user managed library root provisioned',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      provisioning,
      user,
    };
  }

  async function claimManagedLibraryRoot({ actorUserId, managedLibraryRelativeRoot, requestMetadata }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const user = await getAppUserById({ userId: normalizedActorUserId });

    if (!user) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    const requestedRelativeRoot = normalizeOptionalManagedLibraryRelativeRoot(managedLibraryRelativeRoot, {
      fieldName: 'managedLibraryRelativeRoot',
    });

    if (user.managedLibraryRelativeRoot) {
      if (requestedRelativeRoot && requestedRelativeRoot !== user.managedLibraryRelativeRoot) {
        throw createApiError(409, 'app_user_managed_library_root_already_claimed', 'The current user already owns a managed library subdirectory.');
      }

      return provisionManagedLibraryRoot({
        actorUserId: normalizedActorUserId,
        requestMetadata,
        userId: normalizedActorUserId,
      });
    }

    if (typeof updateAppUser !== 'function') {
      throw new TypeError('updateAppUser must be provided to claim managed library roots');
    }

    const claimedRelativeRoot = requestedRelativeRoot ?? buildDefaultManagedLibraryRelativeRoot({ user });
    const updatedUser = await updateAppUser({
      actorUserId: normalizedActorUserId,
      managedLibraryRelativeRoot: claimedRelativeRoot,
      requestMetadata,
      userId: normalizedActorUserId,
    });

    await recordAuditEventFn({
      actorUserId: normalizedActorUserId,
      actorType: 'user',
      details: {
        managedLibraryRelativeRoot: updatedUser.managedLibraryRelativeRoot,
        username: updatedUser.username,
      },
      entityId: updatedUser.id,
      entityType: 'app_user',
      eventType: 'app_user_managed_library_root_claimed',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'App user managed library root claimed',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return provisionManagedLibraryRoot({
      actorUserId: normalizedActorUserId,
      requestMetadata,
      userId: normalizedActorUserId,
    });
  }

  return {
    claimManagedLibraryRoot,
    provisionManagedLibraryRoot,
  };
}

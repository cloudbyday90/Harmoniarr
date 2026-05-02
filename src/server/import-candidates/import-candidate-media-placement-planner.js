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

import { posix as path } from 'node:path';
import {
  buildUserMusicRootPath,
  normalizeManagedLibraryRelativeRoot,
  normalizeUserMusicRoots,
  resolveUserMusicRoot,
} from '../paths/user-music-root-service.js';

function normalizePathSegment(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/').replaceAll('//', '/') : '';
}

function buildReusePolicy({ configuredPerUserRoot }) {
  return {
    alternateFormatPolicy: 'explicit_lossy_derivative_only',
    crossVolumeFallback: 'operator_visible_copy_required',
    duplicateLosslessPolicy: configuredPerUserRoot ? 'reuse_existing_lossless_by_default' : 'allow_canonical_primary_copy',
    sameVolumeLinkMode: 'prefer_hardlink',
  };
}

function collectConfiguredUserRootPaths({ appUsers = [], musicRoot, userMusicRoots = [] }) {
  const configuredRoots = [];

  for (const appUser of appUsers) {
    if (!appUser?.managedLibraryRelativeRoot) {
      continue;
    }

    const normalizedRelativeRoot = normalizeManagedLibraryRelativeRoot(appUser.managedLibraryRelativeRoot, {
      fieldName: 'appUser.managedLibraryRelativeRoot',
    });
    configuredRoots.push(buildUserMusicRootPath({
      musicRoot,
      relativeRoot: normalizedRelativeRoot,
    }));
  }

  const normalizedUserMusicRoots = normalizeUserMusicRoots(userMusicRoots, { fieldName: 'paths.userMusicRoots' });
  for (const rootEntry of normalizedUserMusicRoots) {
    configuredRoots.push(buildUserMusicRootPath({
      musicRoot,
      relativeRoot: rootEntry.relativeRoot,
    }));
  }

  return [...new Set(configuredRoots)];
}

export function createImportCandidateMediaPlacementPlanner() {
  function planCandidateLibraryPlacement({
    appUsers = [],
    musicRoot,
    relativeFolderPath,
    targetUser = null,
    userMusicRoots = [],
  }) {
    const normalizedRelativeFolderPath = normalizePathSegment(relativeFolderPath);
    const relativeSegments = normalizedRelativeFolderPath.split('/').filter(Boolean);
    const resolvedUserMusicRoot = resolveUserMusicRoot({
      appUsers,
      musicRoot,
      targetUser,
      userMusicRoots,
    });
    const configuredPerUserRoot = Boolean(resolvedUserMusicRoot?.configured);
    const libraryBaseSegments = configuredPerUserRoot
      ? [resolvedUserMusicRoot.userRootPath]
      : [musicRoot];
    const previewFolderPath = path.join(...[
      ...libraryBaseSegments,
      ...(relativeSegments.length ? relativeSegments : ['unmapped-candidate']),
    ]);
    const configuredUserRootPaths = collectConfiguredUserRootPaths({
      appUsers,
      musicRoot,
      userMusicRoots,
    });

    return {
      configuredUserRootPaths,
      previewFolderPath,
      reusePolicy: buildReusePolicy({ configuredPerUserRoot }),
      rootFolderPolicy: configuredPerUserRoot ? 'per_user_subdirectory' : 'single_root',
      targetUser: resolvedUserMusicRoot,
      userRootPath: configuredPerUserRoot ? resolvedUserMusicRoot.userRootPath : musicRoot,
    };
  }

  return {
    planCandidateLibraryPlacement,
  };
}
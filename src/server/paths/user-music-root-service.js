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

function buildValidationError(fieldName, message) {
  return new Error(`${fieldName} ${message}`);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function containsControlCharacters(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && codePoint <= 0x1F;
  });
}

function normalizeRelativeRoot(value, fieldName) {
  if (typeof value !== 'string') {
    throw buildValidationError(fieldName, 'must be a string');
  }

  const normalized = value
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '');

  if (!normalized) {
    throw buildValidationError(fieldName, 'must not be empty');
  }

  const segments = normalized.split('/');

  if (segments.some((segment) => segment.length === 0)) {
    throw buildValidationError(fieldName, 'must not contain empty path segments');
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw buildValidationError(fieldName, 'must not contain dot traversal segments');
  }

  if (segments.some((segment) => /[<>:"\\|?*]/.test(segment) || containsControlCharacters(segment))) {
    throw buildValidationError(fieldName, 'contains unsupported path characters');
  }

  return segments.join('/');
}

export function normalizeManagedLibraryRelativeRoot(value, { fieldName = 'managedLibraryRelativeRoot' } = {}) {
  return normalizeRelativeRoot(value, fieldName);
}

export function normalizeOptionalManagedLibraryRelativeRoot(value, { fieldName = 'managedLibraryRelativeRoot' } = {}) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw buildValidationError(fieldName, 'must be a string');
  }

  if (value.trim().length === 0) {
    return null;
  }

  return normalizeManagedLibraryRelativeRoot(value, { fieldName });
}

function findDuplicateValues(values) {
  const duplicates = new Set();
  const seen = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates].sort();
}

export function normalizeUserMusicRoots(value, { fieldName = 'paths.userMusicRoots' } = {}) {
  if (!Array.isArray(value)) {
    throw buildValidationError(fieldName, 'must be an array');
  }

  const normalizedEntries = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw buildValidationError(`${fieldName}[${index}]`, 'must be an object');
    }

    const userId = normalizeText(entry.userId);
    if (!userId) {
      throw buildValidationError(`${fieldName}[${index}].userId`, 'must be a non-empty string');
    }

    const relativeRoot = normalizeRelativeRoot(entry.relativeRoot, `${fieldName}[${index}].relativeRoot`);

    return {
      relativeRoot,
      userId,
    };
  });

  const duplicateUserIds = findDuplicateValues(normalizedEntries.map((entry) => entry.userId.toLowerCase()));
  if (duplicateUserIds.length > 0) {
    throw buildValidationError(fieldName, `contains duplicate userId values: ${duplicateUserIds.join(', ')}`);
  }

  const duplicateRoots = findDuplicateValues(normalizedEntries.map((entry) => entry.relativeRoot.toLowerCase()));
  if (duplicateRoots.length > 0) {
    throw buildValidationError(fieldName, `contains duplicate relativeRoot values: ${duplicateRoots.join(', ')}`);
  }

  return normalizedEntries;
}

export function buildUserMusicRootPath({ musicRoot, relativeRoot }) {
  const normalizedRelativeRoot = normalizeManagedLibraryRelativeRoot(relativeRoot, { fieldName: 'relativeRoot' });
  return path.join(musicRoot, 'users', ...normalizedRelativeRoot.split('/'));
}

export function normalizeTargetUserReference(targetUser) {
  if (!targetUser) {
    return null;
  }

  if (typeof targetUser === 'string') {
    const userId = normalizeText(targetUser);
    return userId ? { id: userId } : null;
  }

  if (typeof targetUser !== 'object' || Array.isArray(targetUser)) {
    return null;
  }

  const id = normalizeText(targetUser.id);
  if (!id) {
    return null;
  }

  return { id };
}

export function resolveUserMusicRoot({ appUsers = [], musicRoot, targetUser = null, userMusicRoots = [] }) {
  const normalizedTargetUser = normalizeTargetUserReference(targetUser);
  if (!normalizedTargetUser) {
    return null;
  }

  const normalizedTargetUserId = normalizedTargetUser.id.toLowerCase();
  const matchedAppUser = appUsers.find((entry) => normalizeText(entry?.id).toLowerCase() === normalizedTargetUserId) ?? null;
  const managedLibraryRelativeRoot = matchedAppUser?.managedLibraryRelativeRoot
    ? normalizeManagedLibraryRelativeRoot(matchedAppUser.managedLibraryRelativeRoot, {
      fieldName: 'appUser.managedLibraryRelativeRoot',
    })
    : null;

  if (managedLibraryRelativeRoot) {
    return {
      authProvider: matchedAppUser?.authProvider ?? 'local',
      configured: true,
      configuredBy: 'app_user',
      id: normalizedTargetUser.id,
      relativeRoot: managedLibraryRelativeRoot,
      userRootPath: buildUserMusicRootPath({
        musicRoot,
        relativeRoot: managedLibraryRelativeRoot,
      }),
    };
  }

  const normalizedUserMusicRoots = normalizeUserMusicRoots(userMusicRoots, { fieldName: 'paths.userMusicRoots' });
  const match = normalizedUserMusicRoots.find((entry) => entry.userId.toLowerCase() === normalizedTargetUserId) ?? null;

  if (!match) {
    return {
      authProvider: matchedAppUser?.authProvider ?? 'local',
      configured: false,
      configuredBy: null,
      id: normalizedTargetUser.id,
      relativeRoot: null,
      userRootPath: musicRoot,
    };
  }

  return {
    authProvider: matchedAppUser?.authProvider ?? 'local',
    configured: true,
    configuredBy: 'settings',
    id: normalizedTargetUser.id,
    relativeRoot: match.relativeRoot,
    userRootPath: buildUserMusicRootPath({
      musicRoot,
      relativeRoot: match.relativeRoot,
    }),
  };
}

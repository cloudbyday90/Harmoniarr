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

import { createApiError } from '../auth.js';

export const MISSING_MUSIC_ACCOUNT_STATUSES = Object.freeze([
  'active',
  'disabled',
  'all',
]);

export const MISSING_MUSIC_SCOPES = Object.freeze([
  'all',
  'mine',
]);

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredActorUserId(value) {
  const actorUserId = normalizeOptionalString(value);
  if (!actorUserId) {
    throw createApiError(401, 'session_required', 'An authenticated user is required');
  }

  return actorUserId;
}

export function normalizeMissingMusicAccountStatus(value) {
  const accountStatus = normalizeOptionalString(value) ?? 'active';
  if (!MISSING_MUSIC_ACCOUNT_STATUSES.includes(accountStatus)) {
    throw createApiError(400, 'validation_error', 'accountStatus must be active, disabled, or all');
  }

  return accountStatus;
}

export function resolveMissingMusicDecisionScope({
  actorUserId,
  actorUserRole = null,
  requestedForUserId = null,
  requestedScope = null,
} = {}) {
  const scopedActorUserId = normalizeRequiredActorUserId(actorUserId);
  const requestedTargetUserId = normalizeOptionalString(requestedForUserId);
  const isAdmin = actorUserRole === 'admin';
  const normalizedRequestedScope = normalizeOptionalString(requestedScope);

  if (normalizedRequestedScope && !MISSING_MUSIC_SCOPES.includes(normalizedRequestedScope)) {
    throw createApiError(400, 'validation_error', 'scope must be all or mine');
  }

  if (!isAdmin) {
    if (requestedTargetUserId && requestedTargetUserId !== scopedActorUserId) {
      throw createApiError(403, 'forbidden', 'The current user cannot view another user\'s Missing Music decisions');
    }

    return {
      isAdmin: false,
      requestedForUserId: scopedActorUserId,
      scope: 'mine',
    };
  }

  const scope = normalizedRequestedScope === 'mine' ? 'mine' : 'all';

  if (scope === 'mine') {
    if (requestedTargetUserId && requestedTargetUserId !== scopedActorUserId) {
      throw createApiError(400, 'validation_error', 'requestedForUserId must match the signed-in user when scope is mine');
    }

    return {
      isAdmin: true,
      requestedForUserId: scopedActorUserId,
      scope,
    };
  }

  return {
    isAdmin: true,
    requestedForUserId: requestedTargetUserId,
    scope,
  };
}

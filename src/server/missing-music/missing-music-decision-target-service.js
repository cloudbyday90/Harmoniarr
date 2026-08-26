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
import { resolveMissingMusicDecisionScope } from './missing-music-decision-scope-policy.js';

export const MAX_MISSING_MUSIC_DECISION_ID_LENGTH = 200;

export function normalizeMissingMusicDecisionId(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'decisionId must be text');
  }

  const decisionId = value.trim();
  if (decisionId.length === 0 || decisionId.length > MAX_MISSING_MUSIC_DECISION_ID_LENGTH) {
    throw createApiError(
      400,
      'validation_error',
      `decisionId must be between 1 and ${MAX_MISSING_MUSIC_DECISION_ID_LENGTH} characters`,
    );
  }

  return decisionId;
}

function buildTargetUser(user) {
  return {
    accountStatus: user?.isDisabled === true ? 'disabled' : 'active',
    id: user?.id ?? null,
    isDisabled: user?.isDisabled === true,
    username: user?.username ?? null,
  };
}

function validateDependencies({ listAppUsers, listWantedReleasesWithMetadata }) {
  if (typeof listAppUsers !== 'function') {
    throw new TypeError('createMissingMusicDecisionTargetService requires listAppUsers');
  }

  if (typeof listWantedReleasesWithMetadata !== 'function') {
    throw new TypeError('createMissingMusicDecisionTargetService requires listWantedReleasesWithMetadata');
  }
}

/**
 * Resolves a wanted release and its target household account from an
 * authenticated actor. The client never provides the target account as an
 * authorization assertion, and callers receive the same not-found response
 * for an unavailable or out-of-scope release.
 */
export function createMissingMusicDecisionTargetService({
  listAppUsers,
  listWantedReleasesWithMetadata,
} = {}) {
  validateDependencies({ listAppUsers, listWantedReleasesWithMetadata });

  async function resolveMissingMusicDecisionTarget({ actorUser, decisionId } = {}) {
    const normalizedDecisionId = normalizeMissingMusicDecisionId(decisionId);
    const scope = resolveMissingMusicDecisionScope({
      actorUserId: actorUser?.id,
      actorUserRole: actorUser?.role ?? null,
    });

    let usersById;
    let eligibleUsers;

    if (scope.isAdmin && scope.scope === 'all') {
      const allUsers = await listAppUsers();
      usersById = new Map(allUsers.map((user) => [user.id, user]));
      eligibleUsers = allUsers;
    } else {
      const currentUser = {
        id: scope.requestedForUserId,
        isDisabled: actorUser?.isDisabled === true,
        username: actorUser?.username ?? null,
      };
      usersById = new Map([[currentUser.id, currentUser]]);
      eligibleUsers = [currentUser];
    }

    const targetUserIds = eligibleUsers
      .map((user) => user.id)
      .filter((userId) => typeof userId === 'string' && userId.length > 0);
    const sourceReleases = targetUserIds.length > 0
      ? await listWantedReleasesWithMetadata({
        appUserIds: targetUserIds,
        limit: 1,
        search: null,
        wantedReleaseId: normalizedDecisionId,
        wantedStatus: null,
      })
      : [];
    const release = sourceReleases.find((sourceRelease) => sourceRelease.id === normalizedDecisionId);

    if (!release) {
      throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
    }

    const targetUser = usersById.get(release.appUserId);
    if (!targetUser) {
      throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
    }

    return {
      decisionId: normalizedDecisionId,
      release,
      scope: scope.scope,
      targetUser: buildTargetUser(targetUser),
    };
  }

  return {
    resolveMissingMusicDecisionTarget,
  };
}

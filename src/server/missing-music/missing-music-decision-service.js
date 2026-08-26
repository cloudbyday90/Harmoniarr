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
import { projectMusicQueueRelease } from '../acquisition/acquisition-pipeline-service.js';
import {
  normalizeMissingMusicAccountStatus,
  resolveMissingMusicDecisionScope,
} from './missing-music-decision-scope-policy.js';
import { buildMissingMusicMatchChoices } from './missing-music-match-choice-projection.js';
import { createMissingMusicDecisionTargetService } from './missing-music-decision-target-service.js';
import {
  deriveMissingMusicDecisionState,
  normalizeMissingMusicDecisionState,
} from './missing-music-decision-state.js';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const MAX_QUERY_LENGTH = 120;
const MAX_SOURCE_RELEASES = 2000;

function normalizePageLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_PAGE_LIMIT), 10);
  return Math.min(Math.max(Number.isInteger(parsed) ? parsed : DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
}

function normalizePageOffset(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeSearchQuery(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'q must be text');
  }

  const query = value.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    throw createApiError(400, 'validation_error', `q must be ${MAX_QUERY_LENGTH} characters or fewer`);
  }

  return query || null;
}

function buildRequestedFor(user) {
  return {
    accountStatus: user?.isDisabled === true ? 'disabled' : 'active',
    id: user?.id ?? null,
    username: user?.username ?? null,
  };
}

function projectMissingMusicStatus(status) {
  const nextAction = status?.nextAction ?? null;

  if (nextAction === 'download_now') {
    return {
      code: 'match_selected',
      label: 'Match selected',
      message: 'A match has been selected. A download will not start until someone explicitly starts it.',
      nextAction,
      tone: 'warning',
    };
  }

  return {
    code: status?.code ?? 'unknown',
    label: status?.label ?? 'Waiting for an update',
    message: status?.message ?? 'Harmoniarr is updating the release state.',
    nextAction,
    tone: status?.tone ?? 'neutral',
  };
}

function projectDecision(release, requestedFor, projectMusicQueueReleaseFn) {
  const projectedRelease = projectMusicQueueReleaseFn(release);
  const status = projectMissingMusicStatus(projectedRelease.status);

  return {
    decisionId: projectedRelease.id,
    expectedTrackCount: projectedRelease.expectedTrackCount,
    lastReconciledAt: projectedRelease.lastReconciledAt,
    matchedTrackCount: projectedRelease.matchedTrackCount,
    missingTrackCount: projectedRelease.missingTrackCount,
    release: {
      artistName: projectedRelease.artistName,
      id: projectedRelease.metadataReleaseId,
      releaseDate: projectedRelease.releaseDate,
      releaseGroupTitle: projectedRelease.releaseGroupTitle,
      releaseGroupType: projectedRelease.releaseGroupType,
      title: projectedRelease.releaseTitle,
      wantedStatus: projectedRelease.wantedStatus,
    },
    requestedFor,
    state: deriveMissingMusicDecisionState(status.code, status.nextAction),
    status,
  };
}

function matchesAccountStatus(user, accountStatus) {
  if (accountStatus === 'all') {
    return true;
  }

  return accountStatus === 'disabled' ? user?.isDisabled === true : user?.isDisabled !== true;
}

function buildAvailableUserOption(user) {
  return {
    accountStatus: user.isDisabled === true ? 'disabled' : 'active',
    id: user.id,
    username: user.username,
  };
}

function validateDependencies({
  listAppUsers,
  listWantedReleasesWithMetadata,
  projectMusicQueueReleaseFn,
  resolveMissingMusicDecisionTarget,
}) {
  if (typeof listAppUsers !== 'function') {
    throw new TypeError('createMissingMusicDecisionService requires listAppUsers');
  }

  if (typeof listWantedReleasesWithMetadata !== 'function') {
    throw new TypeError('createMissingMusicDecisionService requires listWantedReleasesWithMetadata');
  }

  if (typeof projectMusicQueueReleaseFn !== 'function') {
    throw new TypeError('createMissingMusicDecisionService requires projectMusicQueueReleaseFn');
  }

  if (resolveMissingMusicDecisionTarget !== null && typeof resolveMissingMusicDecisionTarget !== 'function') {
    throw new TypeError('createMissingMusicDecisionService resolveMissingMusicDecisionTarget must be a function');
  }
}

export function createMissingMusicDecisionService({
  listAppUsers,
  listWantedReleasesWithMetadata,
  now = () => new Date(),
  projectMusicQueueReleaseFn = projectMusicQueueRelease,
  resolveMissingMusicDecisionTarget = null,
} = {}) {
  validateDependencies({
    listAppUsers,
    listWantedReleasesWithMetadata,
    projectMusicQueueReleaseFn,
    resolveMissingMusicDecisionTarget,
  });
  const resolveDecisionTarget = resolveMissingMusicDecisionTarget
    ?? createMissingMusicDecisionTargetService({
      listAppUsers,
      listWantedReleasesWithMetadata,
    }).resolveMissingMusicDecisionTarget;

  async function listMissingMusicDecisions({
    accountStatus: requestedAccountStatus = null,
    actorUser,
    limit = DEFAULT_PAGE_LIMIT,
    offset = 0,
    q = null,
    requestedForUserId = null,
    scope: requestedScope = null,
    state: requestedState = null,
  } = {}) {
    const actorUserId = actorUser?.id;
    const scope = resolveMissingMusicDecisionScope({
      actorUserId,
      actorUserRole: actorUser?.role ?? null,
      requestedForUserId,
      requestedScope,
    });
    const accountStatus = normalizeMissingMusicAccountStatus(requestedAccountStatus);
    const state = normalizeMissingMusicDecisionState(requestedState);
    const search = normalizeSearchQuery(q);
    const pageLimit = normalizePageLimit(limit);
    const pageOffset = normalizePageOffset(offset);

    let usersById;
    let eligibleUsers;
    let availableUsers = [];

    if (scope.isAdmin && scope.scope === 'all') {
      const allUsers = await listAppUsers();
      usersById = new Map(allUsers.map((user) => [user.id, user]));

      if (scope.requestedForUserId && !usersById.has(scope.requestedForUserId)) {
        throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
      }

      eligibleUsers = allUsers
        .filter((user) => matchesAccountStatus(user, accountStatus))
        .filter((user) => !scope.requestedForUserId || user.id === scope.requestedForUserId);
      availableUsers = allUsers
        .filter((user) => matchesAccountStatus(user, accountStatus))
        .map(buildAvailableUserOption);
    } else {
      const currentUser = {
        id: scope.requestedForUserId,
        isDisabled: actorUser?.isDisabled === true,
        username: actorUser?.username ?? null,
      };
      usersById = new Map([[currentUser.id, currentUser]]);
      eligibleUsers = matchesAccountStatus(currentUser, accountStatus) ? [currentUser] : [];
    }

    const targetUserIds = eligibleUsers.map((user) => user.id);
    if (targetUserIds.length === 0) {
      return {
        checkedAt: now().toISOString(),
        decisions: [],
        filters: {
          accountStatus,
          q: search,
          requestedForUserId: scope.requestedForUserId,
          state,
        },
        page: {
          limit: pageLimit,
          offset: pageOffset,
          sourceLimitReached: false,
          total: 0,
        },
        scope: scope.scope,
        users: availableUsers,
      };
    }

    const sourceReleases = await listWantedReleasesWithMetadata({
      appUserIds: targetUserIds,
      limit: MAX_SOURCE_RELEASES,
      search,
      wantedStatus: null,
    });
    const sourceLimitReached = sourceReleases.length >= MAX_SOURCE_RELEASES;
    const decisions = sourceReleases
      .map((release) => projectDecision(
        release,
        buildRequestedFor(usersById.get(release.appUserId)),
        projectMusicQueueReleaseFn,
      ))
      .filter((decision) => state === 'all' || decision.state === state);
    const page = decisions.slice(pageOffset, pageOffset + pageLimit);

    return {
      checkedAt: now().toISOString(),
      decisions: page,
      filters: {
        accountStatus,
        q: search,
        requestedForUserId: scope.requestedForUserId,
        state,
      },
      page: {
        limit: pageLimit,
        offset: pageOffset,
        sourceLimitReached,
        total: decisions.length,
      },
      scope: scope.scope,
      users: availableUsers,
    };
  }

  /**
   * Resolves one release through the same server-side household scope as the
   * worklist. The browser never supplies the target account as authority, and
   * this read projection intentionally excludes provider, transfer, and raw
   * candidate evidence beyond its safe decision facts.
   */
  async function getMissingMusicDecisionDetail({
    actorUser,
    decisionId,
  } = {}) {
    const target = await resolveDecisionTarget({ actorUser, decisionId });
    const decision = projectDecision(
      target.release,
      target.targetUser,
      projectMusicQueueReleaseFn,
    );
    const matchChoices = decision.status.nextAction === 'review_matches'
      ? buildMissingMusicMatchChoices(target.release)
      : [];

    return {
      checkedAt: now().toISOString(),
      decision,
      matchChoices,
      permissions: {
        canSelectMatch: target.targetUser.accountStatus !== 'disabled' && matchChoices.length > 0,
        isReadOnly: target.targetUser.accountStatus === 'disabled',
      },
      scope: target.scope,
    };
  }

  return {
    getMissingMusicDecisionDetail,
    listMissingMusicDecisions,
  };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';

/** Different fact/lock projections retain the same canonical current authority. */
export function createQualityReviewScopeGuard({ readScope, recheckStore, lockFailedCandidate,
  assertMaintenanceWriteAllowed, withTransaction, lockAppUserEligibilityFn, lockRunCreation,
  readSelectedCandidate = null, isEligible = null } = {}) {
  return async function withCurrentScope({ actorUserId, appUserId, wantedReleaseId, importCandidateId = null }, execute) {
    const unavailable = () => createApiError(409, 'missing_music_match_changed', 'Available matches have changed. Refresh this release before continuing.');
    if (importCandidateId && !readSelectedCandidate) throw unavailable();
    const input = { appUserId, wantedReleaseId };
    const prepared = await readScope(input);
    if (!prepared) throw unavailable();
    if (importCandidateId && !isEligible(await readSelectedCandidate(importCandidateId), prepared)) throw unavailable();
    return withTransaction(async queryable => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAppUserEligibilityFn({ userIds: [actorUserId, ...prepared.participants.map(p => p.appUserId)], queryable });
      await recheckStore.lockParticipantReleases({ wantedReleaseIds: prepared.wantedReleaseIds, queryable });
      await lockRunCreation({ queryable });
      await lockFailedCandidate({ importCandidateId: prepared.failedCandidate.id, queryable });
      if (importCandidateId) await recheckStore.lockCandidate({ importCandidateId, queryable });
      const actor = await recheckStore.readSelectionActor({ appUserId: actorUserId, queryable });
      if (!actor || actor.isDisabled || (actor.id !== appUserId && actor.role !== 'admin')) throw unavailable();
      const scope = await readScope({ ...input, queryable });
      if (!scope || scope.failedCandidate.id !== prepared.failedCandidate.id
        || JSON.stringify(scope.wantedReleaseIds) !== JSON.stringify(prepared.wantedReleaseIds)
        || scope.participants.some(p => !prepared.participants.some(before => before.appUserId === p.appUserId))) throw unavailable();
      return execute({ scope, queryable });
    });
  };
}

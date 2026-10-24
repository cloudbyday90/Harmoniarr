/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { buildPublicLibraryAddReview, isMeasuredQualityReview } from '../acquisition/acquisition-library-add-recheck-policy.js';
import { evaluateQualityEvidence } from '../acquisition/acquisition-quality-policy-service.js';
import { lockImportCandidateApplyCreation } from './import-candidate-apply-queue-store.js';
import { hasCurrentSafeAddParticipants } from './import-candidate-release-safe-add-preparation-service.js';
import { buildRecheckQualityContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { canRetainRecoveryQualityContext } from './import-candidate-recovery-quality-policy.js';
import { OPERATOR_TRACK_SCOPE_BLOCKER } from '../metadata/operator-track-scope-policy.js';

/** Replacement selection preserves the failed acquisition and its shared quality floor. */
export function createImportCandidateQualityReviewScopeService({ recheckStore, getImportCandidate,
  assertMaintenanceWriteAllowed, withTransaction = createDatabaseTransactionRunner(),
  lockAppUserEligibilityFn = lockAppUserEligibility, lockRunCreation = lockImportCandidateApplyCreation,
} = {}) {
  for (const [name, value] of Object.entries({ getImportCandidate, assertMaintenanceWriteAllowed,
    withTransaction, lockAppUserEligibilityFn, lockRunCreation, readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies, readSelectionActor: recheckStore?.readSelectionActor,
    lockCandidate: recheckStore?.lockCandidate, listQualityReviewCandidateIds: recheckStore?.listQualityReviewCandidateIds,
    lockParticipantReleases: recheckStore?.lockParticipantReleases })) {
    if (typeof value !== 'function') throw new TypeError(`Quality-review selection requires ${name}`);
  }

  async function readCandidate(importCandidateId, queryable) {
    try { return await getImportCandidate({ importCandidateId, ...(queryable ? { queryable } : {}) }); }
    catch (error) { if (error.code === 'import_candidate_not_found') return null; throw error; }
  }

  async function readScope({ appUserId, wantedReleaseId, queryable = null }) {
    const release = await recheckStore.readOwnedRelease({ appUserId, wantedReleaseId, queryable });
    const facts = release?.libraryAddRecoveryFacts;
    if (!release || release.targetUser.isDisabled || !isMeasuredQualityReview(facts)
      || !buildPublicLibraryAddReview(facts) || facts.activeRunId) return null;
    const failedCandidate = await readCandidate(facts.candidateId, queryable);
    if (failedCandidate?.status !== 'failed') return null;
    const wantedReleaseIds = getRecheckWantedReleaseIds(failedCandidate);
    if (!wantedReleaseIds.includes(wantedReleaseId)) return null;
    const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds, queryable });
    if (!hasCurrentSafeAddParticipants(participants, wantedReleaseIds)
      || participants.some(p => p.metadataReleaseId !== release.metadataReleaseId)) return null;
    let requiredContext;
    try { requiredContext = await buildRecheckQualityContext({ candidate: failedCandidate, participants, queryable }); }
    catch (error) { if (error.code === OPERATOR_TRACK_SCOPE_BLOCKER) return null; throw error; }
    return { failedCandidate, participants, requiredContext, wantedReleaseIds, release };
  }

  function isEligible(candidate, scope) {
    return Boolean(candidate && ['pending', 'held'].includes(candidate.status)
      && candidate.id !== scope.failedCandidate.id && candidate.sourceSearchId === scope.failedCandidate.sourceSearchId
      && JSON.stringify(getRecheckWantedReleaseIds(candidate)) === JSON.stringify(scope.wantedReleaseIds)
      && canRetainRecoveryQualityContext({ candidate, failedCandidate: scope.failedCandidate, requiredContext: scope.requiredContext })
      && evaluateQualityEvidence({ candidate, ...scope.requiredContext }).autoDownloadEligible);
  }

  async function listQualityReviewMatchIds({ appUserId, wantedReleaseId, matchIds = [] }) {
    const scope = await readScope({ appUserId, wantedReleaseId });
    if (!scope) return [];
    const eligible = [];
    for (const matchId of [...new Set(matchIds)].slice(0, 12)) {
      if (isEligible(await readCandidate(matchId), scope)) eligible.push(matchId);
    }
    return eligible;
  }

  async function hasEligibleAlternative(scope, { queryable = null } = {}) {
    let afterId = null;
    for (;;) {
      const ids = await recheckStore.listQualityReviewCandidateIds({ sourceSearchId: scope.failedCandidate.sourceSearchId, afterId, queryable });
      for (const id of ids) if (isEligible(await readCandidate(id, queryable), scope)) return true;
      if (ids.length < 50) return false;
      afterId = ids.at(-1);
    }
  }
  async function canSearchAgainAfterQualityReview(input) {
    const scope = await readScope(input);
    return Boolean(scope && !await hasEligibleAlternative(scope));
  }

  async function withCurrentScope({ actorUserId, appUserId, wantedReleaseId, importCandidateId = null }, execute) {
    const input = { appUserId, wantedReleaseId };
    const prepared = await readScope(input);
    const unavailable = () => createApiError(409, 'missing_music_match_changed', 'Available matches have changed. Refresh this release before continuing.');
    if (!prepared) throw unavailable();
    return withTransaction(async queryable => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAppUserEligibilityFn({ userIds: [actorUserId, ...prepared.participants.map(p => p.appUserId)], queryable });
      await recheckStore.lockParticipantReleases({ wantedReleaseIds: prepared.wantedReleaseIds, queryable });
      await lockRunCreation({ queryable });
      await recheckStore.lockCandidate({ importCandidateId: prepared.failedCandidate.id, queryable });
      if (importCandidateId) await recheckStore.lockCandidate({ importCandidateId, queryable });
      const actor = await recheckStore.readSelectionActor({ appUserId: actorUserId, queryable });
      if (!actor || actor.isDisabled || (actor.id !== appUserId && actor.role !== 'admin')) throw unavailable();
      const scope = await readScope({ ...input, queryable });
      if (!scope || scope.failedCandidate.id !== prepared.failedCandidate.id
        || JSON.stringify(scope.wantedReleaseIds) !== JSON.stringify(prepared.wantedReleaseIds)
        || scope.participants.some(p => !prepared.participants.some(before => before.appUserId === p.appUserId))) throw unavailable();
      return execute({ scope, queryable });
    });
  }
  return { readCandidate, readScope, isEligible, listQualityReviewMatchIds, hasEligibleAlternative,
    canSearchAgainAfterQualityReview, withCurrentScope };
}

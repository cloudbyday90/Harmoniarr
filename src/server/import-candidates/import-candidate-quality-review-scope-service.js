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
import { createImportCandidateQualityReviewCandidateStore, QUALITY_REVIEW_CANDIDATE_PAGE_SIZE } from './import-candidate-quality-review-candidate-store.js';
import { createQualityReviewCursorPolicy, qualityReviewCursorContext, qualityReviewCursorChanged,
  QUALITY_REVIEW_MATCH_PAGE_SIZE } from './import-candidate-quality-review-cursor-policy.js';

/** Replacement selection preserves the failed acquisition and its shared quality floor. */
export function createImportCandidateQualityReviewScopeService({ recheckStore, getImportCandidate,
  candidateStore = createImportCandidateQualityReviewCandidateStore(),
  cursorPolicy = createQualityReviewCursorPolicy(),
  assertMaintenanceWriteAllowed, withTransaction = createDatabaseTransactionRunner(),
  lockAppUserEligibilityFn = lockAppUserEligibility, lockRunCreation = lockImportCandidateApplyCreation,
} = {}) {
  for (const [name, value] of Object.entries({ getImportCandidate, assertMaintenanceWriteAllowed,
    withTransaction, lockAppUserEligibilityFn, lockRunCreation, readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies, readSelectionActor: recheckStore?.readSelectionActor,
    lockCandidate: recheckStore?.lockCandidate, listCandidatePage: candidateStore?.listCandidatePage,
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

  async function collectEligibleAlternatives(scope, { queryable = null, limit, anchor = null, direction = 'next' }) {
    let afterId = anchor;
    const eligible = [];
    for (;;) {
      const page = await candidateStore.listCandidatePage({ sourceSearchId: scope.failedCandidate.sourceSearchId, afterId, direction, queryable });
      for (const candidate of page) {
        if (isEligible(candidate, scope)) eligible.push(candidate);
        if (eligible.length === limit) return eligible;
      }
      if (page.length < QUALITY_REVIEW_CANDIDATE_PAGE_SIZE) return eligible;
      afterId = page.at(-1).id;
    }
  }
  async function getQualityReviewAlternatives(input) {
    const scope = await readScope(input);
    if (!scope) {
      if (input.matchCursor != null) throw qualityReviewCursorChanged();
      return { candidates: [], canSearchAgain: false };
    }
    const context = qualityReviewCursorContext(input, scope);
    const { anchor, direction } = cursorPolicy.decode(input.matchCursor, context);
    const found = await collectEligibleAlternatives(scope, { limit: QUALITY_REVIEW_MATCH_PAGE_SIZE + 1, anchor, direction });
    if (!found.length && anchor) throw qualityReviewCursorChanged();
    const hasMore = found.length > QUALITY_REVIEW_MATCH_PAGE_SIZE;
    const candidates = found.slice(0, QUALITY_REVIEW_MATCH_PAGE_SIZE);
    if (direction === 'previous') candidates.reverse();
    const encode = (row, nextDirection) => cursorPolicy.encode({ anchor: row.id, direction: nextDirection, context });
    return { candidates, canSearchAgain: !anchor && candidates.length === 0,
      ...(candidates.length ? { matchChoicePage: {
        previousCursor: (direction === 'previous' ? hasMore : Boolean(anchor)) ? encode(candidates[0], 'previous') : null,
        nextCursor: (direction === 'previous' ? Boolean(anchor) : hasMore) ? encode(candidates.at(-1), 'next') : null,
      } } : {}),
    };
  }
  async function hasEligibleAlternative(scope, { queryable = null } = {}) {
    return (await collectEligibleAlternatives(scope, { queryable, limit: 1 })).length > 0;
  }

  async function withCurrentScope({ actorUserId, appUserId, wantedReleaseId, importCandidateId = null }, execute) {
    const input = { appUserId, wantedReleaseId };
    const prepared = await readScope(input);
    const unavailable = () => createApiError(409, 'missing_music_match_changed', 'Available matches have changed. Refresh this release before continuing.');
    if (!prepared) throw unavailable();
    if (importCandidateId && !isEligible(await readCandidate(importCandidateId), prepared)) throw unavailable();
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
  return { readCandidate, readScope, isEligible, getQualityReviewAlternatives, hasEligibleAlternative, withCurrentScope };
}

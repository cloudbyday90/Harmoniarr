/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildPublicLibraryAddReview, isMeasuredQualityReview } from '../acquisition/acquisition-library-add-recheck-policy.js';
import { hasCurrentSafeAddParticipants } from './import-candidate-release-safe-add-preparation-service.js';
import { buildRecheckQualityContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { OPERATOR_TRACK_SCOPE_BLOCKER } from '../metadata/operator-track-scope-policy.js';

/** Full selection and narrow qualification share one current-policy calculation. */
export function createQualityReviewScopeReader({ recheckStore, readFailedCandidate, readOwnedReview = recheckStore.readOwnedRelease }) {
  return async function readScope({ appUserId, wantedReleaseId, queryable = null }) {
    const release = await readOwnedReview({ appUserId, wantedReleaseId, queryable });
    const facts = release?.libraryAddRecoveryFacts;
    if (!release || release.targetUser.isDisabled || !isMeasuredQualityReview(facts)
      || !buildPublicLibraryAddReview(facts) || facts.activeRunId) return null;
    const failedCandidate = await readFailedCandidate(facts.candidateId, queryable);
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
  };
}

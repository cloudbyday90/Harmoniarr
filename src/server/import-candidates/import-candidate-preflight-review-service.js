/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { deriveImportCandidateAddRecoveryReasonCode } from './import-candidate-add-blocker.js';

/** The prepared-add guard owns current authority and the publication transaction. */
export function createImportCandidatePreflightReviewService({ markImportCandidateImportBlocked } = {}) {
  if (typeof markImportCandidateImportBlocked !== 'function') throw new TypeError('Preflight review requires the candidate transition owner');
  async function recordPreparedLibraryAddReview({ prepared, queryable, requestMetadata = null }) {
    if (prepared?.qualityGate?.eligible !== false || !Array.isArray(prepared.qualityGate.blockers)
      || !prepared.qualityGate.blockers.length) return { outcome: 'not_available' };
    if (typeof queryable?.query !== 'function') throw new TypeError('Preflight review requires the owning transaction');
    const recoveryReasonCode = deriveImportCandidateAddRecoveryReasonCode({ addBlockerCode: 'media_verification', qualityGate: prepared.qualityGate });
    await markImportCandidateImportBlocked({ importCandidateId: prepared.candidate.id, addBlockerCode: 'media_verification',
      recoveryReasonCode, reason: 'Downloaded audio did not pass the initial library-add quality check', requestMetadata, queryable });
    return { outcome: 'review_recorded', recoveryReasonCode };
  }
  return { recordPreparedLibraryAddReview };
}

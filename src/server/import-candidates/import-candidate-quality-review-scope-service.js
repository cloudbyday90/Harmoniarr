/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { evaluateQualityEvidence } from '../acquisition/acquisition-quality-policy-service.js';
import { lockImportCandidateApplyCreation } from './import-candidate-apply-queue-store.js';
import { getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { canRetainRecoveryQualityContext } from './import-candidate-recovery-quality-policy.js';
import { createImportCandidateQualityReviewCandidateStore } from './import-candidate-quality-review-candidate-store.js';
import { createQualityReviewCursorPolicy } from './import-candidate-quality-review-cursor-policy.js';
import { createQualityReviewScanService } from './import-candidate-quality-review-scan-service.js';
import { createQualityReviewPageService } from './import-candidate-quality-review-page-service.js';
import { createImportCandidateSearchRevisionStore } from './import-candidate-search-revision-store.js';
import { createQualityReviewSearchRunStore } from './quality-review-search-run-store.js';
import { createQualityReviewFailedCandidateStore } from './quality-review-failed-candidate-store.js';
import { createQualityReviewScopeReader } from './quality-review-scope-reader.js';
import { createQualityReviewScopeGuard } from './quality-review-scope-guard.js';

/** Replacement selection preserves the failed acquisition and its shared quality floor. */
export function createImportCandidateQualityReviewScopeService({ recheckStore, getImportCandidate,
  candidateStore = createImportCandidateQualityReviewCandidateStore(),
  cursorPolicy = createQualityReviewCursorPolicy(),
  revisionStore = createImportCandidateSearchRevisionStore(),
  searchRunStore = createQualityReviewSearchRunStore(),
  failedCandidateStore = createQualityReviewFailedCandidateStore(),
  assertMaintenanceWriteAllowed, withTransaction = createDatabaseTransactionRunner(),
  lockAppUserEligibilityFn = lockAppUserEligibility, lockRunCreation = lockImportCandidateApplyCreation,
} = {}) {
  for (const [name, value] of Object.entries({ getImportCandidate, assertMaintenanceWriteAllowed,
    withTransaction, lockAppUserEligibilityFn, lockRunCreation, readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies, readSelectionActor: recheckStore?.readSelectionActor,
    readRevision: revisionStore?.readRevision,
    readFailedCandidateFacts: failedCandidateStore?.readFacts, lockFailedCandidate: failedCandidateStore?.lockFailedCandidate,
    readOwnedReview: failedCandidateStore?.readOwnedReview,
    lockCandidate: recheckStore?.lockCandidate, listCandidatePage: candidateStore?.listCandidatePage,
    lockParticipantReleases: recheckStore?.lockParticipantReleases })) {
    if (typeof value !== 'function') throw new TypeError(`Quality-review selection requires ${name}`);
  }

  async function readCandidate(importCandidateId, queryable) {
    try { return await getImportCandidate({ importCandidateId, ...(queryable ? { queryable } : {}) }); }
    catch (error) { if (error.code === 'import_candidate_not_found') return null; throw error; }
  }

  const readScope = createQualityReviewScopeReader({ recheckStore, readFailedCandidate: readCandidate });
  const readQualificationScope = createQualityReviewScopeReader({ recheckStore,
    readOwnedReview: failedCandidateStore.readOwnedReview,
    readFailedCandidate: (importCandidateId, queryable) => failedCandidateStore.readFacts({ importCandidateId, queryable }) });

  function isEligible(candidate, scope) {
    return Boolean(candidate && ['pending', 'held'].includes(candidate.status)
      && candidate.id !== scope.failedCandidate.id && candidate.sourceSearchId === scope.failedCandidate.sourceSearchId
      && JSON.stringify(getRecheckWantedReleaseIds(candidate)) === JSON.stringify(scope.wantedReleaseIds)
      && canRetainRecoveryQualityContext({ candidate, failedCandidate: scope.failedCandidate, requiredContext: scope.requiredContext })
      && evaluateQualityEvidence({ candidate, ...scope.requiredContext }).autoDownloadEligible);
  }

  const scanCandidates = createQualityReviewScanService({ candidateStore, isEligible });
  const getQualityReviewAlternatives = createQualityReviewPageService({ readScope, scanCandidates, cursorPolicy, revisionStore, searchRunStore });
  const scanAlternativeWindow = (scope, { queryable, anchor = null } = {}) => scanCandidates(scope, { queryable, anchor, limit: 1, lockRows: false });

  const guardDependencies = { recheckStore, assertMaintenanceWriteAllowed, withTransaction, lockAppUserEligibilityFn, lockRunCreation };
  const withCurrentScope = createQualityReviewScopeGuard({ ...guardDependencies, readScope,
    lockFailedCandidate: recheckStore.lockCandidate, readSelectedCandidate: readCandidate, isEligible });
  const withCurrentQualificationScope = createQualityReviewScopeGuard({ ...guardDependencies, readScope: readQualificationScope,
    lockFailedCandidate: failedCandidateStore.lockFailedCandidate });
  return { readCandidate, readScope, readQualificationScope, isEligible, getQualityReviewAlternatives,
    scanAlternativeWindow, withCurrentScope, withCurrentQualificationScope };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { canRecheckLibraryAdd, getLibraryAddRecheckReason, hasQueuedLibraryAddRecheck } from '../acquisition/acquisition-library-add-recheck-policy.js';
import { createImportCandidateReleaseSafeAddPreparationService } from './import-candidate-release-safe-add-preparation-service.js';
import { createImportCandidateReleaseSafeAddPolicyService } from './import-candidate-release-safe-add-policy-service.js';

/** Prepare expensive media/file evidence outside locks; acceptance belongs to the guarded transaction. */
export function createImportCandidateReleaseSafeAddRecheckService({ recheckStore, getImportCandidate, listFileDecisions,
  getMediaToolingStatus, previewImportCandidateApply, safeAutoAddQualityGateService, commitPreparedReleaseRecheck,
} = {}) {
  for (const [name, dependency] of Object.entries({ readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies, getImportCandidate, listFileDecisions,
    getMediaToolingStatus, previewImportCandidateApply, commitPreparedReleaseRecheck,
    evaluateSafeAutoAddQuality: safeAutoAddQualityGateService?.evaluateSafeAutoAddQuality })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseSafeAddRecheckService requires ${name}`);
  }
  const preparationService = createImportCandidateReleaseSafeAddPreparationService({ recheckStore, listFileDecisions,
    previewImportCandidateApply, safeAutoAddQualityGateService });
  const policyService = createImportCandidateReleaseSafeAddPolicyService({ recheckStore, getImportCandidate });
  async function recheckReleaseSafeAdd({ actorUserId = null, appUserId, requestMetadata = null, wantedReleaseId } = {}) {
    const release = await recheckStore.readOwnedRelease({ appUserId, wantedReleaseId });
    if (!release) return { outcome: 'not_available' };
    if (release.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    const facts = release.libraryAddRecoveryFacts;
    const queued = hasQueuedLibraryAddRecheck(facts);
    if (!queued && !canRecheckLibraryAdd({ release, targetUser: release.targetUser })) {
      return { outcome: facts?.activeRunId && facts.candidateStatus === 'import_pending' ? 'deferred' : 'not_available' };
    }
    const candidate = await getImportCandidate({ importCandidateId: facts.candidateId });
    const prepared = await preparationService.readPreparedScope({ candidate, release, wantedReleaseId });
    if (!prepared) return { outcome: 'not_available' };
    prepared.stop = { addBlockerCode: facts.addBlockerCode, recoveryReasonCode: facts.recoveryReasonCode };
    if (queued) return commitPreparedReleaseRecheck({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
    if (facts.activeRunId) return { outcome: 'deferred' };
    if (getLibraryAddRecheckReason(facts) === 'audio_check_failed' && (await getMediaToolingStatus())?.status !== 'healthy') {
      return { outcome: 'prerequisite_not_ready' };
    }
    if (!await preparationService.verifyPreparedFiles({ prepared, wantedReleaseId, marker: 'recheckRequestedForWantedReleaseId' })) {
      return { outcome: 'still_needs_review' };
    }
    return commitPreparedReleaseRecheck({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
  }
  return { recheckReleaseSafeAdd, resolveCurrentQueuedRecheckCandidate: policyService.resolveCurrentQueuedSafeAddCandidate,
    assertQueuedRecheckCandidateCurrent: policyService.assertQueuedSafeAddCandidateCurrent };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { hasQueuedGuardedLibraryAdd, isPreparedReleaseLibraryAddEligible } from '../acquisition/acquisition-library-add-policy.js';
import { createImportCandidateReleaseSafeAddPreparationService } from './import-candidate-release-safe-add-preparation-service.js';

/** Explicit release adds retain safe-auto policy; the candidate is selected by current owned scope. */
export function createImportCandidateReleaseManualSafeAddService({ recheckStore, getImportCandidate, listFileDecisions,
  previewImportCandidateApply, safeAutoAddQualityGateService, commitPreparedReleaseLibraryAdd } = {}) {
  for (const [name, dependency] of Object.entries({ readOwnedRelease: recheckStore?.readOwnedRelease,
    getImportCandidate, commitPreparedReleaseLibraryAdd })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseManualSafeAddService requires ${name}`);
  }
  const preparationService = createImportCandidateReleaseSafeAddPreparationService({ recheckStore, listFileDecisions,
    previewImportCandidateApply, safeAutoAddQualityGateService });
  async function startReleaseManualSafeAdd({ actorUserId = null, appUserId, importCandidateId = null,
    requestMetadata = null, wantedReleaseId } = {}) {
    const release = await recheckStore.readOwnedRelease({ appUserId, wantedReleaseId });
    if (!release) return { outcome: 'not_available' };
    if (release.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    const facts = release.libraryAddFacts;
    if (!isPreparedReleaseLibraryAddEligible({ release, targetUser: release.targetUser })
      || (importCandidateId != null && importCandidateId !== facts.candidateId)) return { outcome: 'not_available' };
    const candidate = await getImportCandidate({ importCandidateId: facts.candidateId });
    const prepared = await preparationService.readPreparedScope({ candidate, release, wantedReleaseId });
    if (!prepared) return { outcome: 'not_available' };
    if (hasQueuedGuardedLibraryAdd(facts)) return commitPreparedReleaseLibraryAdd({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
    if (facts.activeRunId) return { outcome: 'deferred' };
    if (!await preparationService.verifyPreparedFiles({ prepared, wantedReleaseId, marker: 'libraryAddRequestedForWantedReleaseId' })) {
      return { outcome: 'still_needs_review' };
    }
    return commitPreparedReleaseLibraryAdd({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
  }
  return { startReleaseManualSafeAdd };
}

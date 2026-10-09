/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { captureRecoveryObservation } from './music-queue-recovery-policy.js';
import { hasQueuedGuardedLibraryAdd, isPreparedReleaseLibraryAddEligible } from '../acquisition/acquisition-library-add-policy.js';
import { createImportCandidateReleaseSafeAddPreparationService, hasCurrentSafeAddParticipants } from './import-candidate-release-safe-add-preparation-service.js';
import { getRecheckMusicQueueContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { hasCompatibleMusicQueuePhysicalOwnership } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { evaluateImportBlockerRecovery } from './import-candidate-terminal-recovery-policy.js';

/** System authority is the acquired release scope, independent of any explicit-add marker. */
export function createImportCandidateMusicQueueAutoSafeAddService({ recheckStore, getImportCandidate, listFileDecisions,
  previewImportCandidateApply, safeAutoAddQualityGateService, commitPreparedAutomaticLibraryAdd,
  handleImportCandidateImportBlocker } = {}) {
  for (const [name, dependency] of Object.entries({ getImportCandidate, readOwnedRelease: recheckStore?.readOwnedRelease,
    commitPreparedAutomaticLibraryAdd, handleImportCandidateImportBlocker })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateMusicQueueAutoSafeAddService requires ${name}`);
  }
  const preparation = createImportCandidateReleaseSafeAddPreparationService({ recheckStore, listFileDecisions,
    previewImportCandidateApply, safeAutoAddQualityGateService });

  async function readCurrentScope(candidate) {
    const context = getRecheckMusicQueueContext(candidate);
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (candidate?.status !== 'import_pending' || !wantedReleaseIds.includes(context?.wantedReleaseId)
      || !candidate.files?.length) return null;
    const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds });
    if (!hasCurrentSafeAddParticipants(participants, wantedReleaseIds)) return null;
    const primary = participants.find((participant) => participant.wantedReleaseId === context.wantedReleaseId);
    if (!hasCompatibleMusicQueuePhysicalOwnership(candidate, participants)) return null;
    const release = await recheckStore.readOwnedRelease({ appUserId: primary.appUserId, wantedReleaseId: primary.wantedReleaseId });
    if (!isPreparedReleaseLibraryAddEligible({ release, targetUser: release?.targetUser })
      || release.libraryAddFacts.candidateId !== candidate.id) return null;
    const prepared = await preparation.readPreparedScope({ candidate, release, wantedReleaseId: primary.wantedReleaseId });
    return prepared ? { prepared, release, appUserId: primary.appUserId, wantedReleaseId: primary.wantedReleaseId } : null;
  }

  async function startAutomaticMusicQueueLibraryAdd({ candidate, requestMetadata = null, operationRunId = null }) {
    const scope = await readCurrentScope(candidate);
    if (!scope) return { outcome: 'not_available' };
    const commit = () => commitPreparedAutomaticLibraryAdd({ ...scope, actorUserId: null, requestMetadata });
    if (hasQueuedGuardedLibraryAdd(scope.release.libraryAddFacts)) return commit();
    if (scope.release.libraryAddFacts.activeRunId) return { outcome: 'deferred' };
    const observation = captureRecoveryObservation(candidate);
    const applyPreview = await previewImportCandidateApply({ importCandidateId: candidate.id });
    const policy = evaluateImportBlockerRecovery(applyPreview);
    if (policy.outcomeCode) {
      const recovery = await handleImportCandidateImportBlocker({ addBlockerCode: policy.addBlockerCode, canRecover: policy.canRecover,
        failedCandidateId: candidate.id, operationRunId, observation, failureReason: applyPreview?.summary?.message ?? null,
        ...(policy.recoveryReasonCode ? { recoveryReasonCode: policy.recoveryReasonCode } : {}), scheduleFollowUpRun: true });
      return { outcome: 'still_needs_review', recovery, skippedReason: policy.skippedReason
        ?? (policy.canRecover ? 'completed_source_unavailable' : 'import_blocker_requires_operator') };
    }
    if (!await preparation.verifyPreparedFiles({ prepared: scope.prepared, wantedReleaseId: scope.wantedReleaseId,
      marker: 'automaticLibraryAddForWantedReleaseId', applyPreview })) return { outcome: 'still_needs_review' };
    return commit();
  }
  return { startAutomaticMusicQueueLibraryAdd };
}

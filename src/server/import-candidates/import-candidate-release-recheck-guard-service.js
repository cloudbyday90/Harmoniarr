/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { canRecheckLibraryAdd } from '../acquisition/acquisition-library-add-recheck-policy.js';
import { hasQueuedGuardedLibraryAdd, isPreparedReleaseLibraryAddEligible } from '../acquisition/acquisition-library-add-policy.js';
import { lockImportCandidateApplyCreation } from './import-candidate-apply-queue-store.js';
import { getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';

export function createImportCandidateReleaseRecheckGuardService({ assertMaintenanceWriteAllowed, recheckStore, getImportCandidate,
  listFileDecisions, resumeImportCandidateForSafeAdd, queuePreparedImportCandidateApply,
  withTransaction = createDatabaseTransactionRunner(), lockAppUserEligibilityFn = lockAppUserEligibility,
  lockRunCreation = lockImportCandidateApplyCreation,
} = {}) {
  for (const [name, dependency] of Object.entries({ assertMaintenanceWriteAllowed, getImportCandidate, listFileDecisions,
    resumeImportCandidateForSafeAdd, queuePreparedImportCandidateApply, withTransaction, lockAppUserEligibilityFn,
    lockRunCreation, readOwnedRelease: recheckStore?.readOwnedRelease, readParticipantPolicies: recheckStore?.readParticipantPolicies,
    lockParticipantReleases: recheckStore?.lockParticipantReleases, lockCandidate: recheckStore?.lockCandidate,
    saveQualityContext: recheckStore?.saveQualityContext })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseRecheckGuardService requires ${name}`);
  }
  async function commitPreparedSafeAdd({ prepared, appUserId, wantedReleaseId, actorUserId, requestMetadata }, mode) {
    const isPreparedAdd = mode !== 'recheck';
    const automatic = mode === 'automatic';
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      const wantedReleaseIds = getRecheckWantedReleaseIds(prepared.candidate);
      if (!wantedReleaseIds.includes(wantedReleaseId)) return { outcome: 'not_available' };
      await lockAppUserEligibilityFn({ userIds: [...new Set([appUserId, ...prepared.participants.map((participant) => participant.appUserId)])], queryable });
      await recheckStore.lockParticipantReleases({ wantedReleaseIds, queryable });
      await lockRunCreation({ queryable });
      await recheckStore.lockCandidate({ importCandidateId: prepared.candidate.id, queryable });
      const release = await recheckStore.readOwnedRelease({ appUserId, wantedReleaseId, queryable });
      if (!release) throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      if (release.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
      const facts = isPreparedAdd ? release.libraryAddFacts : release.libraryAddRecoveryFacts;
      if (facts?.candidateId !== prepared.candidate.id) return { outcome: 'not_available' };
      if (hasQueuedGuardedLibraryAdd(facts)) return { outcome: 'already_queued', runId: facts.activeRunId };
      if (facts.activeRunId) return { outcome: 'deferred' };
      const eligible = isPreparedAdd ? isPreparedReleaseLibraryAddEligible : canRecheckLibraryAdd;
      if (!eligible({ release, targetUser: release.targetUser })) return { outcome: 'not_available' };
      const candidate = await getImportCandidate({ importCandidateId: prepared.candidate.id, queryable });
      const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds, queryable });
      const decisions = await listFileDecisions({ importCandidateId: prepared.candidate.id }, queryable);
      if (!isDeepStrictEqual(candidate, prepared.candidate) || !isDeepStrictEqual(participants, prepared.participants)
        || !isDeepStrictEqual(decisions, prepared.decisions)
        || (!isPreparedAdd && !isDeepStrictEqual({ addBlockerCode: facts.addBlockerCode, recoveryReasonCode: facts.recoveryReasonCode }, prepared.stop))) {
        return { outcome: 'not_available' };
      }
      if (!prepared.qualityContext) return { outcome: 'not_available' };
      const automaticLibraryAddAuthority = automatic ? buildAutomaticLibraryAddAuthority(candidate) : null;
      if (automatic && !automaticLibraryAddAuthority) return { outcome: 'not_available' };
      const marker = automatic ? 'automaticLibraryAddForWantedReleaseId'
        : isPreparedAdd ? 'libraryAddRequestedForWantedReleaseId' : 'recheckRequestedForWantedReleaseId';
      await recheckStore.saveQualityContext({ importCandidateId: candidate.id, musicQueueContext: { ...prepared.qualityContext, [marker]: wantedReleaseId },
        candidateStatus: isPreparedAdd ? 'import_pending' : 'failed', queryable });
      if (!isPreparedAdd) {
        await resumeImportCandidateForSafeAdd({ actorUserId, importCandidateId: candidate.id, queryable,
          reason: 'Automatic library add resumed after prerequisite repair', requestMetadata });
      }
      const started = await queuePreparedImportCandidateApply({ applySafetyMode: 'safe_auto', importCandidateIds: [candidate.id],
        ...(automatic ? { automaticLibraryAddAuthority } : {}),
        preparedSummary: { counts: { blocked: 0, ready: 1, readyWithWarnings: 0, totalImportPending: 1 },
          importPendingCandidates: [{ id: candidate.id }] }, queryable, requestMetadata, triggeredByUserId: automatic ? null : actorUserId,
        triggerSource: automatic ? 'music_queue_download_completed'
          : isPreparedAdd ? 'music_queue_manual_add' : 'music_queue_prerequisite_recheck' });
      return { outcome: 'queued', runId: started.run.id };
    });
  }
  return { commitPreparedReleaseRecheck: (input) => commitPreparedSafeAdd(input, 'recheck'),
    commitPreparedReleaseLibraryAdd: (input) => commitPreparedSafeAdd(input, 'manual'),
    commitPreparedAutomaticLibraryAdd: (input) => commitPreparedSafeAdd(input, 'automatic') };
}

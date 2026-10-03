/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { isDeepStrictEqual } from 'node:util';
import { canRecheckLibraryAdd, getLibraryAddRecheckReason, hasQueuedLibraryAddRecheck } from '../acquisition/acquisition-library-add-recheck-policy.js';
import { buildRecheckQualityContext, getRecheckMusicQueueContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';

function hasCurrentParticipants(participants, wantedReleaseIds) {
  return participants.length === wantedReleaseIds.length && new Set(participants.map((participant) => participant.wantedReleaseId)).size === wantedReleaseIds.length
    && participants.every((participant) => wantedReleaseIds.includes(participant.wantedReleaseId)
      && participant.discoveryLinkExists === true && !participant.isDisabled && ['missing', 'partial'].includes(participant.wantedStatus)
      && participant.missingTrackCount > 0 && participant.visibilityState !== 'ignored');
}

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
  async function recheckReleaseSafeAdd({ actorUserId = null, appUserId, requestMetadata = null, wantedReleaseId } = {}) {
    const release = await recheckStore.readOwnedRelease({ appUserId, wantedReleaseId });
    if (!release) return { outcome: 'not_available' };
    if (release.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    const facts = release.libraryAddRecoveryFacts;
    const queued = hasQueuedLibraryAddRecheck(facts);
    if (!queued && !canRecheckLibraryAdd({ release, targetUser: release.targetUser })) return { outcome: 'not_available' };
    const candidate = await getImportCandidate({ importCandidateId: facts.candidateId });
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (!candidate || !wantedReleaseIds.includes(wantedReleaseId)) return { outcome: 'not_available' };
    const [participants, decisions] = await Promise.all([
      recheckStore.readParticipantPolicies({ wantedReleaseIds }), listFileDecisions({ importCandidateId: candidate.id }),
    ]);
    if (!hasCurrentParticipants(participants, wantedReleaseIds)
      || participants.some((participant) => participant.metadataReleaseId !== release.metadataReleaseId)) {
      return { outcome: 'not_available' };
    }
    const prepared = { candidate, participants, decisions,
      stop: { addBlockerCode: facts.addBlockerCode, recoveryReasonCode: facts.recoveryReasonCode } };
    if (queued) return commitPreparedReleaseRecheck({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
    if (facts.activeRunId) return { outcome: 'deferred' };
    if (getLibraryAddRecheckReason(facts) === 'audio_check_failed' && (await getMediaToolingStatus())?.status !== 'healthy') {
      return { outcome: 'prerequisite_not_ready' };
    }
    const applyPreview = await previewImportCandidateApply({ importCandidateId: candidate.id });
    if (applyPreview?.summary?.status !== 'ready' || !applyPreview.files?.length
      || !(applyPreview.counts?.readyCount > 0) || applyPreview.files.some((file) => file.status?.code !== 'ready')) {
      return { outcome: 'still_needs_review' };
    }
    prepared.qualityContext = await buildRecheckQualityContext({ candidate, participants });
    prepared.qualityContext.recheckRequestedForWantedReleaseId = wantedReleaseId;
    const qualityGate = await safeAutoAddQualityGateService.evaluateSafeAutoAddQuality({ applyPreview,
      summaryCandidate: { ...candidate, normalizedPayload: { ...candidate.normalizedPayload, musicQueue: prepared.qualityContext } } });
    if (!qualityGate?.eligible) return { outcome: 'still_needs_review' };
    return commitPreparedReleaseRecheck({ prepared, actorUserId, appUserId, requestMetadata, wantedReleaseId });
  }
  async function resolveCurrentQueuedRecheckCandidate({ summaryCandidate, triggerSource }) {
    if (triggerSource !== 'music_queue_prerequisite_recheck') return summaryCandidate;
    const candidate = await getImportCandidate({ importCandidateId: summaryCandidate.id });
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (candidate.status !== 'import_pending' || !wantedReleaseIds.length) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued completed download is no longer available');
    }
    const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds });
    if (!hasCurrentParticipants(participants, wantedReleaseIds)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The shared release recipients have changed');
    }
    const requestedForId = getRecheckMusicQueueContext(candidate)?.recheckRequestedForWantedReleaseId;
    const requestedFor = participants.find((participant) => participant.wantedReleaseId === requestedForId);
    const release = requestedFor ? await recheckStore.readOwnedRelease({ appUserId: requestedFor.appUserId, wantedReleaseId: requestedForId }) : null;
    if (!release || release.targetUser.isDisabled || !release.discoveryLinkExists || !['missing', 'partial'].includes(release.wantedStatus)
      || !(release.missingTrackCount > 0) || release.evidence?.visibilityState === 'ignored'
      || release.libraryAddRecoveryFacts?.candidateId !== candidate.id
      || release.libraryAddRecoveryFacts?.hasConflictingCandidate !== false
      || !hasQueuedLibraryAddRecheck(release.libraryAddRecoveryFacts)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued release recipient is no longer eligible');
    }
    const musicQueueContext = await buildRecheckQualityContext({ candidate, participants });
    return { ...summaryCandidate, musicQueueContext, recheckPolicySnapshot: { candidate, participants } };
  }
  async function assertQueuedRecheckCandidateCurrent({ summaryCandidate, triggerSource }) {
    if (triggerSource !== 'music_queue_prerequisite_recheck') return;
    const fresh = await resolveCurrentQueuedRecheckCandidate({ summaryCandidate, triggerSource });
    if (!isDeepStrictEqual(fresh.recheckPolicySnapshot, summaryCandidate.recheckPolicySnapshot)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued release or its quality policy changed during the audio check');
    }
  }
  return { recheckReleaseSafeAdd, resolveCurrentQueuedRecheckCandidate, assertQueuedRecheckCandidateCurrent };
}

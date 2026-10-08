/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { GUARDED_LIBRARY_ADD_TRIGGER_SOURCES, hasQueuedGuardedLibraryAdd } from '../acquisition/acquisition-library-add-policy.js';
import { buildRecheckQualityContext, getRecheckMusicQueueContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';
import { hasCurrentSafeAddParticipants } from './import-candidate-release-safe-add-preparation-service.js';
import { hasPersistedMusicQueueOwnership, hasCompatibleMusicQueuePhysicalOwnership, buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';

export function createImportCandidateReleaseSafeAddPolicyService({ recheckStore, getImportCandidate } = {}) {
  for (const [name, dependency] of Object.entries({ getImportCandidate, readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseSafeAddPolicyService requires ${name}`);
  }
  async function resolveCurrentQueuedSafeAddCandidate({ summaryCandidate, triggerSource, runId = null }) {
    if (!GUARDED_LIBRARY_ADD_TRIGGER_SOURCES.includes(triggerSource) && triggerSource !== 'download_completed') return summaryCandidate;
    const candidate = await getImportCandidate({ importCandidateId: summaryCandidate.id });
    if (triggerSource === 'download_completed') {
      if (!hasPersistedMusicQueueOwnership(candidate)) return summaryCandidate;
      throw createApiError(409, 'import_candidate_apply_not_ready', 'This older automatic Music Queue job needs a fresh guarded library-add decision');
    }
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (candidate?.status !== 'import_pending' || !wantedReleaseIds.length) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued completed download is no longer available');
    }
    if (triggerSource === 'music_queue_download_completed') {
      const authority = await recheckStore.readAutomaticLibraryAddAuthority?.({ runId, importCandidateId: candidate.id });
      if (!authority || !isDeepStrictEqual(authority, buildAutomaticLibraryAddAuthority(candidate))) {
        throw createApiError(409, 'import_candidate_apply_not_ready', 'The accepted automatic library-add identity changed');
      }
    }
    const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds });
    if (!hasCurrentSafeAddParticipants(participants, wantedReleaseIds)
      || (triggerSource === 'music_queue_download_completed' && !hasCompatibleMusicQueuePhysicalOwnership(candidate, participants))) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The shared release recipients have changed');
    }
    const marker = triggerSource === 'music_queue_download_completed' ? 'automaticLibraryAddForWantedReleaseId'
      : triggerSource === 'music_queue_manual_add' ? 'libraryAddRequestedForWantedReleaseId' : 'recheckRequestedForWantedReleaseId';
    const requestedForId = getRecheckMusicQueueContext(candidate)?.[marker];
    if (triggerSource === 'music_queue_download_completed' && requestedForId !== getRecheckMusicQueueContext(candidate)?.wantedReleaseId) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The automatic release primary recipient changed');
    }
    const requestedFor = participants.find((participant) => participant.wantedReleaseId === requestedForId);
    const release = requestedFor ? await recheckStore.readOwnedRelease({ appUserId: requestedFor.appUserId, wantedReleaseId: requestedForId }) : null;
    const facts = triggerSource === 'music_queue_prerequisite_recheck' ? release?.libraryAddRecoveryFacts : release?.libraryAddFacts;
    if (!release || release.targetUser.isDisabled || !release.discoveryLinkExists || !['missing', 'partial'].includes(release.wantedStatus)
      || !(release.missingTrackCount > 0) || release.evidence?.visibilityState === 'ignored'
      || facts?.candidateId !== candidate.id || !hasQueuedGuardedLibraryAdd(facts)
      || facts.activeRunTriggerSource !== triggerSource || (runId != null && facts.activeRunId !== runId)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued release recipient is no longer eligible');
    }
    const musicQueueContext = await buildRecheckQualityContext({ candidate, participants });
    return { ...summaryCandidate, musicQueueContext, recheckPolicySnapshot: { candidate, participants } };
  }
  async function assertQueuedSafeAddCandidateCurrent(input) {
    if (input.triggerSource === 'download_completed') {
      await resolveCurrentQueuedSafeAddCandidate(input);
      return;
    }
    if (!GUARDED_LIBRARY_ADD_TRIGGER_SOURCES.includes(input.triggerSource)) return;
    const fresh = await resolveCurrentQueuedSafeAddCandidate(input);
    if (!isDeepStrictEqual(fresh.recheckPolicySnapshot, input.summaryCandidate.recheckPolicySnapshot)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued release or its quality policy changed during the audio check');
    }
  }
  return { resolveCurrentQueuedSafeAddCandidate, assertQueuedSafeAddCandidateCurrent };
}

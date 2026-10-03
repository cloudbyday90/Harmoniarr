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

export function createImportCandidateReleaseSafeAddPolicyService({ recheckStore, getImportCandidate } = {}) {
  for (const [name, dependency] of Object.entries({ getImportCandidate, readOwnedRelease: recheckStore?.readOwnedRelease,
    readParticipantPolicies: recheckStore?.readParticipantPolicies })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseSafeAddPolicyService requires ${name}`);
  }
  async function resolveCurrentQueuedSafeAddCandidate({ summaryCandidate, triggerSource, runId = null }) {
    if (!GUARDED_LIBRARY_ADD_TRIGGER_SOURCES.includes(triggerSource)) return summaryCandidate;
    const candidate = await getImportCandidate({ importCandidateId: summaryCandidate.id });
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (candidate?.status !== 'import_pending' || !wantedReleaseIds.length) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued completed download is no longer available');
    }
    const participants = await recheckStore.readParticipantPolicies({ wantedReleaseIds });
    if (!hasCurrentSafeAddParticipants(participants, wantedReleaseIds)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The shared release recipients have changed');
    }
    const marker = triggerSource === 'music_queue_manual_add' ? 'libraryAddRequestedForWantedReleaseId' : 'recheckRequestedForWantedReleaseId';
    const requestedForId = getRecheckMusicQueueContext(candidate)?.[marker];
    const requestedFor = participants.find((participant) => participant.wantedReleaseId === requestedForId);
    const release = requestedFor ? await recheckStore.readOwnedRelease({ appUserId: requestedFor.appUserId, wantedReleaseId: requestedForId }) : null;
    const facts = triggerSource === 'music_queue_manual_add' ? release?.libraryAddFacts : release?.libraryAddRecoveryFacts;
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
    if (!GUARDED_LIBRARY_ADD_TRIGGER_SOURCES.includes(input.triggerSource)) return;
    const fresh = await resolveCurrentQueuedSafeAddCandidate(input);
    if (!isDeepStrictEqual(fresh.recheckPolicySnapshot, input.summaryCandidate.recheckPolicySnapshot)) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'The queued release or its quality policy changed during the audio check');
    }
  }
  return { resolveCurrentQueuedSafeAddCandidate, assertQueuedSafeAddCandidateCurrent };
}

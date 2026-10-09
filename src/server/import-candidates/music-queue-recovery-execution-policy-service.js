/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { normalizeSavedQualityPreferences } from '../acquisition/acquisition-quality-evidence-policy.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { buildRecoveryQualityContext, captureRecoveryObservation, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients,
  hasOwnedRecoveryOrigin, isValidRecoveryBaseline, matchesAcceptedRecoveryProvenance,
  MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } from './music-queue-recovery-policy.js';

export function recoveryParticipantSnapshot(participants) {
  return participants.map((participant) => ({ ...participant, qualityPreferences: normalizeSavedQualityPreferences(participant.qualityPreferences),
    qualityOverride: participant.qualityOverride ? { mode: participant.qualityOverride.mode,
      wantedReleaseId: participant.qualityOverride.wantedReleaseId, minimumBitrateKbps: participant.qualityOverride.minimumBitrateKbps ?? null } : null }));
}
const refuse = () => { throw createApiError(409, 'music_queue_recovery_not_current', 'This recovery download no longer has current acquisition authority'); };

export function createMusicQueueRecoveryExecutionPolicyService({ store = createMusicQueueRecoveryStore(),
  assertMaintenanceWriteAllowed = async () => {}, qualityPolicyService = createAcquisitionQualityPolicyService() } = {}) {
  async function resolveRecoveryExecution({ candidate, runId, triggerSource }) {
    if (!candidate) return refuse();
    const reservation = await store.readExecutionReservation(candidate.id);
    const run = await store.getOrigin(runId, candidate.id);
    const identity = buildAutomaticLibraryAddAuthority(candidate);
    if (hasOwnedRecoveryOrigin(candidate, run) && !identity) return refuse();
    const legacyOwnedRecovery = hasOwnedRecoveryOrigin(candidate, run)
      && (run?.summary?.recoveryCascade != null || candidate.normalizedPayload?.recoveryCascade != null);
    if (!reservation && triggerSource !== MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE && !legacyOwnedRecovery) return null;
    if (!run || !['pending','running'].includes(run.status) || !run.has_item
      || !await store.isCurrentExecutionOrigin(candidate.id, runId)) return refuse();
    const explicitFreshHandoff = reservation?.summary?.musicQueueRecovery?.retired === true && reservation.id !== runId
      && run.summary?.triggerSource === 'missing_music_manual' && run.summary.selectedCandidateId === candidate.id
      && run.summary.sourceSearchId === candidate.sourceSearchId;
    if ((!reservation || reservation.id !== runId || reservation.summary?.musicQueueRecovery?.retired === true) && !explicitFreshHandoff) return refuse();
    const record = reservation.summary.musicQueueRecovery;
    if (candidate.status !== 'selected' || !identity || !record || !isValidRecoveryBaseline(record.baselineRequirement)
      || (!explicitFreshHandoff && (candidate.sourceSearchId !== reservation.summary.sourceSearchId
        || !isDeepStrictEqual(identity, record.authority) || !matchesAcceptedRecoveryProvenance(candidate, record.selectedObservation)))
      || (explicitFreshHandoff && !identity.wantedReleaseIds.includes(run.summary.sourceWantedReleaseId))) return refuse();
    await assertMaintenanceWriteAllowed();
    const participants = await store.readParticipantPolicies({ wantedReleaseIds: identity.wantedReleaseIds });
    if (!hasCurrentRecoveryRecipients(candidate, participants)
      || participants.some((participant) => participant.metadataReleaseId !== record.metadataReleaseId)) return refuse();
    const discovery = await store.getDiscovery(record.metadataReleaseId);
    if (!hasCurrentRecoveryDiscovery(discovery, record.failedSourceSearchId)) return refuse();
    const context = await buildRecoveryQualityContext({ failedCandidate: candidate, participants, baselineRequirement: record.baselineRequirement });
    const quality = qualityPolicyService.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
      qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null });
    if (!quality.autoDownloadEligible) return refuse();
    return { context, snapshot: { candidate: captureRecoveryObservation(candidate), participants: recoveryParticipantSnapshot(participants),
      record, context } };
  }
  async function assertRecoveryExecutionCurrent({ candidateId, runId, triggerSource, prepared }) {
    const candidate = await store.getCandidate(candidateId);
    const fresh = candidate ? await resolveRecoveryExecution({ candidate, runId, triggerSource }) : refuse();
    if ((prepared || fresh) && !isDeepStrictEqual(prepared?.snapshot, fresh?.snapshot)) return refuse();
  }
  return { resolveRecoveryExecution, assertRecoveryExecutionCurrent };
}

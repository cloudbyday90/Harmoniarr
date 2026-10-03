/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildRecheckQualityContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';

export function hasCurrentSafeAddParticipants(participants, wantedReleaseIds) {
  return wantedReleaseIds.length > 0 && participants.length === wantedReleaseIds.length
    && new Set(participants.map((participant) => participant.wantedReleaseId)).size === wantedReleaseIds.length
    && participants.every((participant) => wantedReleaseIds.includes(participant.wantedReleaseId)
      && participant.discoveryLinkExists === true && !participant.isDisabled && ['missing', 'partial'].includes(participant.wantedStatus)
      && participant.missingTrackCount > 0 && participant.visibilityState !== 'ignored');
}

/** Media/file preparation is deliberately outside the short owning write transaction. */
export function createImportCandidateReleaseSafeAddPreparationService({ recheckStore, listFileDecisions,
  previewImportCandidateApply, safeAutoAddQualityGateService } = {}) {
  for (const [name, dependency] of Object.entries({ readParticipantPolicies: recheckStore?.readParticipantPolicies,
    listFileDecisions, previewImportCandidateApply, evaluateSafeAutoAddQuality: safeAutoAddQualityGateService?.evaluateSafeAutoAddQuality })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateReleaseSafeAddPreparationService requires ${name}`);
  }
  async function readPreparedScope({ candidate, release, wantedReleaseId }) {
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    if (!candidate || !wantedReleaseIds.includes(wantedReleaseId)) return null;
    const [participants, decisions] = await Promise.all([
      recheckStore.readParticipantPolicies({ wantedReleaseIds }), listFileDecisions({ importCandidateId: candidate.id }),
    ]);
    if (!hasCurrentSafeAddParticipants(participants, wantedReleaseIds)
      || participants.some((participant) => participant.metadataReleaseId !== release.metadataReleaseId)) return null;
    return { candidate, participants, decisions };
  }
  async function verifyPreparedFiles({ prepared, wantedReleaseId, marker }) {
    const applyPreview = await previewImportCandidateApply({ importCandidateId: prepared.candidate.id });
    if (applyPreview?.summary?.status !== 'ready' || !applyPreview.files?.length
      || !(applyPreview.counts?.readyCount > 0) || applyPreview.files.some((file) => file.status?.code !== 'ready')) return false;
    prepared.qualityContext = await buildRecheckQualityContext(prepared);
    prepared.qualityContext[marker] = wantedReleaseId;
    const { candidate } = prepared;
    const qualityGate = await safeAutoAddQualityGateService.evaluateSafeAutoAddQuality({ applyPreview,
      summaryCandidate: { ...candidate, normalizedPayload: { ...candidate.normalizedPayload, musicQueue: prepared.qualityContext } } });
    return qualityGate?.eligible === true;
  }
  return { readPreparedScope, verifyPreparedFiles };
}

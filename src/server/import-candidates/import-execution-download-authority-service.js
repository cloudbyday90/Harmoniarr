/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { normalizeSavedQualityPreferences } from '../acquisition/acquisition-quality-evidence-policy.js';
import { normalizeDownloadTransferId } from '../slskd/slskd-download-attempt-policy.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecoveryQualityContext, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients,
  hasOwnedRecoveryOrigin, isValidRecoveryBaseline } from './music-queue-recovery-policy.js';
import { recoveryParticipantSnapshot } from './music-queue-recovery-execution-policy-service.js';

export function normalizeDownloadCommandContext(input = {}) {
  const { operationRunId, importCandidateId, actorUserId, refreshTokenId } = input;
  const identifiers = Object.fromEntries(Object.entries({ operationRunId, importCandidateId, actorUserId, refreshTokenId })
    .map(([key, value]) => [key, normalizeDownloadTransferId(value)]));
  if (Object.values(identifiers).some((id) => !id)) {
    throw createApiError(400, 'validation_error', 'Valid download episode and session identifiers are required');
  }
  return identifiers;
}

/** Shared current authority for explicit download commands; no provider or database writes. */
export function createImportExecutionDownloadAuthorityService({ store, getNow = () => new Date(),
  qualityPolicyService = createAcquisitionQualityPolicyService(),
  createStaleError = () => createApiError(409, 'import_execution_download_not_current', 'The download policy changed') } = {}) {
  for (const name of ['getActor', 'readParticipantPolicies', 'getDiscovery', 'findActiveSelection']) {
    if (typeof store?.[name] !== 'function') throw new TypeError(`Download authority requires ${name}`);
  }
  async function actor(input, queryable = null, fresh = false) {
    const value = await store.getActor({ actorUserId: input.actorUserId, refreshTokenId: input.refreshTokenId,
      lock: queryable != null, queryable });
    if (!value || value.role !== 'admin' || value.isDisabled || value.sessionRevoked || value.sessionReplaced
      || !Number.isFinite(Date.parse(value.sessionExpiresAt)) || Date.parse(value.sessionExpiresAt) <= getNow().getTime()) {
      throw createApiError(403, 'admin_required', 'Current administrator access is required');
    }
    if (fresh && value.mustChangePassword) throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
    return value;
  }
  async function policy({ candidate, run }, currentActor, queryable = null) {
    const identity = buildAutomaticLibraryAddAuthority(candidate);
    const owned = hasOwnedRecoveryOrigin(candidate, { summary: run.summary });
    let participants = [];
    let context = { profileCode: 'lossless_archive', qualityOverride: null, minimumBitrateKbps: null };
    if (owned) {
      if (!identity || candidate.normalizedPayload?.requestOwnership?.externalRequestReleaseIntentId) throw createStaleError();
      participants = await store.readParticipantPolicies({ wantedReleaseIds: identity.wantedReleaseIds, queryable });
      if (!hasCurrentRecoveryRecipients(candidate, participants)) throw createStaleError();
      const metadataReleaseId = participants[0]?.metadataReleaseId;
      const record = run.summary?.musicQueueRecovery;
      if (record != null && (!isValidRecoveryBaseline(record.baselineRequirement) || record.retired === true
        || record.metadataReleaseId !== metadataReleaseId || !isDeepStrictEqual(record.authority, identity))) throw createStaleError();
      const discovery = await store.getDiscovery(metadataReleaseId, queryable);
      if (!hasCurrentRecoveryDiscovery(discovery, record?.failedSourceSearchId ?? candidate.sourceSearchId)
        || await store.findActiveSelection({ failedCandidateId: candidate.id, metadataReleaseId, queryable })) throw createStaleError();
      context = await buildRecoveryQualityContext({ failedCandidate: candidate, participants, baselineRequirement: record?.baselineRequirement ?? null });
    } else if (candidate.normalizedPayload?.requestOwnership != null) {
      throw createStaleError();
    }
    const quality = qualityPolicyService.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
      qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null });
    if (quality.autoDownloadEligible !== true) throw createStaleError();
    return { participants, context, identity, snapshot: { context,
      participants: recoveryParticipantSnapshot(participants), actorPreferences: normalizeSavedQualityPreferences(currentActor.qualityPreferences) } };
  }
  return { actor, policy };
}

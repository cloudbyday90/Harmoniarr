/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { isScopedQualityFallbackOverride } from '../acquisition/acquisition-quality-evidence-policy.js';
import { buildAutomaticLibraryAddAuthority, hasCompatibleMusicQueuePhysicalOwnership, hasPersistedMusicQueueOwnership,
  AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecheckQualityContext, getRecheckMusicQueueContext } from './import-candidate-release-recheck-quality-policy.js';
import { hasCurrentSafeAddParticipants } from './import-candidate-release-safe-add-preparation-service.js';
import { buildSharedFormatPreferences } from '../library/library-discovery-quality-context-service.js';

export const MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE = 'music_queue_fallback_recovery';
export const MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE = 'music_queue_fallback_rediscovery';
const priority = { any_available: 0, high_quality: 1, lossless_archive: 2 };
export const boundedRecoveryFloor = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 256 && value <= 10_000 ? value : 0;

export function captureRecoveryObservation(candidate) {
  const payload = candidate?.normalizedPayload ?? {};
  const owner = payload.requestOwnership;
  const requestOwnership = { present: Object.hasOwn(payload, 'requestOwnership'),
    ...(Object.hasOwn(payload, 'requestOwnership') ? { value: owner == null ? null : typeof owner === 'object' && !Array.isArray(owner)
      ? Object.fromEntries(AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS.filter((field) => Object.hasOwn(owner, field)).map((field) => [field, owner[field]])) : 'invalid' } : {}) };
  return { candidateId: candidate?.id, status: candidate?.status, updatedAt: candidate?.updatedAt?.toISOString?.() ?? candidate?.updatedAt ?? null,
    sourceSearchId: candidate?.sourceSearchId ?? null, sourceProvider: candidate?.sourceProvider ?? null,
    sourceResponseKey: candidate?.sourceResponseKey ?? null, username: candidate?.username ?? null, folderPath: candidate?.folderPath ?? null,
    files: (candidate?.files ?? []).map((file) => ({ id: file.id, filename: file.filename, sizeBytes: file.sizeBytes,
      folderPath: file.folderPath ?? null, rawRemoteFilename: typeof file.rawPayload?.filename === 'string' ? file.rawPayload.filename : null,
      extension: file.extension, bitRateKbps: file.bitRateKbps ?? null, isLocked: file.isLocked === true })),
    authority: buildAutomaticLibraryAddAuthority(candidate), requestOwnership };
}
export function matchesRecoveryObservation(candidate, observation) {
  return observation != null && isDeepStrictEqual(captureRecoveryObservation(candidate), observation);
}
export function matchesAcceptedRecoveryProvenance(candidate, observation) {
  if (!observation) return false;
  const source = { ...observation }; const current = captureRecoveryObservation(candidate);
  delete source.status; delete source.updatedAt; delete current.status; delete current.updatedAt;
  return isDeepStrictEqual(source, current);
}
export function canRetireRecoverySelection(candidate, observation) {
  if (!observation || candidate?.status !== 'selected') return false;
  const source = { ...observation }; const current = captureRecoveryObservation(candidate);
  if (current.authority != null && !isDeepStrictEqual(source.authority, current.authority)) return false;
  delete source.status; delete source.updatedAt; delete source.authority;
  delete current.status; delete current.updatedAt; delete current.authority;
  return isDeepStrictEqual(source, current);
}
export function hasOwnedRecoveryOrigin(candidate, origin) {
  return hasPersistedMusicQueueOwnership(candidate) || [MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, 'music_queue_download_completed',
    'music_queue_manual_add', 'music_queue_prerequisite_recheck'].includes(origin?.summary?.triggerSource)
    || (origin?.summary?.triggerSource === 'missing_music_manual' && origin.summary.sourceWantedReleaseId != null);
}
export function hasCurrentRecoveryRecipients(candidate, participants) {
  const authority = buildAutomaticLibraryAddAuthority(candidate);
  return authority != null && hasCurrentSafeAddParticipants(participants, authority.wantedReleaseIds)
    && hasCompatibleMusicQueuePhysicalOwnership(candidate, participants);
}
export function hasSameRecoveryIdentity(failedCandidate, candidate) {
  const identity = buildAutomaticLibraryAddAuthority(candidate);
  return identity != null && isDeepStrictEqual(identity, buildAutomaticLibraryAddAuthority(failedCandidate))
    && !candidate.normalizedPayload?.requestOwnership?.externalRequestReleaseIntentId;
}
export function hasCurrentRecoveryDiscovery(discovery, sourceSearchId) {
  if (typeof sourceSearchId !== 'string' || !sourceSearchId.trim() || !discovery
    || discovery.evidence?.lastSearchId !== sourceSearchId || discovery.searchMode !== 'automatic') return false;
  const attempted = Date.parse(discovery.evidence?.lastDispatchAttemptedAt ?? discovery.lastSearchAt);
  const observed = Date.parse(discovery.evidence?.lastSearchResult?.observedAt);
  return Number.isFinite(attempted) && Number.isFinite(observed) && attempted <= observed;
}

/** Current consent is rebuilt, while both acquisition baselines and every valid recipient floor are retained. */
export async function buildRecoveryQualityContext({ failedCandidate, candidate = failedCandidate, participants, baselineRequirement = null }) {
  const failed = await buildRecheckQualityContext({ candidate: failedCandidate, participants });
  const chosen = await buildRecheckQualityContext({ candidate, participants });
  const baselineCode = Object.hasOwn(priority, baselineRequirement?.profileCode) ? baselineRequirement.profileCode : 'any_available';
  const profileCode = [failed.profileCode, chosen.profileCode, baselineCode].reduce((selected, code) => priority[code] > priority[selected] ? code : selected, 'any_available');
  const minimumBitrateKbps = Math.max(boundedRecoveryFloor(failed.minimumBitrateKbps), boundedRecoveryFloor(chosen.minimumBitrateKbps),
    boundedRecoveryFloor(baselineRequirement?.minimumBitrateKbps),
    ...participants.map((participant) => isScopedQualityFallbackOverride(participant.qualityOverride, participant.wantedReleaseId)
      ? boundedRecoveryFloor(participant.qualityOverride.minimumBitrateKbps) : 0)) || null;
  const qualityOverride = failed.qualityOverride ?? chosen.qualityOverride ?? null;
  return { ...chosen, profileCode, qualityOverride: qualityOverride ? { ...qualityOverride,
    ...(minimumBitrateKbps ? { minimumBitrateKbps } : {}) } : null,
  ...(minimumBitrateKbps ? { minimumBitrateKbps } : {}),
  formatPreferences: buildSharedFormatPreferences(profileCode, qualityOverride != null, minimumBitrateKbps ?? 256),
  preferredFormat: profileCode === 'lossless_archive' && qualityOverride == null ? 'flac' : 'any' };
}
export function recoveryBaseline(context) {
  return { profileCode: context.profileCode, minimumBitrateKbps: context.minimumBitrateKbps ?? null };
}
export function isValidRecoveryBaseline(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(priority, value.profileCode)
    && Object.hasOwn(value, 'minimumBitrateKbps') && (value.minimumBitrateKbps === null || boundedRecoveryFloor(value.minimumBitrateKbps) > 0);
}
export function getRecoveryMetadataReleaseId(candidate) {
  return candidate?.normalizedPayload?.discoveryScope?.metadataReleaseId ?? candidate?.normalizedPayload?.requestOwnership?.metadataReleaseId ?? null;
}
export function getRecoveryPrimary(candidate) { return getRecheckMusicQueueContext(candidate)?.wantedReleaseId ?? null; }

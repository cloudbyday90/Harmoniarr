/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { isScopedQualityFallbackOverride } from '../acquisition/acquisition-quality-evidence-policy.js';
import { getRecheckMusicQueueContext, getRecheckWantedReleaseIds } from './import-candidate-release-recheck-quality-policy.js';

export const AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS = Object.freeze(['metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId',
  'sourceMediaRequestId', 'sourceRequestKind', 'sourceRequestedByUserId', 'sourceRequestedForUserId', 'sourceType', 'externalRequestReleaseIntentId']);

/** Presence is ownership evidence even when a retained context is malformed. */
export function hasPersistedMusicQueueOwnership(candidate) {
  const payload = candidate?.normalizedPayload;
  return Boolean(payload && typeof payload === 'object'
    && (Object.hasOwn(payload, 'musicQueue') || Object.hasOwn(payload, 'musicQueueContext')));
}

export function hasValidAutomaticMusicQueueScope(candidate) {
  const payload = candidate?.normalizedPayload;
  const validId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id);
  const aliasesAgree = !payload?.musicQueue || !payload?.musicQueueContext
    || (payload.musicQueue.wantedReleaseId === payload.musicQueueContext.wantedReleaseId
      && isDeepStrictEqual(getRecheckWantedReleaseIds({ normalizedPayload: { musicQueue: payload.musicQueue } }),
        getRecheckWantedReleaseIds({ normalizedPayload: { musicQueue: payload.musicQueueContext } })));
  return aliasesAgree && hasPersistedMusicQueueOwnership(candidate)
    && ['musicQueue', 'musicQueueContext'].every((key) => !Object.hasOwn(payload, key)
      || (payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key])
        && (!Object.hasOwn(payload[key], 'wantedReleaseId') || validId(payload[key].wantedReleaseId))
        && (!Object.hasOwn(payload[key], 'wantedReleaseIds') || (Array.isArray(payload[key].wantedReleaseIds)
          && payload[key].wantedReleaseIds.every(validId)))))
    && getRecheckWantedReleaseIds(candidate).includes(getRecheckMusicQueueContext(candidate)?.wantedReleaseId);
}

export function hasCompatibleMusicQueuePhysicalOwnership(candidate, participants) {
  const primary = participants.find((participant) => participant.wantedReleaseId === getRecheckMusicQueueContext(candidate)?.wantedReleaseId);
  const ownership = candidate?.normalizedPayload?.requestOwnership;
  return Boolean(hasValidAutomaticMusicQueueScope(candidate) && primary && participants.every((participant) => participant.metadataReleaseId === primary.metadataReleaseId)
    && (ownership == null || (typeof ownership === 'object' && !Array.isArray(ownership)))
    && (ownership?.sourceRequestedForUserId == null || participants.some((participant) => participant.appUserId === ownership.sourceRequestedForUserId))
    && [candidate.normalizedPayload?.discoveryScope?.metadataReleaseId, ownership?.metadataReleaseId]
      .every((id) => id == null || id === primary.metadataReleaseId));
}

/** Bounded identity only: current preference/consent requirements remain live, rather than frozen in the job. */
export function buildAutomaticLibraryAddAuthority(candidate) {
  if (!hasValidAutomaticMusicQueueScope(candidate)) return null;
  const payload = candidate.normalizedPayload;
  const ownership = payload.requestOwnership;
  const fields = AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS;
  if (ownership != null && (typeof ownership !== 'object' || Array.isArray(ownership)
    || fields.some((field) => Object.hasOwn(ownership, field)
      && ownership[field] != null && (typeof ownership[field] !== 'string' || ownership[field].length > 200)))) return null;
  return { wantedReleaseId: getRecheckMusicQueueContext(candidate).wantedReleaseId, wantedReleaseIds: getRecheckWantedReleaseIds(candidate),
    requestOwnership: { present: Object.hasOwn(payload, 'requestOwnership'),
      ...(Object.hasOwn(payload, 'requestOwnership') ? { value: ownership == null ? null
        : Object.fromEntries(fields.filter((field) => Object.hasOwn(ownership, field)).map((field) => [field, ownership[field]])) } : {}) } };
}

function recoveryRequirement(context) {
  const profileCode = ['any_available', 'high_quality', 'lossless_archive'].includes(context?.profileCode)
    ? context.profileCode : 'lossless_archive';
  const override = isScopedQualityFallbackOverride(context?.qualityOverride, context?.qualityOverride?.wantedReleaseId)
    ? context.qualityOverride : null;
  const floor = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 256 && value <= 10_000 ? value : 0;
  return { profileCode, minimumBitrateKbps: Math.max(floor(context?.minimumBitrateKbps), floor(override?.minimumBitrateKbps),
    profileCode === 'high_quality' || override ? 256 : 0),
  qualityOverride: override ? { mode: override.mode, wantedReleaseId: override.wantedReleaseId } : null };
}

/** Legacy recovery cannot clear saved consent or adopt a new floor; delegate only unchanged requirements. */
export function hasCompatibleAutomaticRecoveryRequirement(candidate, currentContext) {
  const persisted = getRecheckMusicQueueContext(candidate);
  if (persisted?.qualityOverride != null
    && (!isScopedQualityFallbackOverride(persisted.qualityOverride, persisted.qualityOverride?.wantedReleaseId)
      || !getRecheckWantedReleaseIds(candidate).includes(persisted.qualityOverride.wantedReleaseId))) return false;
  return isDeepStrictEqual(recoveryRequirement(persisted), recoveryRequirement(currentContext));
}

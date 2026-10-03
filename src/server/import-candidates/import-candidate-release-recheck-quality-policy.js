/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isScopedQualityFallbackOverride } from '../acquisition/acquisition-quality-evidence-policy.js';
import { createLibraryDiscoveryQualityContextService } from '../library/library-discovery-quality-context-service.js';

const PROFILE_PRIORITY = { any_available: 0, high_quality: 1, lossless_archive: 2 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function getRecheckMusicQueueContext(candidate) {
  return candidate?.normalizedPayload?.musicQueue ?? candidate?.normalizedPayload?.musicQueueContext ?? null;
}

export function getRecheckWantedReleaseIds(candidate) {
  const context = getRecheckMusicQueueContext(candidate);
  const ids = [...new Set([context?.wantedReleaseId, ...(Array.isArray(context?.wantedReleaseIds) ? context.wantedReleaseIds : [])].filter(Boolean))];
  return ids.length > 0 && ids.every((id) => typeof id === 'string' && UUID.test(id)) ? ids.sort() : [];
}

function boundedFloor(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 256 && value <= 10_000 ? value : 0;
}

/** Retain the downloaded candidate's requirement and apply any stricter current participant policy. */
export async function buildRecheckQualityContext({ candidate, participants }) {
  const base = getRecheckMusicQueueContext(candidate);
  const current = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext({ operatorLinks: participants });
  const baseProfile = Object.hasOwn(PROFILE_PRIORITY, base?.profileCode) ? base.profileCode : 'lossless_archive';
  const profileCode = PROFILE_PRIORITY[current.profileCode] > PROFILE_PRIORITY[baseProfile] ? current.profileCode : baseProfile;
  const savedConsent = participants.find((participant) => participant.wantedReleaseId === base?.qualityOverride?.wantedReleaseId);
  const mayRetainConsent = participants.every((participant) => participant.isDisabled !== true)
    && isScopedQualityFallbackOverride(base?.qualityOverride, savedConsent?.wantedReleaseId)
    && isScopedQualityFallbackOverride(savedConsent?.qualityOverride, savedConsent?.wantedReleaseId)
    && (current.profileCode !== 'lossless_archive' || current.qualityOverride != null);
  const qualityOverride = current.qualityOverride ?? (mayRetainConsent ? savedConsent.qualityOverride : null);
  const minimumBitrateKbps = Math.max(boundedFloor(base?.minimumBitrateKbps), boundedFloor(base?.qualityOverride?.minimumBitrateKbps),
    boundedFloor(current.minimumBitrateKbps), profileCode === 'high_quality' || qualityOverride ? 256 : 0,
    ...participants.map((participant) => participant.qualityPreferences?.minimumQuality === 'high' ? 320 : 0)) || null;
  const ids = getRecheckWantedReleaseIds(candidate);
  return { profileCode, qualityOverride: qualityOverride ? { ...qualityOverride,
    ...(minimumBitrateKbps > 256 ? { minimumBitrateKbps } : {}) } : null,
  ...(minimumBitrateKbps ? { minimumBitrateKbps } : {}), wantedReleaseId: ids.includes(base?.wantedReleaseId) ? base.wantedReleaseId : ids[0],
  ...(ids.length > 1 ? { wantedReleaseIds: ids } : {}), sharedOperatorDiscovery: base?.sharedOperatorDiscovery === true };
}

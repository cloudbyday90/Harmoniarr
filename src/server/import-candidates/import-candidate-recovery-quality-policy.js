/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const PROFILE_PRIORITY = { any_available: 0, high_quality: 1, lossless_archive: 2 };

function boundedFloor(context) {
  const values = [context?.minimumBitrateKbps, context?.qualityOverride?.minimumBitrateKbps];
  const explicitFloor = Math.max(0, ...values.filter((value) => typeof value === 'number'
    && Number.isFinite(value) && value >= 256 && value <= 10_000));
  return Math.max(explicitFloor, context?.profileCode === 'high_quality'
    || context?.qualityOverride?.mode === 'allow_fallback_quality' ? 256 : 0);
}

function wantedIds(context) {
  return [...new Set([context?.wantedReleaseId, ...(Array.isArray(context?.wantedReleaseIds) ? context.wantedReleaseIds : [])]
    .filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].sort();
}

export function requiresRecoveryQualityContextGuard(context) {
  return !Object.hasOwn(PROFILE_PRIORITY, context?.profileCode) || context.profileCode === 'lossless_archive' || boundedFloor(context) > 0
    || context?.qualityOverride?.mode === 'allow_fallback_quality';
}

// Older searches can contain candidates for the same physical release under a
// different household policy. Keep their own durable context; never copy consent.
export function canRetainRecoveryQualityContext({ candidate, failedCandidate, requiredContext }) {
  if (!requiresRecoveryQualityContextGuard(requiredContext)) return true;
  const candidateContext = candidate?.normalizedPayload?.musicQueue;
  // Legacy candidates without a queue context retain the stage gate's strict
  // default; they cannot inherit a target's fallback consent or numeric floor.
  if (candidateContext == null) return (!Object.hasOwn(PROFILE_PRIORITY, requiredContext.profileCode) || requiredContext.profileCode === 'lossless_archive')
    && !requiredContext.qualityOverride && boundedFloor(requiredContext) === 0;
  if (!candidateContext || !Object.hasOwn(PROFILE_PRIORITY, candidateContext.profileCode)
    || PROFILE_PRIORITY[candidateContext.profileCode] < (PROFILE_PRIORITY[requiredContext.profileCode] ?? 2)) return false;
  const requiredIds = wantedIds(failedCandidate?.normalizedPayload?.musicQueue);
  if (requiredIds.length > 0 && JSON.stringify(requiredIds) !== JSON.stringify(wantedIds(candidateContext))) return false;
  const candidateFallback = candidateContext.qualityOverride?.mode === 'allow_fallback_quality';
  if (candidateFallback && (!wantedIds(candidateContext).includes(candidateContext.qualityOverride.wantedReleaseId)
    || candidateContext.qualityOverride.wantedReleaseId !== requiredContext.qualityOverride?.wantedReleaseId)) return false;
  const candidateStrict = candidateContext.profileCode === 'lossless_archive' && !candidateFallback;
  return candidateStrict || boundedFloor(candidateContext) >= boundedFloor(requiredContext);
}

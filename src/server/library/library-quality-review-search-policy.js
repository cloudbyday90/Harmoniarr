/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { createApiError } from '../auth.js';
import { isMusicQueueRediscoveryInProgress } from '../acquisition/acquisition-rediscovery-policy.js';

const PRIORITY = { any_available: 0, high_quality: 1, lossless_archive: 2 };
export const QUALITY_REVIEW_SEARCH_REASON = 'quality_review_search_again';
export const QUALITY_REVIEW_SEARCH_BLOCKER = 'quality_review_search_not_current';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value);

export function hasQueuedQualityReviewSearch(release) {
  const request = release?.discoveryRequest;
  const marker = request?.evidence?.musicQueueRediscovery;
  const saved = marker?.qualityReviewRequirement;
  return Boolean(isMusicQueueRediscoveryInProgress(request) && marker.reasonCode === QUALITY_REVIEW_SEARCH_REASON
    && Array.isArray(saved?.wantedReleaseIds) && saved.wantedReleaseIds.includes(release.id) && saved.sourceSearchId === request.evidence.lastSearchId
    && saved.failedCandidateId === release.libraryAddRecoveryFacts?.candidateId
    && release.libraryAddRecoveryFacts.hasConflictingCandidate === false);
}

/** A saved floor never carries another command's consent token. */
export function buildQualityReviewSearchRequirement(scope) {
  return { failedCandidateId: scope.failedCandidate.id, sourceSearchId: scope.failedCandidate.sourceSearchId,
    wantedReleaseIds: scope.wantedReleaseIds, profileCode: scope.requiredContext.profileCode,
    recipients: scope.participants.map(p => ({ wantedReleaseId: p.wantedReleaseId, appUserId: p.appUserId })),
    minimumBitrateKbps: scope.requiredContext.minimumBitrateKbps ?? null,
    fallbackAllowed: scope.requiredContext.qualityOverride != null };
}

export function applyQualityReviewSearchRequirement(context, claimedRequest) {
  const intent = claimedRequest?.evidence?.musicQueueRediscovery;
  if (intent?.reasonCode !== QUALITY_REVIEW_SEARCH_REASON && intent?.qualityReviewRequirement == null) return context;
  const saved = intent.qualityReviewRequirement;
  const ids = saved?.wantedReleaseIds;
  const currentIds = [...new Set([context.wantedReleaseId, ...(context.wantedReleaseIds ?? [])].filter(Boolean))].sort();
  if (!saved || !uuid(saved.failedCandidateId) || typeof saved.sourceSearchId !== 'string' || !saved.sourceSearchId.trim()
    || !Object.hasOwn(PRIORITY, saved.profileCode) || typeof saved.fallbackAllowed !== 'boolean'
    || !Array.isArray(ids) || !ids.length || !ids.every(uuid) || new Set(ids).size !== ids.length
    || JSON.stringify([...ids].sort()) !== JSON.stringify(currentIds)
    || !Array.isArray(saved.recipients) || saved.recipients.length !== ids.length
    || new Set(saved.recipients.map(p => p?.wantedReleaseId)).size !== ids.length
    || saved.recipients.some(p => !uuid(p?.appUserId) || !ids.includes(p?.wantedReleaseId)
      || !claimedRequest.operatorLinks?.some(link => link.wantedReleaseId === p.wantedReleaseId && link.appUserId === p.appUserId))
    || claimedRequest.qualityReviewParticipantsCurrent !== true
    || claimedRequest.operatorLinks?.some(link => link.isDisabled === true)
    || (saved.minimumBitrateKbps != null && (typeof saved.minimumBitrateKbps !== 'number'
      || !Number.isFinite(saved.minimumBitrateKbps) || saved.minimumBitrateKbps < 256 || saved.minimumBitrateKbps > 10_000))) {
    throw createApiError(409, QUALITY_REVIEW_SEARCH_BLOCKER, 'This quality-review search no longer has its original recipient scope');
  }
  const profileCode = PRIORITY[saved.profileCode] > (PRIORITY[context.profileCode] ?? -1) ? saved.profileCode : context.profileCode;
  const minimumBitrateKbps = Math.max(context.minimumBitrateKbps ?? 0, saved.minimumBitrateKbps ?? 0) || null;
  const qualityOverride = saved.profileCode === 'lossless_archive' && !saved.fallbackAllowed ? null : context.qualityOverride;
  return { ...context, profileCode, qualityOverride, ...(minimumBitrateKbps ? { minimumBitrateKbps } : {}) };
}

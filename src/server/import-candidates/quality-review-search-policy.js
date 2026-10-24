/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';
import { qualityReviewCursorContext } from './import-candidate-quality-review-cursor-policy.js';

export const QUALITY_REVIEW_SEARCH_OPERATION = 'quality_review_search';
export const QUALITY_REVIEW_SEARCH_TTL_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const qualityReviewSearchBusy = () => createApiError(409, 'quality_review_search_busy',
  'Available matches are changing. Refresh this release and try again.');
export const qualityReviewSearchUnavailable = () => createApiError(409, 'music_queue_retry_not_available',
  'Review the available matches before searching again');

export function assertQualityReviewSearchProgress(progress, now) {
  if (!progress || !UUID.test(progress.failedCandidateId) || !UUID.test(progress.revision)
    || (progress.anchor !== null && !UUID.test(progress.anchor)) || !/^[a-f0-9]{64}$/u.test(progress.context)
    || !Number.isSafeInteger(progress.steps) || progress.steps < 1 || progress.steps >= 500
    || !Number.isSafeInteger(progress.invalidations) || progress.invalidations < 0 || progress.invalidations > 3
    || !Number.isSafeInteger(progress.expiresAt) || progress.expiresAt <= now || progress.state !== 'incomplete') {
    throw createApiError(409, 'quality_review_search_expired', 'The match check expired. Refresh this release and try again.');
  }
}

export function qualityReviewSearchContext(input, scope, revision) {
  return qualityReviewCursorContext({ appUserId: input.appUserId, wantedReleaseId: input.wantedReleaseId,
    actorUserId: input.actorUserId }, scope, revision);
}

export function advanceQualityReviewSearchProgress({ progress = null, context, revision, now, scan, failedCandidateId }) {
  const invalidated = progress != null && progress.context !== context;
  const invalidations = (progress?.invalidations ?? 0) + Number(invalidated);
  const steps = (progress?.steps ?? 0) + 1;
  const expiresAt = progress?.expiresAt ?? now + QUALITY_REVIEW_SEARCH_TTL_MS;
  if (invalidations > 3 || steps > 500 || expiresAt <= now) {
    throw createApiError(409, 'quality_review_search_expired', 'The match check expired. Refresh this release and try again.');
  }
  return { context, revision, failedCandidateId, anchor: scan.afterId, steps, invalidations, expiresAt,
    state: scan.candidates.length ? 'found' : scan.exhausted ? 'exhausted' : 'incomplete' };
}

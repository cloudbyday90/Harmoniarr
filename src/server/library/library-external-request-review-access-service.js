/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';

export function normalizeExternalReviewId(value, name) {
  if (typeof value !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
    throw createApiError(400, 'validation_error', `${name} must be a UUID`);
  }
  return value.toLowerCase();
}

export function createLibraryExternalRequestReviewAccessService({ mediaRequestStore, getAppUserById }) {
  async function loadRequest(mediaRequestId, queryable = null) {
    normalizeExternalReviewId(mediaRequestId, 'mediaRequestId');
    const request = await mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
    if (!request) throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    if (request.requestKind !== 'external_url') throw createApiError(409, 'external_request_required', 'Provider review requires an external request');
    if (request.requestState !== 'needs_fetch') throw createApiError(409, 'external_request_inactive', 'This request is no longer awaiting acquisition');
    return request;
  }

  async function assertEligibleTarget(request, queryable = null) {
    const user = request.requestedForUser?.id
      ? await getAppUserById({ userId: request.requestedForUser.id, queryable }) : null;
    if (!buildMediaRequestTargetEligibility(user).eligible) {
      throw createApiError(409, 'media_request_target_ineligible', 'The request target is not currently eligible for music requests');
    }
  }
  return { loadRequest, assertEligibleTarget };
}

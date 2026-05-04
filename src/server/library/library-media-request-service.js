/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';
import { createMetadataSearchService } from '../metadata/metadata-search-service.js';
import { normalizeExternalMediaSource } from './external-media-source-parser.js';
import { createLibraryMediaRequestFulfillmentService } from './library-media-request-fulfillment-service.js';
import { createLibraryReleaseAvailabilityStore } from './library-release-availability-store.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';

const supportedExternalProviders = new Map([
  ['spotify.com', 'spotify'],
  ['open.spotify.com', 'spotify'],
  ['youtube.com', 'youtube'],
  ['www.youtube.com', 'youtube'],
  ['music.youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['music.apple.com', 'apple_music'],
]);

function normalizeRequiredText(value, fieldName, { maxLength = 200 } = {}) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function normalizeOptionalText(value, fieldName, { maxLength = 200 } = {}) {
  if (value == null || value === '') {
    return null;
  }

  return normalizeRequiredText(value, fieldName, { maxLength });
}

function normalizeRequestKind(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'requestKind must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!['release', 'track', 'external_url'].includes(normalized)) {
    throw createApiError(400, 'validation_error', 'requestKind must be one of: release, track, external_url');
  }

  return normalized;
}

function normalizeOptionalUserId(value, fieldName) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeComparableText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function textLooksRelated(actual, expected) {
  const normalizedActual = normalizeComparableText(actual);
  const normalizedExpected = normalizeComparableText(expected);

  if (!normalizedActual || !normalizedExpected) {
    return false;
  }

  return normalizedActual === normalizedExpected
    || normalizedActual.includes(normalizedExpected)
    || normalizedExpected.includes(normalizedActual);
}

function detectExternalProvider(sourceUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw createApiError(400, 'validation_error', 'sourceUrl must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw createApiError(400, 'validation_error', 'sourceUrl must use http or https');
  }

  return supportedExternalProviders.get(parsedUrl.hostname.toLowerCase()) ?? null;
}

function buildSummaryMessage(fulfillmentCounts) {
  if (fulfillmentCounts.totalRequests === 0) {
    return {
      message: 'No music requests have been submitted yet.',
      status: 'empty',
    };
  }

  if (fulfillmentCounts.failed > 0) {
    return {
      message: `${fulfillmentCounts.failed} request${fulfillmentCounts.failed === 1 ? ' needs' : 's need'} operator attention before fulfillment can complete.`,
      status: 'attention',
    };
  }

  if (fulfillmentCounts.active > 0) {
    return {
      message: `${fulfillmentCounts.active} request${fulfillmentCounts.active === 1 ? ' is' : 's are'} queued, downloading, or waiting for import apply.`,
      status: 'active',
    };
  }

  if (fulfillmentCounts.underReview > 0) {
    return {
      message: `${fulfillmentCounts.underReview} request${fulfillmentCounts.underReview === 1 ? ' is' : 's are'} still under review before fulfillment can continue.`,
      status: 'attention',
    };
  }

  return {
    message: `${fulfillmentCounts.satisfied} request${fulfillmentCounts.satisfied === 1 ? ' is' : 's are'} already available or fulfilled.`,
    status: 'satisfied',
  };
}

function validateDraft(payload) {
  const requestKind = normalizeRequestKind(payload.requestKind);
  const notes = normalizeOptionalText(payload.notes, 'notes', { maxLength: 2000 });

  if (requestKind === 'external_url') {
    return {
      artistName: null,
      notes,
      releaseTitle: null,
      requestKind,
      sourceUrl: normalizeRequiredText(payload.sourceUrl, 'sourceUrl', { maxLength: 2048 }),
      trackTitle: null,
    };
  }

  const artistName = normalizeRequiredText(payload.artistName, 'artistName');

  if (requestKind === 'release') {
    return {
      artistName,
      notes,
      releaseTitle: normalizeRequiredText(payload.releaseTitle, 'releaseTitle'),
      requestKind,
      sourceUrl: null,
      trackTitle: null,
    };
  }

  return {
    artistName,
    notes,
    releaseTitle: normalizeOptionalText(payload.releaseTitle, 'releaseTitle'),
    requestKind,
    sourceUrl: null,
    trackTitle: normalizeRequiredText(payload.trackTitle, 'trackTitle'),
  };
}

function buildNormalizedQuery({ artistName, releaseTitle, requestKind, sourceUrl, trackTitle }) {
  if (requestKind === 'external_url') {
    return sourceUrl;
  }

  return [artistName, releaseTitle, trackTitle]
    .filter(Boolean)
    .join(' ');
}

function findExistingRelease(results, { artistName, releaseTitle }) {
  return results.find((result) => {
    const artistMatches = textLooksRelated(result.artistName, artistName);
    const releaseMatches = releaseTitle ? textLooksRelated(result.title, releaseTitle) : true;
    return artistMatches && releaseMatches;
  }) ?? null;
}

export function createLibraryMediaRequestService({
  externalIntakeService = null,
  getAppUserById = null,
  mediaRequestStore = createLibraryMediaRequestStore(),
  mediaRequestFulfillmentService = createLibraryMediaRequestFulfillmentService(),
  metadataSearchService = createMetadataSearchService(),
  releaseAvailabilityStore = createLibraryReleaseAvailabilityStore(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function resolveRequestedForUserId({ actorUserId, actorUserRole, requestedForUserId }) {
    const normalizedRequestedForUserId = normalizeOptionalUserId(requestedForUserId, 'requestedForUserId');

    if (!normalizedRequestedForUserId || normalizedRequestedForUserId === actorUserId) {
      return actorUserId;
    }

    if (actorUserRole !== 'admin') {
      throw createApiError(403, 'forbidden', 'Only administrators can submit music requests for another user');
    }

    if (typeof getAppUserById !== 'function') {
      throw new Error('Delegated media request targeting requires getAppUserById');
    }

    const targetUser = await getAppUserById({ userId: normalizedRequestedForUserId });
    if (!targetUser) {
      throw createApiError(404, 'app_user_not_found', 'The requested request-target user could not be found');
    }

    const targetEligibility = buildMediaRequestTargetEligibility(targetUser);
    if (!targetEligibility.eligible) {
      throw createApiError(409, 'media_request_target_ineligible', 'The requested user is not currently eligible for delegated music requests');
    }

    return targetUser.id;
  }

  async function createMediaRequest({ actorUserId, actorUserRole = null, payload, requestMetadata }) {
    const draft = validateDraft(payload ?? {});
    const normalizedQuery = buildNormalizedQuery(draft);
    const requestedForUserId = await resolveRequestedForUserId({
      actorUserId,
      actorUserRole,
      requestedForUserId: payload?.requestedForUserId,
    });

    let matchedMetadataReleaseGroupId = null;
    let matchedMetadataReleaseId = null;
    let requestState = 'needs_fetch';
    let sourceProvider = null;
    let evidence = {
      classificationStrategy: draft.requestKind === 'external_url'
        ? 'external_url_provider_detection'
        : 'local_metadata_release_search',
    };

    if (draft.requestKind === 'external_url') {
      sourceProvider = detectExternalProvider(draft.sourceUrl);
      requestState = sourceProvider ? 'needs_fetch' : 'needs_review';
      evidence = {
        ...evidence,
        providerSupported: Boolean(sourceProvider),
      };
    } else {
      const releaseSearch = await metadataSearchService.searchReleases({
        limit: 5,
        query: normalizedQuery,
      });
      const matchedRelease = findExistingRelease(releaseSearch.results, {
        artistName: draft.artistName,
        releaseTitle: draft.releaseTitle,
      });

      evidence = {
        ...evidence,
        localReleaseResultCount: releaseSearch.results.length,
      };

      if (matchedRelease) {
        const releaseAvailability = await releaseAvailabilityStore.getReleaseAvailability({
          metadataReleaseId: matchedRelease.id,
        });

        matchedMetadataReleaseGroupId = releaseAvailability?.metadataReleaseGroupId ?? matchedRelease.releaseGroupId ?? null;
        matchedMetadataReleaseId = matchedRelease.id;
        requestState = releaseAvailability?.reconciliationStatus === 'complete'
          ? 'already_exists'
          : 'needs_fetch';
        evidence = {
          ...evidence,
          releaseAvailabilityStatus: releaseAvailability?.reconciliationStatus ?? 'missing',
          matchedReleaseId: matchedRelease.id,
        };
      }
    }

    const mediaRequest = await mediaRequestStore.createMediaRequest({
      artistName: draft.artistName,
      evidence,
      matchedMetadataReleaseGroupId,
      matchedMetadataReleaseId,
      normalizedQuery,
      notes: draft.notes,
      releaseTitle: draft.releaseTitle,
      requestKind: draft.requestKind,
      requestState,
      requestedByUserId: actorUserId,
      requestedForUserId,
      sourceProvider,
      sourceUrl: draft.sourceUrl,
      trackTitle: draft.trackTitle,
    });

    await recordAuditEventFn({
      actorType: 'app_user',
      actorUserId,
      details: {
        delegated: requestedForUserId !== actorUserId,
        requestId: mediaRequest.id,
        requestKind: mediaRequest.requestKind,
        requestState: mediaRequest.requestState,
        requestedForUserId,
      },
      entityId: mediaRequest.id,
      entityType: 'media_request',
      eventType: 'media_request_created',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Created ${mediaRequest.requestKind} music request as ${mediaRequest.requestState}`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    if (
      mediaRequest.requestKind === 'external_url'
      && mediaRequest.requestState === 'needs_fetch'
      && mediaRequest.sourceUrl
      && externalIntakeService?.queueExternalMediaRequestPlanning
    ) {
      const normalizedSource = normalizeExternalMediaSource(mediaRequest.sourceUrl);
      if (normalizedSource) {
        await externalIntakeService.queueExternalMediaRequestPlanning({
          mediaRequestId: mediaRequest.id,
          normalizedSource,
          requestMetadata,
          triggerSource: 'request_submit',
          triggeredByUserId: actorUserId,
        });
      }
    }

    return mediaRequest;
  }

  async function listMediaRequests({ requestedForUserId = null } = {}) {
    const mediaRequests = await mediaRequestStore.listMediaRequests({ requestedForUserId });
    return mediaRequestFulfillmentService.enrichMediaRequests(mediaRequests);
  }

  async function buildMediaRequestSummary({ requestedForUserId = null } = {}) {
    const [counts, mediaRequests] = await Promise.all([
      mediaRequestStore.getMediaRequestCounts({ requestedForUserId }),
      listMediaRequests({ requestedForUserId }),
    ]);
    const fulfillmentCounts = mediaRequestFulfillmentService.buildMediaRequestFulfillmentCounts(mediaRequests);

    return {
      counts,
      fulfillmentCounts,
      recentRequests: mediaRequests.slice(0, 5),
      summary: buildSummaryMessage(fulfillmentCounts),
    };
  }

  return {
    buildMediaRequestSummary,
    createMediaRequest,
    listMediaRequests,
  };
}
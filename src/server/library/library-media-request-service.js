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
import { createLibraryMediaRequestNotificationService } from './library-media-request-notification-service.js';
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

function normalizeOptionalMbReleaseId(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeOptionalDate(value, fieldName) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a date string`);
  }

  const normalized = value.trim();
  // Accept YYYY, YYYY-MM, or YYYY-MM-DD
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(normalized)) {
    throw createApiError(400, 'validation_error', `${fieldName} must be a date in YYYY, YYYY-MM, or YYYY-MM-DD format`);
  }

  return normalized;
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

async function findLocalMetadataRelease({
  artistName,
  metadataSearchService,
  normalizedQuery,
  releaseTitle,
}) {
  const releaseSearch = await metadataSearchService.searchReleases({
    limit: 5,
    query: normalizedQuery,
  });
  let matchedRelease = findExistingRelease(releaseSearch.results, {
    artistName,
    releaseTitle,
  });

  const searchEvidence = {
    localReleaseMatchStrategy: matchedRelease ? 'combined_query' : 'none',
    localReleaseResultCount: releaseSearch.results.length,
  };

  if (
    matchedRelease
    || !releaseTitle
    || typeof metadataSearchService.searchReleasesByArtistAndTitle !== 'function'
  ) {
    return {
      matchedRelease,
      searchEvidence,
    };
  }

  const structuredReleaseSearch = await metadataSearchService.searchReleasesByArtistAndTitle({
    artistName,
    limit: 5,
    releaseTitle,
  });
  matchedRelease = findExistingRelease(structuredReleaseSearch.results, {
    artistName,
    releaseTitle,
  });

  return {
    matchedRelease,
    searchEvidence: {
      ...searchEvidence,
      localReleaseMatchStrategy: matchedRelease ? 'structured_artist_title' : 'none',
      structuredLocalReleaseResultCount: structuredReleaseSearch.results.length,
    },
  };
}

function normalizeOptionalUserIdList(value, fieldName) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((item) => {
      if (typeof item !== 'string') return null;
      const trimmed = item.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return null;
  }

  const unique = [...new Set(normalized)];
  if (unique.length > 50) {
    throw createApiError(400, 'validation_error', `${fieldName} must contain 50 user IDs or fewer`);
  }

  return unique;
}

export function createLibraryMediaRequestService({
  externalIntakeService = null,
  getAppUserById = null,
  mediaRequestStore = createLibraryMediaRequestStore(),
  mediaRequestFulfillmentService = createLibraryMediaRequestFulfillmentService(),
  mediaRequestNotificationService = createLibraryMediaRequestNotificationService(),
  metadataSearchService = createMetadataSearchService(),
  releaseAvailabilityStore = createLibraryReleaseAvailabilityStore(),
  recordActivityEventFn = null,
  recordAuditEventFn = recordAuditEvent,
  onRequestCreatedFn = null,
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

  async function resolveRequestedForUserIds({ actorUserRole, requestedForUserIds }) {
    if (!Array.isArray(requestedForUserIds) || requestedForUserIds.length === 0) {
      return null;
    }

    if (actorUserRole !== 'admin') {
      throw createApiError(403, 'forbidden', 'Only administrators can submit music requests for other users');
    }

    if (typeof getAppUserById !== 'function') {
      throw new Error('Multi-target media request requires getAppUserById');
    }

    const resolved = [];
    const ineligible = [];

    for (const rawId of requestedForUserIds) {
      const normalizedId = normalizeOptionalUserId(rawId, 'requestedForUserIds');
      if (!normalizedId) continue;

      const targetUser = await getAppUserById({ userId: normalizedId });
      if (!targetUser) {
        throw createApiError(404, 'app_user_not_found', `Request-target user ${normalizedId} could not be found`);
      }

      const eligibility = buildMediaRequestTargetEligibility(targetUser);
      if (!eligibility.eligible) {
        ineligible.push({ id: targetUser.id, username: targetUser.username, reasonCode: eligibility.reasonCode });
        continue;
      }

      resolved.push(targetUser);
    }

    return { ineligible, resolved };
  }

  async function createMediaRequest({ actorUserId, actorUserRole = null, payload, requestMetadata }) {
    const draft = validateDraft(payload ?? {});
    const normalizedQuery = buildNormalizedQuery(draft);
    const expectedReleaseDate = normalizeOptionalDate(payload?.expectedReleaseDate, 'expectedReleaseDate');
    const requestedForUserIds = normalizeOptionalUserIdList(payload?.requestedForUserIds, 'requestedForUserIds');

    if (requestedForUserIds && requestedForUserIds.length > 1) {
      return createFanOutMediaRequest({
        actorUserId,
        actorUserRole,
        draft,
        expectedReleaseDate,
        normalizedQuery,
        payload,
        requestedForUserIds,
        requestMetadata,
      });
    }

    const singleTargetOverride = requestedForUserIds?.length === 1
      ? requestedForUserIds[0]
      : payload?.requestedForUserId;

    const requestedForUserId = await resolveRequestedForUserId({
      actorUserId,
      actorUserRole,
      requestedForUserId: singleTargetOverride,
    });

    return createSingleMediaRequest({
      actorUserId,
      draft,
      expectedReleaseDate,
      normalizedQuery,
      payload,
      requestedForUserId,
      requestMetadata,
    });
  }

  async function createSingleMediaRequest({
    actorUserId,
    draft,
    expectedReleaseDate,
    normalizedQuery,
    payload,
    requestedForUserId,
    requestMetadata,
    fanOutParentId = null,
    fanOutChildCount = 0,
  }) {
    let matchedMetadataReleaseGroupId = null;
    let matchedMetadataReleaseId = null;
    let musicbrainzReleaseId = normalizeOptionalMbReleaseId(payload?.musicbrainzReleaseId);
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
      const { matchedRelease, searchEvidence } = await findLocalMetadataRelease({
        artistName: draft.artistName,
        metadataSearchService,
        normalizedQuery,
        releaseTitle: draft.releaseTitle,
      });

      evidence = {
        ...evidence,
        ...searchEvidence,
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

    let linkedRequestId = null;
    let linked = false;

    if (requestState !== 'already_exists' && draft.requestKind !== 'external_url') {
      const existingRequest = await mediaRequestStore.findActiveDuplicateRequest({
        musicbrainzReleaseId,
        artistName: draft.artistName,
        releaseTitle: draft.releaseTitle,
        excludeRequestedForUserId: requestedForUserId,
      });

      if (existingRequest) {
        linkedRequestId = existingRequest.id;
        linked = true;
        evidence = {
          ...evidence,
          dedupLinkedToRequestId: existingRequest.id,
          dedupMatchMethod: musicbrainzReleaseId ? 'musicbrainz_release_id' : 'artist_title_text',
        };
      }
    }

    const mediaRequest = await mediaRequestStore.createMediaRequest({
      artistName: draft.artistName,
      evidence,
      expectedReleaseDate,
      fanOutChildCount,
      fanOutParentId,
      linkedRequestId,
      matchedMetadataReleaseGroupId,
      matchedMetadataReleaseId,
      musicbrainzReleaseId,
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
        fanOutChildCount,
        fanOutParentId,
        linked,
        linkedToRequestId: linkedRequestId,
        requestId: mediaRequest.id,
        requestKind: mediaRequest.requestKind,
        requestState: mediaRequest.requestState,
        requestedForUserId,
      },
      entityId: mediaRequest.id,
      entityType: 'media_request',
      eventType: 'media_request_created',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Created ${mediaRequest.requestKind} music request as ${mediaRequest.requestState}${linked ? ' (linked to existing request)' : ''}${fanOutParentId ? ' (fan-out child)' : ''}`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    if (typeof recordActivityEventFn === 'function') {
      void recordActivityEventFn({
        actorUserId,
        entityArtist: draft.artistName ?? null,
        entityId: mediaRequest.id,
        entityTitle: draft.releaseTitle ?? draft.artistName ?? null,
        entityType: 'media_request',
        eventType: 'request_created',
      }).catch(() => {});
    }

    if (typeof onRequestCreatedFn === 'function') {
      void onRequestCreatedFn({
        actorUserId,
        artistName: draft.artistName ?? null,
        requestKind: draft.requestKind,
        releaseTitle: draft.releaseTitle ?? null,
      }).catch(() => {});
    }

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

    return { ...mediaRequest, linked };
  }

  async function createFanOutMediaRequest({
    actorUserId,
    actorUserRole,
    draft,
    expectedReleaseDate,
    normalizedQuery,
    payload,
    requestedForUserIds,
    requestMetadata,
  }) {
    const { ineligible, resolved } = await resolveRequestedForUserIds({
      actorUserId,
      actorUserRole,
      requestedForUserIds,
    });

    if (resolved.length === 0) {
      throw createApiError(409, 'media_request_no_eligible_targets', 'No eligible target users were found for the multi-target request');
    }

    const firstTargetUserId = resolved[0].id;

    const parentRequest = await createSingleMediaRequest({
      actorUserId,
      draft,
      expectedReleaseDate,
      normalizedQuery,
      payload,
      requestedForUserId: firstTargetUserId,
      requestMetadata,
    });

    if (resolved.length <= 1) {
      return {
        ...parentRequest,
        fanOut: { childCount: 0, ineligible, totalTargets: resolved.length },
      };
    }

    const additionalTargetIds = resolved.slice(1).map((user) => user.id);
    const fanOutChildren = await mediaRequestStore.createFanOutChildRequests({
      parentRequest,
      targetUserIds: additionalTargetIds,
      linkedRequestId: parentRequest.linkedRequestId,
    });

    const childCount = fanOutChildren.length;
    await mediaRequestStore.updateFanOutChildCount({
      mediaRequestId: parentRequest.id,
      childCount,
    });

    for (const child of fanOutChildren) {
      if (typeof recordActivityEventFn === 'function') {
        void recordActivityEventFn({
          actorUserId,
          entityArtist: draft.artistName ?? null,
          entityId: child.id,
          entityTitle: draft.releaseTitle ?? draft.artistName ?? null,
          entityType: 'media_request',
          eventType: 'request_created',
        }).catch(() => {});
      }
    }

    await recordAuditEventFn({
      actorType: 'app_user',
      actorUserId,
      details: {
        fanOutChildCount: childCount,
        ineligibleCount: ineligible.length,
        parentRequestId: parentRequest.id,
        targetUserCount: resolved.length,
      },
      entityId: parentRequest.id,
      entityType: 'media_request',
      eventType: 'media_request_fan_out_created',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Created fan-out media request for ${resolved.length} users (${childCount} children)`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    if (typeof onRequestCreatedFn === 'function') {
      void onRequestCreatedFn({
        actorUserId,
        artistName: draft.artistName ?? null,
        requestKind: draft.requestKind,
        releaseTitle: draft.releaseTitle ?? null,
      }).catch(() => {});
    }

    return {
      ...parentRequest,
      fanOutChildCount: childCount,
      fanOut: {
        childCount,
        children: fanOutChildren.map((child) => child.id),
        ineligible,
        totalTargets: resolved.length,
      },
    };
  }

  async function listMediaRequests({
    requestedForUserId = null,
    requestState = null,
    requestKind = null,
    search = null,
    limit = null,
    offset = null,
    cursor = null,
  } = {}) {
    const filterParams = { requestedForUserId, requestState, requestKind, search };
    const storeResult = await mediaRequestStore.listMediaRequests({ ...filterParams, limit, offset, cursor });

    if (cursor) {
      const enrichedRequests = await mediaRequestFulfillmentService.enrichMediaRequests(storeResult.mediaRequests);
      return {
        mediaRequests: enrichedRequests,
        hasMore: storeResult.hasMore,
        nextCursor: storeResult.nextCursor,
      };
    }

    const totalCount = await mediaRequestStore.countMediaRequests(filterParams);
    const enrichedRequests = await mediaRequestFulfillmentService.enrichMediaRequests(storeResult.mediaRequests);
    return {
      mediaRequests: enrichedRequests,
      totalCount,
    };
  }

  async function buildMediaRequestSummary({ requestedForUserId = null } = {}) {
    const [counts, listResult] = await Promise.all([
      mediaRequestStore.getMediaRequestCounts({ requestedForUserId }),
      listMediaRequests({ requestedForUserId }),
    ]);
    const { mediaRequests } = listResult;
    const fulfillmentCounts = mediaRequestFulfillmentService.buildMediaRequestFulfillmentCounts(mediaRequests);
    const notificationFeed = mediaRequestNotificationService.buildNotifications({
      mediaRequests,
    });

    return {
      counts,
      fulfillmentCounts,
      notificationFeed,
      recentRequests: mediaRequests.slice(0, 5),
      summary: buildSummaryMessage(fulfillmentCounts),
    };
  }

  async function reassignMediaRequest({
    actorUserId,
    actorUserRole = null,
    mediaRequestId,
    newRequestedForUserId,
    reason,
    requestMetadata = null,
  }) {
    if (actorUserRole !== 'admin') {
      throw createApiError(403, 'forbidden', 'Only administrators can reassign media requests');
    }

    const normalizedReason = normalizeOptionalText(reason, 'reason', { maxLength: 500 });
    const normalizedNewUserId = normalizeRequiredText(newRequestedForUserId, 'newRequestedForUserId');

    const existingRequest = await mediaRequestStore.getMediaRequestById({ mediaRequestId });
    if (!existingRequest) {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    }

    const currentForUserId = existingRequest.requestedForUser?.id;
    if (currentForUserId === normalizedNewUserId) {
      throw createApiError(409, 'reassignment_noop', 'The media request is already assigned to the specified user');
    }

    if (typeof getAppUserById !== 'function') {
      throw new Error('Media request reassignment requires getAppUserById');
    }

    const targetUser = await getAppUserById({ userId: normalizedNewUserId });
    if (!targetUser) {
      throw createApiError(404, 'app_user_not_found', 'The target user could not be found');
    }

    const targetEligibility = buildMediaRequestTargetEligibility(targetUser);
    if (!targetEligibility.eligible) {
      throw createApiError(409, 'media_request_target_ineligible', 'The target user is not currently eligible for media requests');
    }

    const updated = await mediaRequestStore.updateRequestedForUserId({
      mediaRequestId,
      newRequestedForUserId: normalizedNewUserId,
    });

    if (!updated) {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be updated');
    }

    await mediaRequestStore.insertMediaRequestEvent({
      actorUserId,
      details: {
        artistName: existingRequest.artistName,
        releaseTitle: existingRequest.releaseTitle,
        requestKind: existingRequest.requestKind,
        requestState: existingRequest.requestState,
      },
      eventType: 'reassigned',
      mediaRequestId,
      newRequestedForUserId: normalizedNewUserId,
      previousRequestedForUserId: currentForUserId,
      reason: normalizedReason,
    });

    const reassignedRequest = await mediaRequestStore.getMediaRequestById({ mediaRequestId });

    await recordAuditEventFn({
      actorType: 'app_user',
      actorUserId,
      details: {
        newRequestedForUserId: normalizedNewUserId,
        previousRequestedForUserId: currentForUserId,
        reason: normalizedReason,
        requestId: mediaRequestId,
      },
      entityId: mediaRequestId,
      entityType: 'media_request',
      eventType: 'media_request_reassigned',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Reassigned media request from user ${currentForUserId} to user ${normalizedNewUserId}${normalizedReason ? `: ${normalizedReason}` : ''}`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    if (typeof recordActivityEventFn === 'function') {
      void recordActivityEventFn({
        actorUserId,
        entityArtist: existingRequest.artistName ?? null,
        entityId: mediaRequestId,
        entityTitle: existingRequest.releaseTitle ?? existingRequest.artistName ?? null,
        entityType: 'media_request',
        eventType: 'request_reassigned',
      }).catch(() => {});
    }

    return reassignedRequest;
  }

  async function getMediaRequestReassignmentHistory({ mediaRequestId, limit = 50 } = {}) {
    const result = await mediaRequestStore.listMediaRequestEvents({ mediaRequestId, limit });
    return result.events;
  }

  async function listMediaRequestEventsPage({ mediaRequestId, cursor, limit = 50 }) {
    return mediaRequestStore.listMediaRequestEvents({ mediaRequestId, cursor, limit });
  }

  async function buildMediaRequestDetail({ mediaRequestId }) {
    const mediaRequest = await mediaRequestStore.getMediaRequestById({ mediaRequestId });

    if (!mediaRequest) {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    }

    const [enriched] = await mediaRequestFulfillmentService.enrichMediaRequests([mediaRequest]);
    const eventResult = await mediaRequestStore.listMediaRequestEvents({ mediaRequestId, limit: 50 });

    return {
      events: eventResult.events,
      hasMoreEvents: eventResult.hasMore,
      mediaRequest: enriched,
      nextCursor: eventResult.nextCursor,
    };
  }

  async function cancelMediaRequest({
    actorUserId,
    actorUserRole = null,
    mediaRequestId,
    reason,
    requestMetadata = null,
  }) {
    const existingRequest = await mediaRequestStore.getMediaRequestById({ mediaRequestId });
    if (!existingRequest) {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    }

    if (existingRequest.requestState === 'cancelled') {
      throw createApiError(409, 'request_already_cancelled', 'This request is already cancelled');
    }

    const isOwnRequest = existingRequest.requestedForUser?.id === actorUserId
      || existingRequest.requestedByUser?.id === actorUserId;

    if (actorUserRole !== 'admin' && !isOwnRequest) {
      throw createApiError(403, 'forbidden', 'You can only cancel your own requests');
    }

    const CANCELLABLE_STATES = ['needs_fetch', 'needs_review'];
    const cancellableStates = new Set(CANCELLABLE_STATES);
    if (!cancellableStates.has(existingRequest.requestState)) {
      throw createApiError(409, 'request_not_cancellable', `Requests in state "${existingRequest.requestState}" cannot be cancelled`);
    }

    const normalizedReason = reason ? normalizeOptionalText(reason, 'reason', { maxLength: 500 }) : null;

    const updated = await mediaRequestStore.updateRequestState({
      mediaRequestId,
      newState: 'cancelled',
    });

    if (!updated) {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be updated');
    }

    let cancelledChildIds = [];

    if (existingRequest.fanOutChildCount > 0) {
      cancelledChildIds = await mediaRequestStore.cancelFanOutChildren({
        parentMediaRequestId: mediaRequestId,
        cancellableStates: CANCELLABLE_STATES,
      });

      for (const childId of cancelledChildIds) {
        await mediaRequestStore.insertMediaRequestEvent({
          actorUserId,
          details: {
            cascadeFromParentId: mediaRequestId,
            previousState: 'needs_fetch',
          },
          eventType: 'cancelled',
          mediaRequestId: childId,
          reason: normalizedReason,
        });
      }

      if (typeof recordAuditEventFn === 'function' && cancelledChildIds.length > 0) {
        void recordAuditEventFn({
          actorType: 'app_user',
          actorUserId,
          details: {
            cancelledChildCount: cancelledChildIds.length,
            parentRequestId: mediaRequestId,
            reason: normalizedReason,
          },
          entityId: mediaRequestId,
          entityType: 'media_request',
          eventType: 'media_request_fan_out_cancelled',
          ipAddress: requestMetadata?.ipAddress ?? null,
          summary: `Cascade-cancelled ${cancelledChildIds.length} fan-out child request${cancelledChildIds.length === 1 ? '' : 's'}`,
          userAgent: requestMetadata?.userAgent ?? null,
        }).catch(() => {});
      }
    }

    await mediaRequestStore.insertMediaRequestEvent({
      actorUserId,
      details: {
        artistName: existingRequest.artistName,
        previousState: existingRequest.requestState,
        releaseTitle: existingRequest.releaseTitle,
        requestKind: existingRequest.requestKind,
      },
      eventType: 'cancelled',
      mediaRequestId,
      reason: normalizedReason,
    });

    if (typeof recordAuditEventFn === 'function') {
      void recordAuditEventFn({
        actorType: 'app_user',
        actorUserId,
        details: {
          previousState: existingRequest.requestState,
          reason: normalizedReason,
          requestId: mediaRequestId,
        },
        entityId: mediaRequestId,
        entityType: 'media_request',
        eventType: 'media_request_cancelled',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: `Cancelled media request${normalizedReason ? `: ${normalizedReason}` : ''}`,
        userAgent: requestMetadata?.userAgent ?? null,
      }).catch(() => {});
    }

    if (typeof recordActivityEventFn === 'function') {
      void recordActivityEventFn({
        actorUserId,
        entityArtist: existingRequest.artistName ?? null,
        entityId: mediaRequestId,
        entityTitle: existingRequest.releaseTitle ?? existingRequest.artistName ?? null,
        entityType: 'media_request',
        eventType: 'request_cancelled',
      }).catch(() => {});
    }

    const cancelledRequest = await mediaRequestStore.getMediaRequestById({ mediaRequestId });
    return {
      ...cancelledRequest,
      cancelledChildCount: cancelledChildIds.length,
    };
  }

  return {
    buildMediaRequestDetail,
    buildMediaRequestSummary,
    cancelMediaRequest,
    createMediaRequest,
    getMediaRequestReassignmentHistory,
    listMediaRequestEventsPage,
    listMediaRequests,
    reassignMediaRequest,
  };
}

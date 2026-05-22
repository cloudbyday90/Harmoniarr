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

  return {
    buildMediaRequestSummary,
    createMediaRequest,
    listMediaRequests,
  };
}
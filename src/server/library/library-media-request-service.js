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
import { createMetadataSearchService } from '../metadata/metadata-search-service.js';
import { normalizeExternalMediaSource } from './external-media-source-parser.js';
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

function buildSummaryMessage(counts) {
  if (counts.totalRequests === 0) {
    return {
      message: 'No music requests have been submitted yet.',
      status: 'empty',
    };
  }

  if (counts.needsFetch > 0) {
    return {
      message: `${counts.needsFetch} request${counts.needsFetch === 1 ? ' is' : 's are'} waiting for fetch and import follow-up.`,
      status: 'active',
    };
  }

  if (counts.needsReview > 0) {
    return {
      message: `${counts.needsReview} request${counts.needsReview === 1 ? ' needs' : 's need'} manual review before provider fetch can continue.`,
      status: 'attention',
    };
  }

  return {
    message: `${counts.alreadyExists} request${counts.alreadyExists === 1 ? ' already maps' : 's already map'} to imported media.`,
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
  mediaRequestStore = createLibraryMediaRequestStore(),
  metadataSearchService = createMetadataSearchService(),
  releaseAvailabilityStore = createLibraryReleaseAvailabilityStore(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function createMediaRequest({ actorUserId, payload, requestMetadata }) {
    const draft = validateDraft(payload ?? {});
    const normalizedQuery = buildNormalizedQuery(draft);

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
      sourceProvider,
      sourceUrl: draft.sourceUrl,
      trackTitle: draft.trackTitle,
    });

    await recordAuditEventFn({
      actorType: 'app_user',
      actorUserId,
      details: {
        requestId: mediaRequest.id,
        requestKind: mediaRequest.requestKind,
        requestState: mediaRequest.requestState,
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

  async function listMediaRequests({ requestedByUserId = null } = {}) {
    return mediaRequestStore.listMediaRequests({ requestedByUserId });
  }

  async function buildMediaRequestSummary({ requestedByUserId = null } = {}) {
    const [counts, recentRequests] = await Promise.all([
      mediaRequestStore.getMediaRequestCounts({ requestedByUserId }),
      mediaRequestStore.listMediaRequests({ requestedByUserId }),
    ]);

    return {
      counts,
      recentRequests: recentRequests.slice(0, 5),
      summary: buildSummaryMessage(counts),
    };
  }

  return {
    buildMediaRequestSummary,
    createMediaRequest,
    listMediaRequests,
  };
}
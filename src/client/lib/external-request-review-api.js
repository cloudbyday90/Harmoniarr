/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { apiRequest, buildQueryString } from './api.js';

function reviewPath(mediaRequestId) {
  return `/api/v1/library/media-requests/${encodeURIComponent(mediaRequestId)}/external-review`;
}

export function fetchExternalRequestReview({ mediaRequestId, cursor, limit, signal }) {
  return apiRequest(`${reviewPath(mediaRequestId)}${buildQueryString({ cursor, limit })}`, { signal });
}

export function searchExternalRequestReleases({ mediaRequestId, artistName, releaseTitle, signal }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/releases${buildQueryString({ artistName, releaseTitle })}`, { signal });
}

export function approveExternalRequestRelease({ mediaRequestId, providerIngestRequestId, metadataReleaseId, expectedRevision }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/approve`, {
    method: 'POST',
    includeCsrf: true,
    body: { providerIngestRequestId, metadataReleaseId, ...(expectedRevision != null ? { expectedRevision } : {}) },
  });
}

export function startExternalRequestCollection({ mediaRequestId, restart = false }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/collection/start`, {
    method: 'POST', includeCsrf: true, body: { restart },
  });
}

export function excludeExternalRequestCollectionItem({ mediaRequestId, collectionItemId, reason, expectedRevision }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/collection/items/${encodeURIComponent(collectionItemId)}/exclude`, {
    method: 'POST', includeCsrf: true, body: { reason, expectedRevision },
  });
}

export function finalizeExternalRequestCollection({ mediaRequestId, expectedRevision }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/collection/finalize`, {
    method: 'POST', includeCsrf: true, body: { expectedRevision },
  });
}

export function recoverExternalRequestPreparation({ mediaRequestId }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/recover`, {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

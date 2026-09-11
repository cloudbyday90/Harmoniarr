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

export function fetchExternalRequestReview({ mediaRequestId, signal }) {
  return apiRequest(reviewPath(mediaRequestId), { signal });
}

export function searchExternalRequestReleases({ mediaRequestId, artistName, releaseTitle, signal }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/releases${buildQueryString({ artistName, releaseTitle })}`, { signal });
}

export function approveExternalRequestRelease({ mediaRequestId, providerIngestRequestId, metadataReleaseId }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/approve`, {
    method: 'POST',
    includeCsrf: true,
    body: { providerIngestRequestId, metadataReleaseId },
  });
}

export function recoverExternalRequestPreparation({ mediaRequestId }) {
  return apiRequest(`${reviewPath(mediaRequestId)}/recover`, {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

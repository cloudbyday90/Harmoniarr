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

/**
 * Pure presentation helpers for OperatorDashboardPanel.
 *
 * Each function is stateless and testable in isolation without a Vue runtime.
 */

/**
 * Extract the 4-digit year from a date string.
 *
 * Accepts YYYY, YYYY-MM, or YYYY-MM-DD formats.  Returns null for falsy input
 * so callers can conditionally render year metadata.
 *
 * @param {string|null|undefined} date
 * @returns {string|null}
 */
export function releaseYear(date) {
  if (!date) return null;
  return date.slice(0, 4);
}

/**
 * Format the display headline for a media-request table row.
 *
 * Routing logic:
 * - `track` requests show "Artist — Track title"
 * - `external_url` requests show the raw source URL
 * - All other kinds (release, album, etc.) show "Artist — Release title"
 *
 * Falls back gracefully when optional fields are absent.
 *
 * @param {{ requestKind?: string, artistName?: string, trackTitle?: string,
 *           releaseTitle?: string, sourceUrl?: string }} request
 * @returns {string}
 */
export function requestHeadline(request) {
  if (request.requestKind === 'track') {
    return `${request.artistName ?? ''} \u2014 ${request.trackTitle ?? ''}`;
  }
  if (request.requestKind === 'external_url') {
    return request.sourceUrl ?? '';
  }
  return `${request.artistName ?? ''} \u2014 ${request.releaseTitle ?? ''}`;
}

/**
 * Map a fulfillment-status object to a design-system tone string.
 *
 * The `tone` field on the fulfillment status object uses internal values
 * ('selected', 'failed') that do not match design-system tone names.  This
 * function normalises them to the shared tone vocabulary used across hx-pill.
 *
 * @param {{ tone?: string }|null|undefined} fulfillmentStatus
 * @returns {'success'|'danger'|'info'}
 */
export function fulfillmentTone(fulfillmentStatus) {
  switch (fulfillmentStatus?.tone) {
    case 'selected': return 'success';
    case 'failed': return 'danger';
    default: return 'info';
  }
}

/**
 * Extract the display label from a fulfillment-status object.
 *
 * Returns the label provided by the server, falling back to "Queued" when the
 * status object is absent or the label field is missing.
 *
 * @param {{ label?: string }|null|undefined} fulfillmentStatus
 * @returns {string}
 */
export function fulfillmentLabel(fulfillmentStatus) {
  return fulfillmentStatus?.label ?? 'Queued';
}

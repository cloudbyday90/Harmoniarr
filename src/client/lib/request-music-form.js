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

import { formatUserRole } from './settings-users-presentation.js';

/**
 * Pure presentational helpers for the request-music intake view.
 *
 * All functions are side-effect-free and testable in isolation under Node.
 */

/**
 * Display label for a request kind.
 *
 * @param {string} requestKind - 'release' | 'track' | 'external_url'
 * @returns {string}
 */
export function getRequestKindLabel(requestKind) {
  switch (requestKind) {
    case 'external_url':
      return 'Playlist or collection URL';
    case 'track':
      return 'Track request';
    default:
      return 'Release request';
  }
}

/**
 * Returns a short display headline summarising a request.
 *
 * @param {{ requestKind: string, artistName?: string, releaseTitle?: string, trackTitle?: string, sourceUrl?: string }} request
 * @returns {string}
 */
export function getRequestHeadline(request) {
  if (request.requestKind === 'external_url') {
    return request.sourceUrl ?? '';
  }

  if (request.requestKind === 'track') {
    return `${request.artistName ?? ''} \u2014 ${request.trackTitle ?? ''}`;
  }

  return `${request.artistName ?? ''} \u2014 ${request.releaseTitle ?? ''}`;
}

/**
 * Maps a request_state value to a requester-friendly display label.
 *
 * Backend states: needs_fetch | needs_review | already_exists
 *
 * @param {string} requestState
 * @returns {string}
 */
export function getRequestStateLabel(requestState) {
  switch (requestState) {
    case 'already_exists':
      return 'Already exists';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    case 'needs_review':
      return 'Needs review';
    default:
      return 'Needs fetch';
  }
}

export function getRequestStateTone(requestState) {
  switch (requestState) {
    case 'cancelled':
      return 'muted';
    case 'failed':
      return 'danger';
    case 'already_exists':
      return 'success';
    case 'needs_review':
      return 'warning';
    default:
      return 'info';
  }
}

export function isRequestCancellable(request) {
  if (!request) return false;
  if (request.requestState === 'cancelled') return false;
  return request.requestState === 'needs_fetch' || request.requestState === 'needs_review';
}

/**
 * Maps a fulfillmentStatus object to an hx-pill tone for visual status display.
 *
 * @param {{ tone?: string } | null | undefined} fulfillmentStatus
 * @returns {'success' | 'danger' | 'info'}
 */
export function getFulfillmentStatusTone(fulfillmentStatus) {
  switch (fulfillmentStatus?.tone) {
    case 'selected':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

/**
 * Extracts the human-readable label from a fulfillmentStatus object.
 *
 * @param {{ label?: string } | null | undefined} fulfillmentStatus
 * @returns {string}
 */
export function getFulfillmentStatusLabel(fulfillmentStatus) {
  return fulfillmentStatus?.label ?? 'Queued';
}

/**
 * Builds the display label shown for a request target in the admin selector.
 *
 * @param {{ id: string, username: string, role: string } | null | undefined} user
 * @param {string} currentUserId
 * @returns {string}
 */
export function getRequestTargetLabel(user, currentUserId) {
  if (!user) return '';

  if (user.id === currentUserId) {
    return `${user.username} (${formatUserRole(user.role)}, you)`;
  }

  return `${user.username} (${formatUserRole(user.role)})`;
}

/**
 * Builds the API submission payload from form state.
 *
 * @param {object} options
 * @param {{ artistName: string, notes: string, releaseTitle: string, requestKind: string, requestedForUserId: string, requestedForUserIds: string[], sourceUrl: string, trackTitle: string }} options.form
 * @param {boolean} options.isAdmin
 * @returns {object}
 */
export function buildMediaRequestPayload({ form, isAdmin }) {
  const payload = {
    notes: form.notes,
    requestKind: form.requestKind,
  };

  if (isAdmin && form.requestedForUserIds && form.requestedForUserIds.length > 0) {
    payload.requestedForUserIds = form.requestedForUserIds;
  } else if (isAdmin && form.requestedForUserId) {
    payload.requestedForUserId = form.requestedForUserId;
  }

  if (form.requestKind === 'external_url') {
    payload.sourceUrl = form.sourceUrl;
    return payload;
  }

  payload.artistName = form.artistName;

  if (form.requestKind === 'track') {
    payload.trackTitle = form.trackTitle;
    payload.releaseTitle = form.releaseTitle;
    return payload;
  }

  payload.releaseTitle = form.releaseTitle;
  return payload;
}

/**
 * Derives the success message shown after a media request is submitted.
 *
 * @param {{ requestState: string, requestedForUser: { id: string, username: string }, fanOutMessage?: string }} mediaRequest
 * @param {string} currentUserId - The ID of the user currently logged in.
 * @returns {string}
 */
export function buildMediaRequestSuccessMessage(mediaRequest, currentUserId) {
  if (mediaRequest.fanOutMessage) {
    return mediaRequest.fanOutMessage;
  }

  const targetUser = mediaRequest.requestedForUser;
  const delegated = Boolean(targetUser && targetUser.id !== currentUserId);

  if (mediaRequest.requestState === 'already_exists') {
    return delegated
      ? `This request already maps to imported media and has been added for ${targetUser.username}.`
      : 'This request already maps to imported media and has been added to your request profile.';
  }

  return delegated
    ? `Music request submitted for ${targetUser.username}.`
    : 'Music request submitted and added to your request profile.';
}

export function getReassignmentEventLabel(eventType) {
  switch (eventType) {
    case 'reassigned':
      return 'Reassigned';
    case 'cancelled':
      return 'Cancelled';
    default:
      return eventType;
  }
}

export function getReassignmentEventTone(eventType) {
  switch (eventType) {
    case 'reassigned':
      return 'info';
    case 'cancelled':
      return 'danger';
    default:
      return 'info';
  }
}

export function formatReassignmentEventDescription(event, usersById) {
  if (!event) return '';

  const actorLabel = event.actorUsername ?? 'Unknown admin';
  const previousUser = usersById[event.previousRequestedForUserId];
  const newUser = usersById[event.newRequestedForUserId];
  const previousLabel = previousUser?.username ?? event.previousRequestedForUserId ?? 'unknown';
  const newLabel = newUser?.username ?? event.newRequestedForUserId ?? 'unknown';

  const parts = [
    `${actorLabel} reassigned from ${previousLabel} to ${newLabel}`,
  ];

  if (event.reason) {
    parts.push(`Reason: ${event.reason}`);
  }

  return parts.join('. ');
}

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
 * Activity event normalization helpers.
 *
 * Maps the `GET /api/v1/activity/feed` event shape to display-ready values.
 * Pure functions — no Vue dependencies — for unit testing without a browser.
 */

/**
 * Normalizes a raw activity event from the API to a display-ready shape.
 *
 * @param {object} event - Raw event object from the server.
 * @returns {object} Normalized display shape.
 */
export function normalizeActivityEvent(event) {
  if (!event) return {};
  return {
    id: event.id ?? null,
    eventType: event.eventType ?? null,
    actorUserId: event.actorUserId ?? null,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    entityTitle: event.entityTitle ?? null,
    entityArtist: event.entityArtist ?? null,
    extraPayload: event.extraPayload ?? null,
    occurredAt: event.occurredAt ?? null,
  };
}

/**
 * Returns the human-readable display label for an activity event.
 *
 * The `request_fulfilled` event renders differently depending on whether the
 * viewer is the requester who owns the request:
 *   - Requester's own: "Your request for [title] is ready"
 *   - Other users:     "[title] added to library"
 *
 * @param {object} event - Normalized activity event.
 * @param {string|null} currentUserId - The viewing user's ID (for request_fulfilled).
 * @returns {string}
 */
export function getActivityEventLabel(event, currentUserId = null) {
  const title = event.entityTitle ?? null;
  const artist = event.entityArtist ?? null;
  const actorId = event.actorUserId ?? null;

  switch (event.eventType) {
    case 'request_created': {
      const subject = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'music';
      return `Music requested: ${subject}`;
    }
    case 'artist_monitored': {
      const artistName = title ?? 'an artist';
      return `Now monitoring ${artistName}`;
    }
    case 'release_added': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `${releaseDesc} added to library`;
    }
    case 'request_fulfilled': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      if (currentUserId && actorId === currentUserId) {
        return `Your request for ${releaseDesc} is ready`;
      }
      return `${releaseDesc} added to library`;
    }
    case 'download_completed': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a file';
      return `Download completed: ${releaseDesc}`;
    }
    default:
      return event.eventType ?? 'Activity';
  }
}

/**
 * Returns a short icon key for a given event type, suitable for mapping to
 * an icon component or CSS class.
 *
 * @param {string|null} eventType
 * @returns {string}
 */
export function getActivityEventIcon(eventType) {
  switch (eventType) {
    case 'request_created':
      return 'music-request';
    case 'artist_monitored':
      return 'artist-monitored';
    case 'release_added':
      return 'release-added';
    case 'request_fulfilled':
      return 'checkmark';
    case 'download_completed':
      return 'download';
    default:
      return 'activity';
  }
}

/**
 * Formats an `occurredAt` (or similar) ISO timestamp for compact activity-feed
 * display, e.g. "May 12, 02:34 PM". Returns an empty string for absent or
 * unparseable values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatActivityEventTime(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

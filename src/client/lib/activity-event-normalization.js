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

import {
  formatReleaseActivityDetail,
  formatReleaseActivitySubject,
  normalizeReleaseActivityPresentation,
} from '../../shared/release-activity-presentation.js';
import { formatArtistPolicyActivityDetail } from './artist-policy-activity-presentation.js';

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
  const releasePresentation = event.eventType === 'release_added'
    ? normalizeReleaseActivityPresentation({
      entityArtist: event.entityArtist ?? null,
      entityTitle: event.entityTitle ?? null,
      extraPayload: event.extraPayload ?? null,
    })
    : null;

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
    releasePresentation,
  };
}

function formatFallbackReleaseSubject(event) {
  const title = event?.entityTitle ?? null;
  const artist = event?.entityArtist ?? null;

  if (title && artist) {
    return `${title} by ${artist}`;
  }

  return title || artist || 'a release';
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
  const requestedForUserId = event.extraPayload?.requestedForUserId ?? event.actorUserId ?? null;

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
    case 'artist_policy_saved': {
      const artistName = title ?? 'an artist';
      return `Artist policy saved for ${artistName}`;
    }
    case 'release_added': {
      const releaseDesc = formatReleaseActivitySubject(
        event.releasePresentation,
        formatFallbackReleaseSubject(event),
      );
      return `${releaseDesc} added to library`;
    }
    case 'request_fulfilled': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      if (currentUserId && requestedForUserId === currentUserId) {
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
    case 'music_queue_match_selected': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Match selected: ${releaseDesc}`;
    }
    case 'music_queue_download_started': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Download started: ${releaseDesc}`;
    }
    case 'music_queue_audio_checked': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Audio checked: ${releaseDesc}`;
    }
    case 'music_queue_audio_warning': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Audio check needs review: ${releaseDesc}`;
    }
    case 'music_queue_audio_check_failed': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Audio check could not run: ${releaseDesc}`;
    }
    case 'music_queue_quality_blocked': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Quality choice needed: ${releaseDesc}`;
    }
    case 'quality_fallback_allowed': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Quality fallback allowed: ${releaseDesc}`;
    }
    case 'music_queue_search_queued': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Search queued: ${releaseDesc}`;
    }
    case 'music_queue_download_retrying': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Retrying download: ${releaseDesc}`;
    }
    case 'music_queue_match_retrying': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Trying the next best match: ${releaseDesc}`;
    }
    case 'music_queue_no_matches_left': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `No good matches left: ${releaseDesc}`;
    }
    case 'music_queue_download_failed': {
      const releaseDesc = title
        ? (artist ? `${title} by ${artist}` : title)
        : 'a release';
      return `Download needs attention: ${releaseDesc}`;
    }
    default:
      return event.eventType ?? 'Activity';
  }
}

export function getActivityEventDetail(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }

  if (event.eventType === 'artist_policy_saved') {
    return formatArtistPolicyActivityDetail(event.extraPayload ?? {});
  }

  if (event.eventType === 'music_queue_quality_blocked') {
    const payload = event.extraPayload ?? {};
    const blocker = Array.isArray(payload.blockers) ? payload.blockers[0] : null;
    return blocker?.message ?? payload.message ?? 'Downloaded files need a quality review before Harmoniarr adds them.';
  }

  if (event.eventType === 'music_queue_match_selected') {
    return event.extraPayload?.selectionMode === 'manual'
      ? 'You selected this match. Harmoniarr will continue the download automatically.'
      : 'Harmoniarr selected the best available match and will continue automatically.';
  }

  if (event.eventType === 'music_queue_download_started') {
    const queuedFileCount = Number(event.extraPayload?.queuedFileCount);
    return Number.isInteger(queuedFileCount) && queuedFileCount > 0
      ? `${queuedFileCount} file${queuedFileCount === 1 ? '' : 's'} accepted for download.`
      : 'The download provider accepted this release.';
  }

  if (event.eventType === 'music_queue_audio_checked') {
    return 'Harmoniarr checked the downloaded audio before adding it to the library.';
  }

  if (event.eventType === 'music_queue_audio_warning') {
    return 'Harmoniarr found an audio warning before adding this release automatically.';
  }

  if (event.eventType === 'music_queue_audio_check_failed') {
    return 'Harmoniarr could not inspect the downloaded audio. Check the media tooling connection.';
  }

  if (event.eventType === 'quality_fallback_allowed') {
    return 'Harmoniarr will continue searching with the updated quality choice.';
  }

  if (event.eventType === 'music_queue_search_queued') {
    return 'Harmoniarr will look for another safe match.';
  }

  if (event.eventType === 'music_queue_download_retrying') {
    return 'The source rejected the transfer. Harmoniarr will try this download again.';
  }

  if (event.eventType === 'music_queue_match_retrying') {
    return 'A download failed. Harmoniarr is trying the next best match.';
  }

  if (event.eventType === 'music_queue_no_matches_left') {
    return event.extraPayload?.rediscoveryScheduled === true
      ? 'Harmoniarr will search again later.'
      : 'Harmoniarr could not find another safe match.';
  }

  if (event.eventType === 'music_queue_download_failed') {
    return 'Harmoniarr could not choose another safe match. Open Music Queue to review what happened.';
  }

  if (event.eventType !== 'release_added') {
    return '';
  }

  return formatReleaseActivityDetail(
    event.releasePresentation
    ?? normalizeReleaseActivityPresentation({
      entityArtist: event.entityArtist ?? null,
      entityTitle: event.entityTitle ?? null,
      extraPayload: event.extraPayload ?? null,
    }),
  );
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
    case 'artist_policy_saved':
      return 'artist-policy';
    case 'release_added':
      return 'release-added';
    case 'request_fulfilled':
      return 'checkmark';
    case 'download_completed':
      return 'download';
    case 'music_queue_match_selected':
      return 'checkmark';
    case 'music_queue_download_started':
      return 'download';
    case 'music_queue_audio_checked':
    case 'music_queue_audio_warning':
    case 'music_queue_audio_check_failed':
    case 'music_queue_quality_blocked':
      return 'audio-check';
    case 'quality_fallback_allowed':
      return 'audio-check';
    case 'music_queue_search_queued':
      return 'search';
    case 'music_queue_download_retrying':
    case 'music_queue_match_retrying':
      return 'download';
    case 'music_queue_no_matches_left':
    case 'music_queue_download_failed':
      return 'alert';
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

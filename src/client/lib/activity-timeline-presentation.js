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

export const ACTIVITY_TIMELINE_FILTERS = Object.freeze([
  Object.freeze({ value: 'all', label: 'All activity' }),
  Object.freeze({ value: 'needs_attention', label: 'Needs attention' }),
  Object.freeze({ value: 'downloads', label: 'Downloads' }),
  Object.freeze({ value: 'audio_checks', label: 'Audio checks' }),
  Object.freeze({ value: 'library', label: 'Library' }),
  Object.freeze({ value: 'requests', label: 'Requests' }),
  Object.freeze({ value: 'artist_policy', label: 'Artist policy' }),
]);

const knownFilterValues = new Set(ACTIVITY_TIMELINE_FILTERS.map((filter) => filter.value));

function getTimelineCategory(eventType) {
  switch (eventType) {
    case 'download_completed':
    case 'music_queue_match_selected':
    case 'music_queue_download_started':
    case 'music_queue_search_queued':
    case 'music_queue_download_retrying':
    case 'music_queue_match_retrying':
    case 'music_queue_no_matches_left':
    case 'music_queue_download_failed':
      return { category: 'downloads', categoryLabel: 'Download' };
    case 'music_queue_quality_blocked':
    case 'music_queue_audio_checked':
    case 'music_queue_audio_warning':
    case 'music_queue_audio_check_failed':
    case 'quality_fallback_allowed':
      return { category: 'audio_checks', categoryLabel: 'Audio check' };
    case 'release_added':
      return { category: 'library', categoryLabel: 'Library' };
    case 'request_created':
    case 'request_fulfilled':
      return { category: 'requests', categoryLabel: 'Request' };
    case 'artist_monitored':
    case 'artist_policy_saved':
      return { category: 'artist_policy', categoryLabel: 'Artist policy' };
    default:
      return { category: 'all', categoryLabel: 'Activity' };
  }
}

/**
 * Produces the compact, user-facing categorization needed by the Activity
 * timeline. The raw event is retained by the caller for labels and links.
 *
 * @param {object} event
 * @returns {{ categoryLabel: string, category: string, requiresAttention: boolean, tone: string }}
 */
export function getActivityTimelineEventPresentation(event = {}) {
  const eventType = event?.eventType ?? null;
  const category = getTimelineCategory(eventType);
  const requiresAttention = eventType === 'music_queue_quality_blocked'
    || eventType === 'music_queue_download_failed'
    || eventType === 'music_queue_audio_warning'
    || eventType === 'music_queue_audio_check_failed';

  if (requiresAttention) {
    return { ...category, requiresAttention, tone: 'warning' };
  }

  if (eventType === 'music_queue_no_matches_left') {
    return { ...category, requiresAttention, tone: 'warning' };
  }

  if (eventType === 'release_added' || eventType === 'request_fulfilled' || eventType === 'download_completed') {
    return { ...category, requiresAttention, tone: 'success' };
  }

  return { ...category, requiresAttention, tone: 'info' };
}

/**
 * Filters a bounded, already-authorized activity feed in the client. Filters
 * never change what the server returns and do not expose raw event payloads.
 *
 * @param {object[]} events
 * @param {string} filter
 * @returns {object[]}
 */
export function filterActivityTimelineEvents(events, filter = 'all') {
  const selectedFilter = knownFilterValues.has(filter) ? filter : 'all';
  const sourceEvents = Array.isArray(events) ? events : [];

  if (selectedFilter === 'all') {
    return sourceEvents;
  }

  return sourceEvents.filter((event) => {
    const presentation = getActivityTimelineEventPresentation(event);
    return selectedFilter === 'needs_attention'
      ? presentation.requiresAttention
      : presentation.category === selectedFilter;
  });
}

export function getActivityTimelineFilterCount(events, filter) {
  return filterActivityTimelineEvents(events, filter).length;
}

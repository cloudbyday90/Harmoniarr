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

const MAX_STORY_DURATION_MS = 24 * 60 * 60 * 1000;

const OUTCOME_EVENT_TYPES = new Set([
  'release_added',
  'music_queue_quality_blocked',
  'music_queue_audio_warning',
  'music_queue_audio_check_failed',
  'music_queue_no_matches_left',
  'music_queue_download_failed',
  'music_queue_import_blocked',
]);

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getWantedReleaseId(event = {}) {
  return normalizeOptionalString(event.extraPayload?.wantedReleaseId)
    ?? (event.entityType === 'wanted_release' ? normalizeOptionalString(event.entityId) : null);
}

function getOccurredAtMilliseconds(event = {}) {
  if (typeof event.occurredAt !== 'string' || !event.occurredAt.trim()) {
    return null;
  }

  const timestamp = Date.parse(event.occurredAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isAutomaticMusicQueueMilestone(event = {}) {
  switch (event.eventType) {
    case 'music_queue_search_started':
    case 'music_queue_download_started':
    case 'download_completed':
    case 'music_queue_audio_checked':
      return true;
    case 'music_queue_match_selected':
      return event.extraPayload?.selectionMode !== 'manual';
    default:
      return false;
  }
}

function createEntry(event, index) {
  return {
    event,
    id: normalizeOptionalString(event?.id) ?? `activity-entry-${index}`,
    isCoalesced: false,
    milestoneEvents: [event],
    wantedReleaseId: getWantedReleaseId(event),
  };
}

function canMergeMilestoneIntoEntry({ event, entry }) {
  if (!entry?.wantedReleaseId || entry.wantedReleaseId !== getWantedReleaseId(event)) {
    return false;
  }

  const newestTimestamp = getOccurredAtMilliseconds(entry.event);
  const milestoneTimestamp = getOccurredAtMilliseconds(event);
  if (newestTimestamp === null || milestoneTimestamp === null) {
    return false;
  }

  return newestTimestamp >= milestoneTimestamp
    && newestTimestamp - milestoneTimestamp <= MAX_STORY_DURATION_MS;
}

function toCoalescedEntry(entry, event) {
  const milestoneEvents = [...entry.milestoneEvents, event];

  return {
    ...entry,
    isCoalesced: milestoneEvents.length > 1,
    milestoneEvents,
  };
}

/**
 * Projects the normal, already-authorized Activity feed into compact
 * release-centered stories. Raw events stay durable and available to
 * diagnostics; only safe automatic Music Queue milestones are coalesced.
 *
 * `events` must be newest first, matching the Activity API response.
 *
 * @param {object[]} events
 * @returns {Array<{
 *   event: object,
 *   id: string,
 *   isCoalesced: boolean,
 *   milestoneEvents: object[],
 *   wantedReleaseId: string|null,
 * }>}
 */
export function buildActivityTimelineStoryEntries(events) {
  const sourceEvents = Array.isArray(events) ? events : [];
  const entries = [];
  const activeEntriesByRelease = new Map();

  sourceEvents.forEach((event, index) => {
    const wantedReleaseId = getWantedReleaseId(event);
    const entry = createEntry(event, index);

    if (!wantedReleaseId) {
      entries.push(entry);
      return;
    }

    if (isAutomaticMusicQueueMilestone(event)) {
      const activeEntry = activeEntriesByRelease.get(wantedReleaseId);
      if (activeEntry && canMergeMilestoneIntoEntry({ event, entry: activeEntry })) {
        const updatedEntry = toCoalescedEntry(activeEntry, event);
        const entryIndex = entries.indexOf(activeEntry);
        entries[entryIndex] = updatedEntry;
        activeEntriesByRelease.set(wantedReleaseId, updatedEntry);
        return;
      }

      entries.push(entry);
      activeEntriesByRelease.set(wantedReleaseId, entry);
      return;
    }

    if (OUTCOME_EVENT_TYPES.has(event.eventType)) {
      entries.push(entry);
      activeEntriesByRelease.set(wantedReleaseId, entry);
      return;
    }

    activeEntriesByRelease.delete(wantedReleaseId);
    entries.push(entry);
  });

  return entries.map((entry) => entry.isCoalesced
    ? {
        ...entry,
        milestoneEvents: [...entry.milestoneEvents].reverse(),
      }
    : entry);
}

export function getActivityTimelineStoryDisclosureLabel(entry = {}) {
  const count = Array.isArray(entry.milestoneEvents) ? entry.milestoneEvents.length : 0;
  return `View ${count} release update${count === 1 ? '' : 's'}`;
}

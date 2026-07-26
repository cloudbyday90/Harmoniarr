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

import assert from 'node:assert/strict';
import test from 'node:test';
import { filterActivityTimelineEvents } from '../../src/client/lib/activity-timeline-presentation.js';
import {
  buildActivityTimelineStoryEntries,
  getActivityTimelineStoryDisclosureLabel,
} from '../../src/client/lib/activity-timeline-story-presentation.js';

function createEvent({
  id,
  eventType,
  occurredAt,
  wantedReleaseId = 'wanted-1',
  extraPayload = {},
} = {}) {
  return {
    id,
    entityId: wantedReleaseId,
    entityType: 'wanted_release',
    eventType,
    extraPayload: {
      wantedReleaseId,
      ...extraPayload,
    },
    occurredAt,
  };
}

test('Activity timeline coalesces automatic Music Queue milestones into a completed release story', () => {
  const entries = buildActivityTimelineStoryEntries([
    createEvent({ id: 'added', eventType: 'release_added', occurredAt: '2026-07-26T12:04:00.000Z' }),
    createEvent({ id: 'download', eventType: 'music_queue_download_started', occurredAt: '2026-07-26T12:03:00.000Z' }),
    createEvent({ id: 'match', eventType: 'music_queue_match_selected', occurredAt: '2026-07-26T12:02:00.000Z' }),
    createEvent({ id: 'search', eventType: 'music_queue_search_started', occurredAt: '2026-07-26T12:01:00.000Z' }),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].event.id, 'added');
  assert.equal(entries[0].isCoalesced, true);
  assert.deepEqual(entries[0].milestoneEvents.map((event) => event.id), [
    'search',
    'match',
    'download',
    'added',
  ]);
  assert.equal(getActivityTimelineStoryDisclosureLabel(entries[0]), 'View 4 release updates');
});

test('Activity timeline preserves explicit actions and recovery events as release-story boundaries', () => {
  const entries = buildActivityTimelineStoryEntries([
    createEvent({ id: 'download', eventType: 'music_queue_download_started', occurredAt: '2026-07-26T12:04:00.000Z' }),
    createEvent({
      id: 'manual-match',
      eventType: 'music_queue_match_selected',
      occurredAt: '2026-07-26T12:03:00.000Z',
      extraPayload: { selectionMode: 'manual' },
    }),
    createEvent({ id: 'search', eventType: 'music_queue_search_started', occurredAt: '2026-07-26T12:02:00.000Z' }),
    createEvent({ id: 'retry', eventType: 'music_queue_match_retrying', occurredAt: '2026-07-26T12:01:00.000Z' }),
    createEvent({ id: 'older-download', eventType: 'music_queue_download_started', occurredAt: '2026-07-26T12:00:00.000Z' }),
  ]);

  assert.deepEqual(entries.map((entry) => entry.event.id), [
    'download',
    'manual-match',
    'search',
    'retry',
    'older-download',
  ]);
  assert.equal(entries.every((entry) => entry.isCoalesced === false), true);
});

test('Activity timeline groups routine milestones beneath a visible attention outcome', () => {
  const entries = buildActivityTimelineStoryEntries([
    createEvent({ id: 'quality-stop', eventType: 'music_queue_quality_blocked', occurredAt: '2026-07-26T12:03:00.000Z' }),
    createEvent({ id: 'audio-checked', eventType: 'music_queue_audio_checked', occurredAt: '2026-07-26T12:02:00.000Z' }),
    createEvent({ id: 'completed', eventType: 'download_completed', occurredAt: '2026-07-26T12:01:00.000Z' }),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].event.id, 'quality-stop');
  assert.deepEqual(entries[0].milestoneEvents.map((event) => event.id), [
    'completed',
    'audio-checked',
    'quality-stop',
  ]);
});

test('Activity timeline never merges unknown identities, invalid timestamps, or separate-day runs', () => {
  const entries = buildActivityTimelineStoryEntries([
    createEvent({ id: 'new-download', eventType: 'music_queue_download_started', occurredAt: '2026-07-26T12:00:00.000Z' }),
    createEvent({ id: 'old-search', eventType: 'music_queue_search_started', occurredAt: '2026-07-25T11:59:59.000Z' }),
    {
      id: 'invalid-time',
      entityId: 'wanted-2',
      entityType: 'wanted_release',
      eventType: 'music_queue_download_started',
      extraPayload: { wantedReleaseId: 'wanted-2' },
      occurredAt: 'not-a-date',
    },
    {
      id: 'missing-release',
      entityId: 'candidate-1',
      entityType: 'import_candidate',
      eventType: 'music_queue_download_started',
      extraPayload: { importCandidateId: 'candidate-1' },
      occurredAt: '2026-07-26T11:58:00.000Z',
    },
  ]);

  assert.equal(entries.length, 4);
  assert.equal(entries.every((entry) => entry.isCoalesced === false), true);
});

test('Activity filters apply to raw events before story projection', () => {
  const events = [
    createEvent({ id: 'added', eventType: 'release_added', occurredAt: '2026-07-26T12:03:00.000Z' }),
    createEvent({ id: 'download', eventType: 'music_queue_download_started', occurredAt: '2026-07-26T12:02:00.000Z' }),
    createEvent({ id: 'match', eventType: 'music_queue_match_selected', occurredAt: '2026-07-26T12:01:00.000Z' }),
  ];

  const downloadEntries = buildActivityTimelineStoryEntries(filterActivityTimelineEvents(events, 'downloads'));
  const libraryEntries = buildActivityTimelineStoryEntries(filterActivityTimelineEvents(events, 'library'));

  assert.equal(downloadEntries.length, 1);
  assert.equal(downloadEntries[0].event.id, 'download');
  assert.equal(downloadEntries[0].isCoalesced, true);
  assert.equal(libraryEntries.length, 1);
  assert.equal(libraryEntries[0].event.id, 'added');
  assert.equal(libraryEntries[0].isCoalesced, false);
});

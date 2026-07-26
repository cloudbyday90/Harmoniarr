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
import {
  ACTIVITY_TIMELINE_FILTERS,
  filterActivityTimelineEvents,
  getActivityTimelineEventPresentation,
} from '../../src/client/lib/activity-timeline-presentation.js';

const events = [
  { id: 'download', eventType: 'download_completed' },
  { id: 'retrying', eventType: 'music_queue_match_retrying' },
  { id: 'no-matches', eventType: 'music_queue_no_matches_left' },
  { id: 'download-failed', eventType: 'music_queue_download_failed' },
  { id: 'quality-stop', eventType: 'music_queue_quality_blocked' },
  { id: 'library', eventType: 'release_added' },
  { id: 'request', eventType: 'request_created' },
  { id: 'policy', eventType: 'artist_policy_saved' },
];

test('Activity timeline exposes compact outcome filters', () => {
  assert.deepEqual(
    ACTIVITY_TIMELINE_FILTERS.map((filter) => filter.value),
    ['all', 'needs_attention', 'downloads', 'audio_checks', 'library', 'requests', 'artist_policy'],
  );
});

test('Activity timeline presents terminal stops as attention without treating automatic recovery as a stop', () => {
  assert.deepEqual(getActivityTimelineEventPresentation(events[4]), {
    category: 'audio_checks',
    categoryLabel: 'Audio check',
    requiresAttention: true,
    tone: 'warning',
  });
  assert.deepEqual(
    filterActivityTimelineEvents(events, 'needs_attention').map((event) => event.id),
    ['download-failed', 'quality-stop'],
  );
  assert.deepEqual(getActivityTimelineEventPresentation(events[1]), {
    category: 'downloads',
    categoryLabel: 'Download',
    requiresAttention: false,
    tone: 'info',
  });
  assert.deepEqual(getActivityTimelineEventPresentation(events[2]), {
    category: 'downloads',
    categoryLabel: 'Download',
    requiresAttention: false,
    tone: 'warning',
  });
});

test('Activity timeline groups normal events without hiding unknown activity', () => {
  assert.deepEqual(
    filterActivityTimelineEvents(events, 'downloads').map((event) => event.id),
    ['download', 'retrying', 'no-matches', 'download-failed'],
  );
  assert.deepEqual(filterActivityTimelineEvents(events, 'library').map((event) => event.id), ['library']);
  assert.deepEqual(filterActivityTimelineEvents(events, 'requests').map((event) => event.id), ['request']);
  assert.deepEqual(filterActivityTimelineEvents([{ id: 'unknown', eventType: 'future_event' }], 'all').map((event) => event.id), ['unknown']);
  assert.deepEqual(filterActivityTimelineEvents(events, 'unknown-filter'), events);
});

test('Activity timeline categorizes lifecycle milestones and reserves attention for actionable audio outcomes', () => {
  assert.deepEqual(getActivityTimelineEventPresentation({ eventType: 'music_queue_match_selected' }), {
    category: 'downloads',
    categoryLabel: 'Download',
    requiresAttention: false,
    tone: 'info',
  });
  assert.deepEqual(getActivityTimelineEventPresentation({ eventType: 'music_queue_audio_warning' }), {
    category: 'audio_checks',
    categoryLabel: 'Audio check',
    requiresAttention: true,
    tone: 'warning',
  });
});

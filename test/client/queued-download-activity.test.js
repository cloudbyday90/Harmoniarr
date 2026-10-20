/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getActivityEventLabel, getActivityEventDetail, getActivityEventIcon } from '../../src/client/lib/activity-event-normalization.js';
import { buildActivityEventLinkTarget } from '../../src/client/lib/activity-event-link-targets.js';
import { getActivityTimelineEventPresentation, filterActivityTimelineEvents } from '../../src/client/lib/activity-timeline-presentation.js';
import { buildActivityTimelineStoryEntries } from '../../src/client/lib/activity-timeline-story-presentation.js';

const queued = { id: 'queued', eventType: 'music_queue_download_queued', entityType: 'wanted_release', entityId: 'wanted-audio',
  entityTitle: 'Controlled audio', entityArtist: 'Controlled artist', occurredAt: '2026-10-20T12:00:01Z',
  extraPayload: { wantedReleaseId: 'wanted-audio', operationRunId: 'operation-owned' } };

test('queued download Activity communicates preparation and links to the authorized Missing Music decision', () => {
  assert.equal(getActivityEventLabel(queued), 'Download queued: Controlled audio by Controlled artist');
  assert.equal(getActivityEventDetail(queued), 'Download preparation is queued. The provider has not accepted this release yet.');
  assert.equal(getActivityEventIcon(queued.eventType), 'download');
  assert.deepEqual(buildActivityEventLinkTarget(queued), { label: 'Open in Missing Music', to: { name: 'missing-decision', params: { decisionId: 'wanted-audio' } } });
  assert.equal(getActivityEventDetail({ eventType: 'music_queue_match_selected', extraPayload: { selectionMode: 'manual' } }),
    'You selected this match. Start its download from Missing Music when you are ready.');
});

test('explicit queued download stays a visible routine download boundary between automatic milestones', () => {
  assert.deepEqual(getActivityTimelineEventPresentation(queued), { category: 'downloads', categoryLabel: 'Download', requiresAttention: false, tone: 'info' });
  assert.deepEqual(filterActivityTimelineEvents([queued], 'downloads'), [queued]);
  const entries = buildActivityTimelineStoryEntries([
    { ...queued, id: 'accepted', eventType: 'music_queue_download_started', occurredAt: '2026-10-20T12:00:02Z' },
    queued,
    { ...queued, id: 'search', eventType: 'music_queue_search_started', occurredAt: '2026-10-20T12:00:00Z' },
  ]);
  assert.deepEqual(entries.map(row => row.event.id), ['accepted', 'queued', 'search']);
  assert.equal(entries.every(row => !row.isCoalesced), true);
});

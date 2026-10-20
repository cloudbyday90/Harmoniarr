/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityEventService } from '../../src/server/activity/activity-event-service.js';
import { buildMusicQueueDownloadQueuedActivityEvent } from '../../src/server/activity/music-queue-milestone-activity-event-service.js';

test('canonical queued-download event is admitted, persisted and accepted as a feed filter', async () => {
  const events = []; let filter; const errors = [];
  const service = createActivityEventService({ stderr: { write: line => errors.push(line) }, activityEventStore: {
    insertActivityEvent: async event => { events.push(event); },
    listActivityEvents: async options => { filter = options.eventType; return events; },
  } });
  const event = buildMusicQueueDownloadQueuedActivityEvent({ actorUserId: 'admin', operationRunId: 'owned-run',
    candidate: { id: 'candidate', musicQueueContext: { wantedReleaseId: 'wanted-audio' }, releaseIdentity: { artistName: 'Controlled artist', releaseTitle: 'Controlled audio' } } });
  assert.deepEqual(await service.recordActivityEvent(event), { recorded: true });
  assert.equal(events.length, 1); assert.equal(events[0].actorUserId, 'admin'); assert.equal(events[0].entityId, 'wanted-audio');
  const feed = await service.buildActivityFeed({ eventType: 'music_queue_download_queued' });
  assert.equal(filter, 'music_queue_download_queued'); assert.equal(feed.events.length, 1);
  assert.deepEqual(errors, []);
});

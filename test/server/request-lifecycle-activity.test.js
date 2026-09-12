import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityEventService } from '../../src/server/activity/activity-event-service.js';
import { requestLifecycleActivityTypes } from '../../src/shared/request-lifecycle-activity.js';

test('lifecycle Activity is registered and projects only public fields on both write and read', async () => {
  const inserted = [];
  const listed = [];
  const stderr = [];
  const service = createActivityEventService({ stderr: { write: (line) => stderr.push(line) },
    activityEventStore: {
      insertActivityEvent: async (event) => inserted.push(event),
      listActivityEvents: async (query) => { listed.push(query); return inserted.map((event) => ({ ...event,
        entityTitle: 'private legacy title', entityArtist: 'private legacy artist', extraPayload: { reason: 'private reason' }, privateField: 'private' })); },
    } });
  for (const eventType of requestLifecycleActivityTypes) {
    await service.recordActivityEvent({ eventType, actorUserId: 'actor', entityType: 'media_request', entityId: 'request',
      entityTitle: 'private title', entityArtist: 'private artist', extraPayload: { requestedForUserId: 'private recipient', url: 'https://private.invalid' } });
    const feed = await service.buildActivityFeed({ eventType });
    assert.equal(listed.at(-1).eventType, eventType);
    assert.ok(!JSON.stringify(feed).includes('private'));
  }
  assert.equal(inserted.length, 2);
  for (const event of inserted) {
    assert.equal(event.entityTitle, null);
    assert.equal(event.entityArtist, null);
    assert.equal(event.extraPayload, null);
    assert.equal(event.actorUserId, 'actor');
    assert.equal(event.entityId, 'request');
  }
  assert.deepEqual(stderr, []);
});

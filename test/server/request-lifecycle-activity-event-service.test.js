import assert from 'node:assert/strict';
import test from 'node:test';
import { publishRequestLifecycleActivityEvent } from '../../src/server/activity/request-lifecycle-activity-event-service.js';

for (const eventType of ['request_cancelled', 'request_reassigned']) {
  test(`${eventType} publication contains only the household projection`, (t) => {
    const recordActivityEventFn = t.mock.fn();
    const result = publishRequestLifecycleActivityEvent({
      actorUserId: 'actor-1',
      mediaRequestId: 'request-1',
      eventType,
      recordActivityEventFn,
      entityTitle: 'Private title',
      entityArtist: 'Private artist',
      reason: 'Private reason',
      sourceUrl: 'https://provider.example/private',
      requestedForUserId: 'private-recipient',
      extraPayload: { notes: 'Private notes' },
    });

    assert.equal(result, undefined);
    assert.equal(recordActivityEventFn.mock.callCount(), 1);
    assert.deepEqual(recordActivityEventFn.mock.calls[0].arguments, [{
      id: null,
      eventType,
      actorUserId: 'actor-1',
      entityType: 'media_request',
      entityId: 'request-1',
      entityTitle: null,
      entityArtist: null,
      extraPayload: null,
      occurredAt: null,
    }]);
  });
}

test('lifecycle publication ignores absent publishers and unrelated event types', (t) => {
  const recordActivityEventFn = t.mock.fn();
  assert.doesNotThrow(() => publishRequestLifecycleActivityEvent());
  assert.doesNotThrow(() => publishRequestLifecycleActivityEvent({ eventType: 'request_cancelled' }));
  publishRequestLifecycleActivityEvent({ recordActivityEventFn, eventType: 'request_created' });
  assert.equal(recordActivityEventFn.mock.callCount(), 0);
});

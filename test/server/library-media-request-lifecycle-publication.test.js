import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';

function createFixture(recordActivityEventFn) {
  const request = {
    id: 'request-1',
    requestKind: 'release',
    requestState: 'needs_review',
    artistName: 'Private artist',
    releaseTitle: 'Private title',
    notes: 'Private notes',
    sourceUrl: 'https://provider.example/private',
    requestedByUser: { id: 'original-requester' },
    requestedForUser: { id: 'previous-recipient' },
    fanOutChildCount: 0,
  };
  const domainEvents = [];
  const auditEvents = [];
  const service = createLibraryMediaRequestService({
    getAppUserById: async ({ userId }) => ({ id: userId, isDisabled: false }),
    mediaRequestStore: {
      getMediaRequestById: async () => structuredClone(request),
      updateRequestState: async ({ newState }) => {
        request.requestState = newState;
        return true;
      },
      updateRequestedForUserId: async ({ newRequestedForUserId }) => {
        request.requestedForUser = { id: newRequestedForUserId };
        return true;
      },
      insertMediaRequestEvent: async (event) => { domainEvents.push(event); },
    },
    recordActivityEventFn,
    recordAuditEventFn: async (event) => { auditEvents.push(event); },
  });
  return { service, request, domainEvents, auditEvents };
}

const actions = [
  { method: 'cancelMediaRequest', eventType: 'request_cancelled', domainType: 'cancelled' },
  { method: 'reassignMediaRequest', eventType: 'request_reassigned', domainType: 'reassigned' },
];
const publisherBehaviors = [
  { name: 'throws synchronously', publish: () => { throw new Error('Private publisher failure'); } },
  { name: 'rejects asynchronously', publish: () => Promise.reject(new Error('Private publisher failure')) },
  { name: 'returns no promise', publish: () => undefined },
];

for (const action of actions) {
  for (const behavior of publisherBehaviors) {
    test(`${action.method} succeeds when Activity publisher ${behavior.name}`, async (t) => {
      const recordActivityEventFn = t.mock.fn(behavior.publish);
      const { service, request, domainEvents, auditEvents } = createFixture(recordActivityEventFn);
      const result = await service[action.method]({
        actorUserId: 'admin-1',
        actorUserRole: 'admin',
        mediaRequestId: request.id,
        newRequestedForUserId: 'new-recipient',
        reason: 'Private reason',
      });

      assert.equal(result.id, request.id);
      if (action.method === 'cancelMediaRequest') {
        assert.equal(result.requestState, 'cancelled');
        assert.equal(request.requestState, 'cancelled');
      } else {
        assert.equal(result.requestedForUser.id, 'new-recipient');
        assert.equal(request.requestedForUser.id, 'new-recipient');
      }
      assert.equal(domainEvents.length, 1);
      assert.equal(domainEvents[0].eventType, action.domainType);
      assert.equal(domainEvents[0].reason, 'Private reason');
      assert.equal(auditEvents.length, 1);
      assert.equal(auditEvents[0].details.reason, 'Private reason');
      assert.equal(recordActivityEventFn.mock.callCount(), 1);
      assert.deepEqual(recordActivityEventFn.mock.calls[0].arguments, [{
        id: null,
        eventType: action.eventType,
        actorUserId: 'admin-1',
        entityType: 'media_request',
        entityId: request.id,
        entityTitle: null,
        entityArtist: null,
        extraPayload: null,
        occurredAt: null,
      }]);
    });
  }

  test(`${action.method} does not wait for optional Activity publication`, { timeout: 1000 }, async () => {
    const publication = Promise.withResolvers();
    const { service, request } = createFixture(() => publication.promise);
    try {
      const result = await service[action.method]({
        actorUserId: 'admin-1',
        actorUserRole: 'admin',
        mediaRequestId: request.id,
        newRequestedForUserId: 'new-recipient',
      });
      assert.equal(result.id, request.id);
    } finally {
      publication.resolve();
    }
  });
}

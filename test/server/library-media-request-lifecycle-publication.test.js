/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';

function createFixture({ failAt = null } = {}) {
  const queryable = Object.freeze({ transactionScope: 'request-lifecycle' });
  const order = [];
  let request = { id: 'request-1', requestKind: 'release', requestState: 'needs_review',
    artistName: 'Private artist', releaseTitle: 'Private title', notes: 'Private notes',
    sourceUrl: 'https://provider.example/private', requestedByUser: { id: 'original-requester' },
    requestedForUser: { id: 'previous-recipient' }, fanOutChildCount: 0 };
  const original = structuredClone(request);
  const domainEvents = [];
  const auditEvents = [];
  const activityEvents = [];
  let optionalPublications = 0;
  function step(name, client) {
    assert.equal(client, queryable, `${name} must use the transaction client`);
    order.push(name);
    if (name === failAt) throw new Error('Private SQL diagnostic');
  }
  const service = createLibraryMediaRequestService({
    withRequestTransaction: async (work) => {
      order.push('begin');
      try { const value = await work(queryable); order.push('commit'); return value; }
      catch (error) {
        request = structuredClone(original);
        domainEvents.length = 0; auditEvents.length = 0; activityEvents.length = 0;
        order.push('rollback'); throw error;
      }
    },
    getAppUserById: async ({ userId, queryable: client }) => { step('target', client); return { id: userId, isDisabled: false }; },
    mediaRequestStore: {
      lockMediaRequest: async ({ queryable: client }) => { step('lock', client); },
      lockFanOutChildren: async ({ queryable: client }) => { step('children', client); return []; },
      getMediaRequestById: async ({ queryable: client }) => { step('read', client); return structuredClone(request); },
      updateRequestState: async ({ newState, queryable: client }) => { step('update', client); request.requestState = newState; return true; },
      updateRequestedForUserId: async ({ newRequestedForUserId, queryable: client }) => { step('update', client); request.requestedForUser = { id: newRequestedForUserId }; return true; },
      insertMediaRequestEvent: async ({ queryable: client, ...event }) => { step('history', client); domainEvents.push(event); },
    },
    activityEventStore: { insertActivityEvent: async ({ queryable: client, ...event }) => { step('activity', client); activityEvents.push(event); } },
    recordActivityEventFn: () => { optionalPublications += 1; throw new Error('Optional creation publisher must not run for lifecycle changes'); },
    recordAuditEventFn: async (event, client) => { step('audit', client); auditEvents.push(event); },
  });
  return { service, order, domainEvents, auditEvents, activityEvents, original,
    get request() { return request; }, get optionalPublications() { return optionalPublications; } };
}

for (const [method, eventType] of [['cancelMediaRequest', 'request_cancelled'], ['reassignMediaRequest', 'request_reassigned']]) {
  const input = { actorUserId: 'admin-1', actorUserRole: 'admin', mediaRequestId: 'request-1', newRequestedForUserId: 'new-recipient', reason: 'Private reason' };
  test(`${method} awaits strict Activity persistence in the same transaction without optional lifecycle publication`, async () => {
    const fixture = createFixture();
    const result = await fixture.service[method](input);
    assert.equal(result.id, 'request-1');
    assert.deepEqual(fixture.order.slice(0, 3), ['begin', 'lock', 'read']);
    assert.deepEqual(fixture.order.slice(-4), ['audit', 'activity', 'read', 'commit']);
    assert.equal(fixture.optionalPublications, 0);
    assert.equal(fixture.domainEvents.length, 1);
    assert.equal(fixture.auditEvents.length, 1);
    assert.equal(fixture.auditEvents[0].details.reason, 'Private reason');
    assert.deepEqual(fixture.activityEvents, [{ id: null, eventType, actorUserId: 'admin-1', entityType: 'media_request',
      entityId: 'request-1', entityTitle: null, entityArtist: null, extraPayload: null, occurredAt: null }]);
  });

  for (const failAt of ['history', 'audit', 'activity']) {
    test(`${method} propagates ${failAt} failure to the transaction boundary with a safe error`, async () => {
      const fixture = createFixture({ failAt });
      await assert.rejects(fixture.service[method](input), (error) => (
        error.status === 500 && error.code === 'media_request_lifecycle_failed'
        && !error.message.includes('Private SQL') && !error.cause
      ));
      assert.equal(fixture.order.at(-1), 'rollback');
      assert.equal(fixture.order.includes('commit'), false);
      assert.deepEqual(fixture.request, fixture.original);
      assert.equal(fixture.domainEvents.length + fixture.auditEvents.length + fixture.activityEvents.length, 0);
      assert.equal(fixture.optionalPublications, 0);
    });
  }
}

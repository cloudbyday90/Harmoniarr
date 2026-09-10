/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createLibraryMediaRequestCreationService } from '../../src/server/library/library-media-request-creation-service.js';

function createRequestInput(overrides = {}) {
  return {
    ineligible: [{ userId: 'disabled-user', reasonCode: 'media_request_target_disabled' }],
    request: {
      artistName: 'Autechre',
      evidence: { classificationStrategy: 'local_metadata_release_search' },
      musicbrainzReleaseId: 'release-mbid',
      releaseTitle: 'Amber',
      requestKind: 'release',
      requestState: 'needs_fetch',
      requestedByUserId: 'admin-1',
    },
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'RequestCreationTest/1.0' },
    targetUserIds: ['user-1', 'user-2', 'user-3'],
    ...overrides,
  };
}

function createCreationFixture({ failAt = null, returnedChildCount = null, duplicate = null, effectFailure = null } = {}) {
  const calls = [];
  const failure = new Error(`Failed ${failAt ?? 'optional publication'}`);
  let committed = false;
  const client = {
    async query(statement) {
      calls.push({ kind: statement });
      if (failAt === statement) throw failure;
      if (statement === 'COMMIT') committed = true;
      return { rows: [] };
    },
    release(error) {
      calls.push({ kind: 'release', error });
    },
  };
  function recordPersistence(kind, payload, queryable = payload.queryable) {
    assert.equal(queryable, client, `${kind} must use the transaction client`);
    assert.equal(committed, false, `${kind} must finish before commit`);
    calls.push({ kind, payload, queryable });
    if (failAt === kind) throw failure;
  }
  function publish(kind, payload) {
    calls.push({ kind, payload, committed });
    if (effectFailure === 'throw') throw failure;
    if (effectFailure === 'reject') return Promise.reject(failure);
    return undefined;
  }
  const service = createLibraryMediaRequestCreationService({
    externalIntakeService: {
      async queueExternalMediaRequestPlanning(payload) {
        recordPersistence('queue', payload);
      },
    },
    mediaRequestStore: {
      async findActiveDuplicateRequest(payload) {
        recordPersistence('duplicate', payload);
        return duplicate;
      },
      async createMediaRequest(payload) {
        recordPersistence('parent', payload);
        return {
          id: 'parent-1',
          linkedRequestId: payload.linkedRequestId,
          requestKind: payload.requestKind,
          requestState: payload.requestState,
          requestedForUser: { id: payload.requestedForUserId },
        };
      },
      async createFanOutChildRequests(payload) {
        recordPersistence('children', payload);
        return payload.targetUserIds.slice(0, returnedChildCount ?? payload.targetUserIds.length)
          .map((userId, index) => ({ id: `child-${index + 1}`, requestedForUser: { id: userId } }));
      },
      async updateFanOutChildCount(payload) {
        recordPersistence('count', payload);
      },
    },
    onRequestCreatedFn: (payload) => publish('notification', payload),
    recordActivityEventFn: (payload) => publish('activity', payload),
    async recordAuditEventFn(payload, queryable) {
      recordPersistence(payload.eventType, payload, queryable);
    },
    withRequestTransaction: createDatabaseTransactionRunner({
      getPoolFn: () => ({ connect: async () => client }),
    }),
  });
  return { calls, client, failure, service };
}

function getPublications(calls) {
  return calls.filter(({ kind }) => kind === 'activity' || kind === 'notification');
}

test('request creation commits every target and audit before publishing one notification and each request activity', async () => {
  const fixture = createCreationFixture({ duplicate: { id: 'existing-request' } });
  const input = createRequestInput();
  const result = await fixture.service.createRequestFamily(input);

  assert.equal(result.linked, true);
  assert.equal(result.linkedRequestId, 'existing-request');
  assert.equal(result.fanOutChildCount, 2);
  assert.deepEqual(result.fanOut, {
    childCount: 2,
    children: ['child-1', 'child-2'],
    ineligible: input.ineligible,
    totalTargets: 3,
  });
  const parentCall = fixture.calls.find(({ kind }) => kind === 'parent');
  assert.equal(parentCall.payload.requestedForUserId, 'user-1');
  assert.equal(parentCall.payload.evidence.dedupLinkedToRequestId, 'existing-request');
  assert.deepEqual(fixture.calls.find(({ kind }) => kind === 'children').payload.targetUserIds, ['user-2', 'user-3']);
  assert.equal(fixture.calls.find(({ kind }) => kind === 'count').payload.childCount, 2);
  const audits = fixture.calls.filter(({ kind }) => kind.startsWith('media_request_'));
  assert.equal(audits.length, 2);
  assert.ok(audits.every(({ queryable }) => queryable === fixture.client));
  assert.equal(audits[0].payload.actorUserId, 'admin-1');
  assert.equal(audits[0].payload.ipAddress, input.requestMetadata.ipAddress);
  assert.equal(audits[1].payload.details.targetUserCount, 3);
  assert.equal(audits[1].payload.details.ineligibleCount, 1);
  const publications = getPublications(fixture.calls);
  assert.ok(publications.every(({ committed }) => committed));
  assert.deepEqual(publications.filter(({ kind }) => kind === 'activity').map(({ payload }) => payload.entityId),
    ['parent-1', 'child-1', 'child-2']);
  assert.equal(publications.filter(({ kind }) => kind === 'notification').length, 1);
  assert.ok(fixture.calls.findIndex(({ kind }) => kind === 'COMMIT') < fixture.calls.findIndex(({ kind }) => kind === 'activity'));
});

test('external request creation queues normalized planning on the same client before commit', async () => {
  const fixture = createCreationFixture();
  const input = createRequestInput();
  input.request = {
    ...input.request,
    requestKind: 'external_url',
    sourceUrl: 'https://open.spotify.com/album/test-album?si=discard-me',
  };

  await fixture.service.createRequestFamily(input);

  const queueCall = fixture.calls.find(({ kind }) => kind === 'queue');
  assert.equal(queueCall.queryable, fixture.client);
  assert.equal(queueCall.payload.mediaRequestId, 'parent-1');
  assert.equal(queueCall.payload.normalizedSource.canonicalUrl, 'https://open.spotify.com/album/test-album');
  assert.equal(queueCall.payload.triggeredByUserId, 'admin-1');
  assert.equal(queueCall.payload.triggerSource, 'request_submit');
  assert.equal(queueCall.payload.requestMetadata, input.requestMetadata);
  assert.equal(fixture.calls.filter(({ kind }) => kind === 'queue').length, 1);
  assert.equal(fixture.calls.some(({ kind }) => kind === 'duplicate'), false);
  assert.ok(fixture.calls.indexOf(queueCall) < fixture.calls.findIndex(({ kind }) => kind === 'COMMIT'));
});

for (const failAt of ['children', 'count', 'media_request_created', 'media_request_fan_out_created', 'queue', 'COMMIT']) {
  test(`request creation publishes nothing when ${failAt} fails`, async () => {
    const fixture = createCreationFixture({ failAt });
    const input = createRequestInput();
    input.request = { ...input.request, requestKind: 'external_url', sourceUrl: 'https://open.spotify.com/album/test-album' };

    await assert.rejects(fixture.service.createRequestFamily(input), (error) => error === fixture.failure);

    assert.deepEqual(getPublications(fixture.calls), []);
    assert.ok(fixture.calls.some(({ kind }) => kind === 'ROLLBACK'));
    assert.equal(fixture.calls.at(-1).kind, 'release');
    assert.equal(fixture.calls.some(({ kind }) => kind === 'COMMIT'), failAt === 'COMMIT');
  });
}

test('request creation rejects a partial child result before count, audits, planning, or publication', async () => {
  const fixture = createCreationFixture({ returnedChildCount: 1 });

  await assert.rejects(fixture.service.createRequestFamily(createRequestInput()), /every eligible target/u);

  assert.deepEqual(getPublications(fixture.calls), []);
  assert.equal(fixture.calls.some(({ kind }) => kind === 'count' || kind.startsWith('media_request_') || kind === 'queue'), false);
  assert.deepEqual(fixture.calls.slice(-2).map(({ kind }) => kind), ['ROLLBACK', 'release']);
});

for (const effectFailure of ['throw', 'reject']) {
  test(`optional publication ${effectFailure} does not fail a committed request or prevent other publications`, async () => {
    const fixture = createCreationFixture({ effectFailure });

    const result = await fixture.service.createRequestFamily(createRequestInput());
    await new Promise((resolve) => { setImmediate(resolve); });

    assert.equal(result.id, 'parent-1');
    assert.equal(result.fanOutChildCount, 2);
    assert.equal(getPublications(fixture.calls).length, 4);
    assert.ok(getPublications(fixture.calls).every(({ committed }) => committed));
    assert.equal(fixture.calls.some(({ kind }) => kind === 'ROLLBACK'), false);
  });
}

test('single request creation retains its response shape and skips family count and fan-out audit', async () => {
  const fixture = createCreationFixture();
  const input = createRequestInput({ ineligible: null, targetUserIds: ['user-1'] });
  input.request.requestState = 'already_exists';

  const result = await fixture.service.createRequestFamily(input);

  assert.equal(result.id, 'parent-1');
  assert.equal(result.linked, false);
  assert.equal(result.fanOutChildCount, 0);
  assert.equal(Object.hasOwn(result, 'fanOut'), false);
  assert.equal(fixture.calls.some(({ kind }) => ['duplicate', 'children', 'count', 'queue', 'media_request_fan_out_created'].includes(kind)), false);
  assert.deepEqual(getPublications(fixture.calls).map(({ kind }) => kind), ['activity', 'notification']);
});

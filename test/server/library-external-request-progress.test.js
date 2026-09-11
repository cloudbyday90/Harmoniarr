/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExternalRequestProgressStatus } from '../../src/server/library/library-external-request-progress.js';
import { createLibraryExternalRequestProgressStore } from '../../src/server/library/library-external-request-progress-store.js';
import { createLibraryMediaRequestFulfillmentService } from '../../src/server/library/library-media-request-fulfillment-service.js';

function externalRequest(id = 'child', owner = 'child-user', overrides = {}) {
  return { id, requestKind: 'external_url', requestState: 'needs_fetch', requestedForUser: { id: owner }, ...overrides };
}

function candidate(id, requestId, owner, status) {
  return {
    id, status,
    normalizedPayload: { requestOwnership: { sourceMediaRequestId: requestId, sourceRequestedForUserId: owner } },
  };
}

for (const [phase, status, failedCount, expectedCode, expectedLabel] of [
  ['planning', 'pending', 0, 'queued', 'Planning provider request'],
  ['planning', 'completed', 0, 'queued', 'Planning provider request'],
  ['execution', 'running', 0, 'queued', 'Preparing provider details'],
  ['execution', 'completed', 0, 'under_review', 'Provider details prepared'],
  ['execution', 'completed', 1, 'under_review', 'Provider details need review'],
  ['planning', 'failed', 0, 'failed', 'Provider preparation failed'],
  ['execution', 'cancelled', 0, 'under_review', 'Provider preparation stopped'],
  ['discovery', 'pending', 0, 'queued', 'Approved release search queued'],
  ['discovery', 'running', 0, 'queued', 'Searching approved release'],
  ['discovery', 'completed', 0, 'under_review', 'Approved release search completed'],
  ['discovery', 'failed', 0, 'failed', 'Approved release search failed'],
  ['discovery', 'cancelled', 0, 'under_review', 'Approved release search stopped'],
]) {
  test(`external ${phase} ${status} with ${failedCount} failures reports preparation, never import completion`, () => {
    const progress = { phase, status, failedCount, occurredAt: '2026-09-10T12:00:00Z', errorMessage: 'secret provider diagnostic' };
    const result = buildExternalRequestProgressStatus({ request: externalRequest(), progress });
    assert.equal(result.code, expectedCode);
    assert.equal(result.label, expectedLabel);
    assert.equal(result.occurredAt, progress.occurredAt);
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.equal(Object.hasOwn(result, 'importCandidateId'), false);
  });
}

test('provider progress ignores unknown states and non-external requests', () => {
  assert.equal(buildExternalRequestProgressStatus({ request: { requestKind: 'release' }, progress: { status: 'failed' } }), null);
  assert.equal(buildExternalRequestProgressStatus({ request: externalRequest(), progress: { status: 'unexpected' } }), null);
  assert.equal(buildExternalRequestProgressStatus({ request: externalRequest() }).code, 'under_review');
});

test('external preparation reads expose only normalized progress for server-selected request IDs', async () => {
  let parameters;
  const store = createLibraryExternalRequestProgressStore({
    getPoolFn: () => ({ query: async (_sql, params) => {
      parameters = params;
      return { rows: [{
        media_request_id: 'child', operation_type: 'library_external_intake_execution', status: 'completed',
        occurred_at: '2026-09-10T12:00:00Z', failed_count: '2', pending_request_count: '3', error_message: 'secret', summary: { token: 'secret' },
      }] };
    } }),
  });
  const result = await store.listExternalRequestProgressByIds({ mediaRequestIds: ['child', 'child', null] });
  assert.deepEqual(parameters, [['library_external_intake_planning', 'library_external_intake_execution', 'library_external_request_discovery'], ['child'], 'library_external_request_discovery']);
  assert.deepEqual(result, [{ mediaRequestId: 'child', phase: 'execution', status: 'completed', occurredAt: '2026-09-10T12:00:00Z', failedCount: 2, pendingRequestCount: 3 }]);
});

test('empty external progress reads do not acquire a database connection', async () => {
  const store = createLibraryExternalRequestProgressStore({ getPoolFn: () => { throw new Error('unexpected database access'); } });
  assert.deepEqual(await store.listExternalRequestProgressByIds({ mediaRequestIds: [] }), []);
});

test('external child completion requires its own candidate and current target owner', async () => {
  const service = createLibraryMediaRequestFulfillmentService({
    listImportCandidatesBySourceMediaRequestIds: async () => [
      candidate('parent-applied', 'parent', 'parent-user', 'applied'),
      candidate('child-old-owner', 'child', 'previous-user', 'applied'),
      candidate('sibling-downloading', 'sibling', 'sibling-user', 'downloading'),
    ],
    listExternalRequestProgressByIds: async () => [{ mediaRequestId: 'child', phase: 'execution', status: 'completed', failedCount: 0 }],
  });
  const result = await service.enrichMediaRequests([
    externalRequest('parent', 'parent-user'),
    externalRequest('child', 'child-user', { fanOutParentId: 'parent', linkedRequestId: 'parent' }),
    externalRequest('sibling', 'sibling-user', { fanOutParentId: 'parent' }),
  ]);
  assert.deepEqual(result.map((request) => request.fulfillmentStatus.code), ['fulfilled', 'under_review', 'downloading']);
  assert.equal(Object.hasOwn(result[1].fulfillmentStatus, 'importCandidateId'), false);
  assert.equal(result[1].requestedForUser.id, 'child-user');
});

test('a direct target-owned candidate takes precedence over stale provider failure', async () => {
  const service = createLibraryMediaRequestFulfillmentService({
    listImportCandidatesBySourceMediaRequestIds: async () => [candidate('child-applied', 'child', 'child-user', 'applied')],
    listExternalRequestProgressByIds: async () => [{ mediaRequestId: 'child', phase: 'planning', status: 'failed' }],
  });
  const [result] = await service.enrichMediaRequests([externalRequest()]);
  assert.equal(result.fulfillmentStatus.code, 'fulfilled');
  assert.equal(result.fulfillmentStatus.importCandidateId, 'child-applied');
});

test('cancelled external requests cannot be promoted by late candidate or provider completion', async () => {
  const service = createLibraryMediaRequestFulfillmentService({
    listImportCandidatesBySourceMediaRequestIds: async () => [candidate('late-applied', 'child', 'child-user', 'applied')],
    listExternalRequestProgressByIds: async () => [{ mediaRequestId: 'child', phase: 'execution', status: 'completed' }],
  });
  const result = await service.enrichMediaRequests([externalRequest('child', 'child-user', { requestState: 'cancelled' })]);
  assert.equal(result[0].fulfillmentStatus.code, 'cancelled');
  const counts = service.buildMediaRequestFulfillmentCounts(result);
  assert.equal(counts.totalRequests, 1);
  assert.equal(counts.active, 0);
  assert.equal(counts.satisfied, 0);
  assert.equal(counts.underReview, 0);
});

test('completed provider runs with derived work remaining do not claim preparation is complete', () => {
  const result = buildExternalRequestProgressStatus({ request: externalRequest(), progress: {
    phase: 'execution', status: 'completed', failedCount: 0, pendingRequestCount: 2,
  } });
  assert.equal(result.code, 'under_review');
  assert.equal(result.label, 'More provider details need review');
});

test('pruned or absent operation history requests review instead of reporting perpetual queueing', async () => {
  const service = createLibraryMediaRequestFulfillmentService();
  const [result] = await service.enrichMediaRequests([externalRequest()]);
  assert.equal(result.fulfillmentStatus.code, 'under_review');
  assert.equal(result.fulfillmentStatus.label, 'Provider preparation needs review');
});

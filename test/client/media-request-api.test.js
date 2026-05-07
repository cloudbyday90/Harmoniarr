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
import { fetchMyMediaRequests, fetchMyRequestSummary } from '../../src/client/lib/media-request-api.js';

function createJsonResponse({ payload = { ok: true, mediaRequests: [], scope: 'mine' }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test('media-request-api fetchMyMediaRequests calls media-requests endpoint with scope=mine', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-test' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMyMediaRequests();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('/api/v1/library/media-requests'), 'should call media-requests endpoint');
  assert.ok(url.includes('scope=mine'), 'should request scope=mine');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('media-request-api fetchMyMediaRequests omits limit from URL when using default 50', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMyMediaRequests();

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(!url.includes('limit='), 'should not include limit param when using default');
});

test('media-request-api fetchMyMediaRequests includes limit in URL when overridden', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMyMediaRequests({ limit: 10 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('limit=10'), 'should include limit param when overridden');
});

test('media-request-api fetchMyRequestSummary calls summary endpoint with scope=mine', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-test' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({
      payload: {
        ok: true,
        scope: 'mine',
        counts: { totalRequests: 1, alreadyExists: 0, needsFetch: 1, needsReview: 0 },
        fulfillmentCounts: { active: 0, failed: 0, satisfied: 0, underReview: 0 },
        notificationFeed: { checkedAt: '2026-05-07T00:00:00Z', counts: { total: 0, byCategory: {} }, notifications: [] },
        recentRequests: [],
        summary: { message: 'ok', status: 'active' },
      },
    }),
  );

  const result = await fetchMyRequestSummary();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('/api/v1/library/media-request-summary'), 'should call media-request-summary endpoint');
  assert.ok(url.includes('scope=mine'), 'should request scope=mine');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
  assert.equal(result.scope, 'mine');
  assert.ok(result.notificationFeed, 'should return notificationFeed');
});

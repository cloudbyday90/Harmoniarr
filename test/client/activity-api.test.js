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
import { suite, test } from 'node:test';
import {
  blockActivitySourceUser,
  bulkBlockActivitySourceUsers,
  bulkUpdateActivitySourceUserTrust,
  fetchActivityBlocklist,
  fetchActivityFeed,
  fetchActivitySourceUserDetail,
  fetchActivitySourceUsers,
  updateActivitySourceUserTrust,
  unblockActivitySourceUser,
} from '../../src/client/lib/activity-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

suite('activity-api', () => {
  test('read routes use the shared api client contract', async (t) => {
    globalThis.fetch = t.mock.fn(async () => createJsonResponse());

    await fetchActivityFeed({ eventType: 'request_created', limit: 10 });
    await fetchActivityBlocklist({ query: 'peer' });
    await fetchActivitySourceUsers({ query: 'peer', trustState: 'trusted' });
    await fetchActivitySourceUserDetail('peer 1');

    assert.equal(globalThis.fetch.mock.callCount(), 4);
    assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/activity/feed?limit=10&eventType=request_created');
    assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/activity/blocklist?q=peer');
    assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/activity/source-users?q=peer&trustState=trusted');
    assert.equal(globalThis.fetch.mock.calls[3].arguments[0], '/api/v1/activity/source-users/peer%201');
  });

  test('mutation routes include CSRF headers', async (t) => {
    globalThis.document = { cookie: 'harmoniarr_csrf=csrf-activity' };
    globalThis.fetch = t.mock.fn(async () => createJsonResponse());

    await blockActivitySourceUser({ operatorNotes: 'Note', reason: 'Bad files', username: 'peer 1' });
    await updateActivitySourceUserTrust('peer 1', { operatorNotes: 'Known good', reason: 'Verified releases', trustState: 'trusted' });
    await unblockActivitySourceUser('peer 1');

    assert.equal(globalThis.fetch.mock.callCount(), 3);

    const [blockCall, updateCall, unblockCall] = globalThis.fetch.mock.calls;

    assert.equal(blockCall.arguments[0], '/api/v1/activity/blocklist');
    assert.equal(blockCall.arguments[1].method, 'POST');
    assert.equal(blockCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-activity');

    assert.equal(updateCall.arguments[0], '/api/v1/activity/source-users/peer%201');
    assert.equal(updateCall.arguments[1].method, 'PATCH');
    assert.equal(updateCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-activity');

    assert.equal(unblockCall.arguments[0], '/api/v1/activity/blocklist/peer%201');
    assert.equal(unblockCall.arguments[1].method, 'DELETE');
    assert.equal(unblockCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-activity');
  });

  test('bulk mutation routes include CSRF headers', async (t) => {
    globalThis.document = { cookie: 'harmoniarr_csrf=csrf-bulk' };
    globalThis.fetch = t.mock.fn(async () => createJsonResponse());

    await bulkUpdateActivitySourceUserTrust({ reason: 'Batch trust', trustState: 'trusted', usernames: ['peer-1', 'peer-2'] });
    await bulkBlockActivitySourceUsers({ reason: 'Spam', usernames: ['spammer-1'] });

    assert.equal(globalThis.fetch.mock.callCount(), 2);

    const [bulkTrustCall, bulkBlockCall] = globalThis.fetch.mock.calls;

    assert.equal(bulkTrustCall.arguments[0], '/api/v1/activity/source-users/bulk-trust');
    assert.equal(bulkTrustCall.arguments[1].method, 'POST');
    assert.equal(bulkTrustCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-bulk');

    assert.equal(bulkBlockCall.arguments[0], '/api/v1/activity/blocklist/bulk');
    assert.equal(bulkBlockCall.arguments[1].method, 'POST');
    assert.equal(bulkBlockCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-bulk');
  });
});

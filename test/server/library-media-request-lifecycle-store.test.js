/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityEventStore } from '../../src/server/activity/activity-event-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';

test('lifecycle locks, request updates, and Activity persistence keep the explicitly supplied transaction client', async () => {
  const calls = [];
  const queryable = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: 'request-1', requestState: 'needs_review' }] };
  } };
  const getPoolFn = () => { throw new Error('A lifecycle transaction must not use a second pool client'); };
  const requests = createLibraryMediaRequestStore({ getPoolFn });
  const activity = createActivityEventStore({ getPoolFn });
  await requests.lockMediaRequest({ mediaRequestId: 'request-1', queryable });
  assert.deepEqual(await requests.lockFanOutChildren({ parentMediaRequestId: 'request-1', queryable }),
    [{ id: 'request-1', requestState: 'needs_review' }]);
  assert.equal(await requests.updateRequestState({ mediaRequestId: 'request-1', newState: 'cancelled', queryable }), true);
  assert.equal(await requests.updateRequestedForUserId({ mediaRequestId: 'request-1', newRequestedForUserId: 'target-2', queryable }), true);
  await activity.insertActivityEvent({ eventType: 'request_cancelled', entityId: 'request-1', entityType: 'media_request', queryable });
  assert.match(calls[0].sql, /WHERE id = \$1 FOR UPDATE/);
  assert.match(calls[1].sql, /WHERE fan_out_parent_id = \$1 ORDER BY id FOR UPDATE/);
  assert.deepEqual(calls.map((call) => call.params), [
    ['request-1'], ['request-1'], ['request-1', 'cancelled'], ['request-1', 'target-2'],
    ['request_cancelled', null, 'media_request', 'request-1', null, null, null],
  ]);
});

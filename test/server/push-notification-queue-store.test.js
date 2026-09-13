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
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';

test('enqueueNotification stringifies payload and maps queue row fields', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempts: 0,
      coalesce_key: 'releaseAdded:radiohead:kid-a',
      created_at: new Date('2026-05-22T12:00:00.000Z'),
      event_type: 'releaseAdded',
      id: 'queue-1',
      next_attempt_at: new Date('2026-05-22T12:00:00.000Z'),
      payload: { title: 'Release added' },
      sent_at: null,
      status: 'pending',
      subscription_id: 'sub-1',
      ttl_seconds: 90,
      user_id: 'user-1',
    }],
  }));
  const store = createPushNotificationQueueStore({ getPoolFn: () => ({ query }) });

  const result = await store.enqueueNotification({
    coalesceKey: 'releaseAdded:radiohead:kid-a',
    eventType: 'releaseAdded',
    payload: { title: 'Release added' },
    subscriptionId: 'sub-1',
    ttlSeconds: 90,
    userId: 'user-1',
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'sub-1',
    'releaseAdded',
    'releaseAdded:radiohead:kid-a',
    '{"title":"Release added"}',
    90,
  ]);
  assert.deepEqual(result, {
    attempts: 0,
    claimToken: null,
    coalesceKey: 'releaseAdded:radiohead:kid-a',
    createdAt: '2026-05-22T12:00:00.000Z',
    eventType: 'releaseAdded',
    expiresAt: null,
    id: 'queue-1',
    nextAttemptAt: '2026-05-22T12:00:00.000Z',
    payload: { title: 'Release added' },
    sentAt: null,
    status: 'pending',
    terminalAt: null,
    subscriptionId: 'sub-1',
    ttlSeconds: 90,
    userId: 'user-1',
  });
});

test('claimPendingNotifications extends claim window and maps returned rows', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempts: 1,
      coalesce_key: null,
      created_at: new Date('2026-05-22T12:00:00.000Z'),
      event_type: 'requestFulfilled',
      id: 'queue-2',
      next_attempt_at: new Date('2026-05-22T12:01:00.000Z'),
      payload: { title: 'Request ready' },
      sent_at: null,
      status: 'pending',
      subscription_id: 'sub-2',
      ttl_seconds: 120,
      user_id: 'user-2',
    }],
  }));
  const store = createPushNotificationQueueStore({ getPoolFn: () => ({ query }) });

  const result = await store.claimPendingNotifications({ claimWindowMs: 45000, limit: 10 });

  assert.match(query.mock.calls[0].arguments[0], /next_attempt_at = clock_timestamp\(\) \+ \(\$2 \* INTERVAL '1 millisecond'\)/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [10, 45000]);
  assert.equal(result[0].attempts, 1);
  assert.equal(result[0].subscriptionId, 'sub-2');
});

test('listPendingNotificationsForCoalesce and updatePendingNotificationPayload use pending filters', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('SELECT *')) {
      return {
        rows: [{
          attempts: 0,
          coalesce_key: 'releaseAdded:key',
          created_at: new Date('2026-05-22T12:00:00.000Z'),
          event_type: 'releaseAdded',
          id: 'queue-3',
          next_attempt_at: new Date('2026-05-22T12:00:00.000Z'),
          payload: { title: 'Before' },
          sent_at: null,
          status: 'pending',
          subscription_id: 'sub-3',
          ttl_seconds: 120,
          user_id: 'user-3',
        }],
      };
    }

    return {
      rows: [{
        attempts: 0,
        coalesce_key: 'releaseAdded:key',
        created_at: new Date('2026-05-22T12:00:00.000Z'),
        event_type: 'releaseAdded',
        id: 'queue-3',
        next_attempt_at: new Date('2026-05-22T12:00:00.000Z'),
        payload: { title: 'After' },
        sent_at: null,
        status: 'pending',
        subscription_id: 'sub-3',
        ttl_seconds: 240,
        user_id: 'user-3',
      }],
    };
  });
  const store = createPushNotificationQueueStore({ getPoolFn: () => ({ query }) });

  const pending = await store.listPendingNotificationsForCoalesce({
    coalesceKey: 'releaseAdded:key',
    eventType: 'releaseAdded',
    since: '2026-05-22T11:58:00.000Z',
    userId: 'user-3',
  });
  const updated = await store.updatePendingNotificationPayload({
    ids: ['queue-3'],
    payload: { title: 'After' },
    ttlSeconds: 240,
  });

  assert.match(query.mock.calls[0].arguments[0], /status = 'pending'/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['user-3', 'releaseAdded', 'releaseAdded:key', '2026-05-22T11:58:00.000Z']);
  assert.match(query.mock.calls[1].arguments[0], /payload = \$2::jsonb/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [['queue-3'], '{"title":"After"}', 240]);
  assert.equal(pending[0].id, 'queue-3');
  assert.equal(updated[0].ttlSeconds, 240);
});

test('missing or malformed claim tokens cannot perform a queue lookup or completion', async () => {
  const store = createPushNotificationQueueStore({ getPoolFn: () => { assert.fail('invalid claims must not reach SQL'); } });
  for (const claimToken of [undefined, null, '', 'not-a-uuid']) {
    assert.equal(await store.isNotificationClaimActive('queue-1', { claimToken }), false);
    assert.equal(await store.markNotificationSent('queue-1', { claimToken }), false);
    assert.equal(await store.markNotificationFailed('queue-1', { claimToken, failed: true }), false);
  }
});


test('queue writers reject invalid TTLs before acquiring a database connection', async () => {
  const store = createPushNotificationQueueStore({ getPoolFn: () => assert.fail('Invalid TTL must not reach PostgreSQL') });
  for (const ttlSeconds of [undefined, null, 0, -1, 1.5, '60', '60seconds', NaN, Infinity, 2147483648]) {
    await assert.rejects(store.enqueueNotification({ ttlSeconds }), RangeError);
    await assert.rejects(store.recordSentNotification({ ttlSeconds }), RangeError);
    await assert.rejects(store.updatePendingNotificationPayload({ ids: ['queue-1'], ttlSeconds }), RangeError);
  }
});

test('delivery budget with invalid claim identity cannot acquire a database connection', async () => {
  const store = createPushNotificationQueueStore({ getPoolFn: () => assert.fail('Missing claim must not reach PostgreSQL') });
  for (const claimToken of [undefined, null, '', 'bad-token', 42]) {
    assert.equal(await store.getNotificationDeliveryBudget('queue-1', { claimToken }), null);
  }
});

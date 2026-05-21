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
import { createSourceUserBlocklistService } from '../../src/server/activity/source-user-blocklist-service.js';

test('listBlockedSourceUsers returns only blocked rows sorted by blockedAt desc', async () => {
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([
      { username: 'neutral-user', trustState: 'neutral', isBlocked: false },
      { username: 'zulu', trustState: 'blocked', blockReason: 'Fake files', blockedAt: '2026-06-01T12:00:00.000Z' },
      { username: 'alpha', isBlocked: true, blockReason: 'Corrupt uploads', blockedAt: '2026-06-02T12:00:00.000Z' },
    ]),
  });

  const result = await service.listBlockedSourceUsers();

  assert.equal(result.total, 2);
  assert.equal(result.blockedSourceUsers[0].username, 'alpha');
  assert.equal(result.blockedSourceUsers[1].username, 'zulu');
});

test('listBlockedSourceUsers filters by case-insensitive query', async () => {
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([
      { username: 'DJShadow', isBlocked: true, blockReason: 'Misleading folder names' },
      { username: 'cool-user', isBlocked: true, blockReason: 'Broken files' },
    ]),
  });

  const result = await service.listBlockedSourceUsers({ query: 'shadow' });

  assert.equal(result.total, 1);
  assert.equal(result.blockedSourceUsers[0].username, 'DJShadow');
});

test('blockSourceUser appends a new blocked row and persists the updated snapshot', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([]),
    replaceTrustSnapshot,
  });

  const result = await service.blockSourceUser({
    actorUserId: 'admin-1',
    operatorNotes: 'Repeated fake 24-bit labels',
    reason: 'Misleading metadata',
    username: 'bad-peer',
  });

  assert.equal(result.sourceUser.username, 'bad-peer');
  assert.equal(result.sourceUser.isBlocked, true);
  assert.equal(replaceTrustSnapshot.mock.callCount(), 1);
  assert.equal(replaceTrustSnapshot.mock.calls[0].arguments[0].sourceUsers.length, 1);
});

test('blockSourceUser updates an existing blocked row without duplicating usernames', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([
      {
        blockedAt: '2026-06-01T12:00:00.000Z',
        blockReason: 'Old reason',
        isBlocked: true,
        trustState: 'blocked',
        username: 'bad-peer',
      },
    ]),
    replaceTrustSnapshot,
  });

  const result = await service.blockSourceUser({
    actorUserId: 'admin-2',
    reason: 'Updated reason',
    username: 'BAD-PEER',
  });

  assert.equal(result.sourceUser.username, 'BAD-PEER');
  const [nextSnapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  assert.equal(nextSnapshot.sourceUsers.length, 1);
  assert.equal(nextSnapshot.sourceUsers[0].blockReason, 'Updated reason');
  assert.equal(nextSnapshot.sourceUsers[0].blockedAt, '2026-06-01T12:00:00.000Z');
});

test('unblockSourceUser clears block state and preserves the row', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([
      {
        blockReason: 'Malware spam',
        failureCount: 4,
        isBlocked: true,
        trustHistory: [{ id: 'existing', kind: 'blocklist_event', eventType: 'source_user_blocked' }],
        trustState: 'blocked',
        username: 'bad-peer',
      },
    ]),
    replaceTrustSnapshot,
  });

  const result = await service.unblockSourceUser({ actorUserId: 'admin-1', username: 'bad-peer' });

  assert.equal(result.sourceUser.username, 'bad-peer');
  const [nextSnapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  assert.equal(nextSnapshot.sourceUsers[0].isBlocked, false);
  assert.equal(nextSnapshot.sourceUsers[0].trustState, 'neutral');
  assert.equal(nextSnapshot.sourceUsers[0].failureCount, 4);
  assert.equal(nextSnapshot.sourceUsers[0].blockReason, null);
  assert.equal(nextSnapshot.sourceUsers[0].trustHistory.length, 2);
});

test('unblockSourceUser throws when the username is not currently blocked', async () => {
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([{ username: 'good-peer', trustState: 'neutral' }]),
  });

  await assert.rejects(
    () => service.unblockSourceUser({ username: 'bad-peer' }),
    (error) => error?.status === 404 && error?.code === 'source_user_block_not_found',
  );
});

test('blockSourceUser appends a blocklist_event to trust history', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([]),
    replaceTrustSnapshot,
  });

  await service.blockSourceUser({
    actorUserId: 'admin-1',
    reason: 'Fake files',
    username: 'bad-peer',
  });

  const [nextSnapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  const history = nextSnapshot.sourceUsers[0].trustHistory;

  assert.equal(history.length, 1);
  assert.equal(history[0].kind, 'blocklist_event');
  assert.equal(history[0].eventType, 'source_user_blocked');
  assert.equal(history[0].reason, 'Fake files');
  assert.equal(history[0].actorUserId, 'admin-1');
});

test('blockSourceUser does not duplicate history when re-blocking', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([{
      isBlocked: true,
      trustHistory: [{ id: 'existing', kind: 'blocklist_event', eventType: 'source_user_blocked' }],
      trustState: 'blocked',
      username: 'bad-peer',
    }]),
    replaceTrustSnapshot,
  });

  await service.blockSourceUser({ reason: 'Updated', username: 'bad-peer' });

  const [nextSnapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  assert.equal(nextSnapshot.sourceUsers[0].trustHistory.length, 1);
});

test('unblockSourceUser appends a blocklist_event to trust history', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => ([{
      isBlocked: true,
      trustHistory: [{ id: 'existing', kind: 'blocklist_event', eventType: 'source_user_blocked' }],
      trustState: 'blocked',
      username: 'bad-peer',
    }]),
    replaceTrustSnapshot,
  });

  await service.unblockSourceUser({ actorUserId: 'admin-2', username: 'bad-peer' });

  const [nextSnapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  const history = nextSnapshot.sourceUsers[0].trustHistory;

  assert.equal(history.length, 2);
  assert.equal(history[0].kind, 'blocklist_event');
  assert.equal(history[0].eventType, 'source_user_unblocked');
  assert.equal(history[0].actorUserId, 'admin-2');
  assert.equal(history[1].eventType, 'source_user_blocked');
});

test('blockSourceUser validates required fields', async () => {
  const service = createSourceUserBlocklistService();

  await assert.rejects(
    () => service.blockSourceUser({ reason: 'Because', username: '' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );

  await assert.rejects(
    () => service.blockSourceUser({ reason: '', username: 'peer' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

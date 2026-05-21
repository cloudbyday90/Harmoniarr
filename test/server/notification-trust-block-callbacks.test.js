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
import { createSourceUserTrustOverrideService } from '../../src/server/activity/source-user-trust-override-service.js';
import { createSourceUserBlocklistService } from '../../src/server/activity/source-user-blocklist-service.js';

test('updateSourceUserTrust calls onTrustOverrideFn after successful override', async (t) => {
  const onTrustOverrideFn = t.mock.fn(async () => {});
  const snapshot = [];
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onTrustOverrideFn,
  });

  await service.updateSourceUserTrust({
    actorUserId: 'admin-1',
    reason: 'reliable source',
    trustState: 'trusted',
    username: 'test-user',
  });

  assert.equal(onTrustOverrideFn.mock.callCount(), 1);
  const callArgs = onTrustOverrideFn.mock.calls[0].arguments[0];
  assert.equal(callArgs.actorUserId, 'admin-1');
  assert.equal(callArgs.reason, 'reliable source');
  assert.equal(callArgs.trustState, 'trusted');
  assert.equal(callArgs.username, 'test-user');
});

test('updateSourceUserTrust does not call onTrustOverrideFn when override fails', async (t) => {
  const onTrustOverrideFn = t.mock.fn(async () => {});
  const snapshot = [{ username: 'blocked-user', trustState: 'blocked', isBlocked: true }];
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onTrustOverrideFn,
  });

  await assert.rejects(
    () => service.updateSourceUserTrust({
      reason: 'test',
      trustState: 'trusted',
      username: 'blocked-user',
    }),
    { code: 'source_user_trust_blocked_use_blocklist' },
  );

  assert.equal(onTrustOverrideFn.mock.callCount(), 0);
});

test('updateSourceUserTrust swallows onTrustOverrideFn errors', async () => {
  const snapshot = [];
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onTrustOverrideFn: async () => { throw new Error('notification failed'); },
  });

  const result = await service.updateSourceUserTrust({
    actorUserId: 'admin-1',
    reason: 'reliable',
    trustState: 'trusted',
    username: 'user-1',
  });

  assert.equal(result.sourceUser.trustState, 'trusted');
});

test('blockSourceUser calls onBlockEventFn with blocked event type', async (t) => {
  const onBlockEventFn = t.mock.fn(async () => {});
  const snapshot = [];
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onBlockEventFn,
  });

  await service.blockSourceUser({
    actorUserId: 'admin-1',
    reason: 'spam',
    username: 'bad-user',
  });

  assert.equal(onBlockEventFn.mock.callCount(), 1);
  const callArgs = onBlockEventFn.mock.calls[0].arguments[0];
  assert.equal(callArgs.actorUserId, 'admin-1');
  assert.equal(callArgs.eventType, 'blocked');
  assert.equal(callArgs.reason, 'spam');
  assert.equal(callArgs.username, 'bad-user');
});

test('blockSourceUser does not call onBlockEventFn for re-block', async (t) => {
  const onBlockEventFn = t.mock.fn(async () => {});
  const snapshot = [{ username: 'already-blocked', trustState: 'blocked', isBlocked: true }];
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onBlockEventFn,
  });

  await service.blockSourceUser({
    actorUserId: 'admin-1',
    reason: 'spam again',
    username: 'already-blocked',
  });

  assert.equal(onBlockEventFn.mock.callCount(), 0);
});

test('unblockSourceUser calls onBlockEventFn with unblocked event type', async (t) => {
  const onBlockEventFn = t.mock.fn(async () => {});
  const snapshot = [{ username: 'blocked-user', trustState: 'blocked', isBlocked: true }];
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onBlockEventFn,
  });

  await service.unblockSourceUser({
    actorUserId: 'admin-1',
    username: 'blocked-user',
  });

  assert.equal(onBlockEventFn.mock.callCount(), 1);
  const callArgs = onBlockEventFn.mock.calls[0].arguments[0];
  assert.equal(callArgs.actorUserId, 'admin-1');
  assert.equal(callArgs.eventType, 'unblocked');
  assert.equal(callArgs.username, 'blocked-user');
});

test('blockSourceUser swallows onBlockEventFn errors', async () => {
  const snapshot = [];
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onBlockEventFn: async () => { throw new Error('dispatch failed'); },
  });

  const result = await service.blockSourceUser({
    actorUserId: 'admin-1',
    reason: 'spam',
    username: 'user-1',
  });

  assert.equal(result.sourceUser.isBlocked, true);
});

test('unblockSourceUser swallows onBlockEventFn errors', async () => {
  const snapshot = [{ username: 'user-1', trustState: 'blocked', isBlocked: true }];
  const service = createSourceUserBlocklistService({
    listTrustSnapshot: async () => snapshot,
    replaceTrustSnapshot: async () => {},
    onBlockEventFn: async () => { throw new Error('dispatch failed'); },
  });

  const result = await service.unblockSourceUser({
    actorUserId: 'admin-1',
    username: 'user-1',
  });

  assert.equal(result.sourceUser.username, 'user-1');
});

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
import { useSourceUserBlocklist } from '../../src/client/composables/useSourceUserBlocklist.js';

function makePayload(overrides = {}) {
  return {
    blockedSourceUsers: [],
    checkedAt: '2026-06-01T12:00:00.000Z',
    ok: true,
    total: 0,
    ...overrides,
  };
}

test('useSourceUserBlocklist loads blocklist state from the injected api', async (t) => {
  const fetchActivityBlocklist = t.mock.fn(async () => makePayload({
    blockedSourceUsers: [{ username: 'peer-1', blockReason: 'Bad files', isBlocked: true }],
    total: 1,
  }));
  const blocklist = useSourceUserBlocklist({ fetchActivityBlocklist });

  await blocklist.load();

  assert.equal(fetchActivityBlocklist.mock.callCount(), 1);
  assert.equal(blocklist.blocklist.value.length, 1);
  assert.equal(blocklist.blockedCount.value, 1);
  assert.equal(blocklist.checkedAt.value, '2026-06-01T12:00:00.000Z');
});

test('useSourceUserBlocklist clears stale state on load failure', async () => {
  let callCount = 0;
  const fetchActivityBlocklist = async () => {
    callCount += 1;
    if (callCount === 1) {
      return makePayload({
        blockedSourceUsers: [{ username: 'peer-1', blockReason: 'Bad files', isBlocked: true }],
        total: 1,
      });
    }

    throw new Error('Network down');
  };
  const blocklist = useSourceUserBlocklist({ fetchActivityBlocklist });

  await blocklist.load();
  assert.equal(blocklist.blockedCount.value, 1);

  await blocklist.load();
  assert.deepEqual(blocklist.blocklist.value, []);
  assert.equal(blocklist.total.value, 0);
  assert.ok(blocklist.errorMessage.value.length > 0);
});

test('useSourceUserBlocklist blockUser reloads data after a successful mutation', async (t) => {
  const fetchActivityBlocklist = t.mock.fn(async () => makePayload());
  const blockActivitySourceUser = t.mock.fn(async () => ({ ok: true }));
  const blocklist = useSourceUserBlocklist({
    blockActivitySourceUser,
    fetchActivityBlocklist,
  });

  const didBlock = await blocklist.blockUser({ reason: 'Bad files', username: 'peer-1' });

  assert.equal(didBlock, true);
  assert.equal(blockActivitySourceUser.mock.callCount(), 1);
  assert.equal(fetchActivityBlocklist.mock.callCount(), 1);
});

test('useSourceUserBlocklist unblockUser reloads data after a successful mutation', async (t) => {
  const fetchActivityBlocklist = t.mock.fn(async () => makePayload());
  const unblockActivitySourceUser = t.mock.fn(async () => ({ ok: true }));
  const blocklist = useSourceUserBlocklist({
    fetchActivityBlocklist,
    unblockActivitySourceUser,
  });

  const didUnblock = await blocklist.unblockUser('peer-1');

  assert.equal(didUnblock, true);
  assert.equal(unblockActivitySourceUser.mock.callCount(), 1);
  assert.equal(fetchActivityBlocklist.mock.callCount(), 1);
  assert.equal(blocklist.pendingUsername.value, '');
});

test('useSourceUserBlocklist surfaces action errors when block fails', async () => {
  const blocklist = useSourceUserBlocklist({
    blockActivitySourceUser: async () => {
      throw new Error('Validation failed');
    },
  });

  const didBlock = await blocklist.blockUser({ reason: 'Bad files', username: 'peer-1' });

  assert.equal(didBlock, false);
  assert.ok(blocklist.actionErrorMessage.value.length > 0);
});

test('useSourceUserBlocklist surfaces action errors when unblock fails', async () => {
  const blocklist = useSourceUserBlocklist({
    unblockActivitySourceUser: async () => {
      throw new Error('Not found');
    },
  });

  const didUnblock = await blocklist.unblockUser('peer-1');

  assert.equal(didUnblock, false);
  assert.ok(blocklist.actionErrorMessage.value.length > 0);
});

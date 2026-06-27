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
import { useActiveUsers, clearActiveUsersCache } from '../../src/client/composables/useActiveUsers.js';

function settle() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test('useActiveUsers resolves to active users from fetchUsersFn', async () => {
  clearActiveUsersCache();
  const { users, isLoading, error } = useActiveUsers({
    fetchUsersFn: async () => ({
      users: [
        { id: 'u1', username: 'alice', isDisabled: false },
        { id: 'u2', username: 'bob', isDisabled: false },
      ],
    }),
  });

  assert.equal(isLoading.value, true);
  assert.deepEqual(users.value, []);

  await settle();

  assert.equal(isLoading.value, false);
  assert.equal(error.value, null);
  assert.equal(users.value.length, 2);
  assert.equal(users.value[0].username, 'alice');
});

test('useActiveUsers filters out disabled users', async () => {
  clearActiveUsersCache();
  const { users } = useActiveUsers({
    fetchUsersFn: async () => ({
      users: [
        { id: 'u1', username: 'alice', isDisabled: false },
        { id: 'u2', username: 'disabled-user', isDisabled: true },
      ],
    }),
  });

  await settle();

  assert.equal(users.value.length, 1);
  assert.equal(users.value[0].username, 'alice');
});

test('useActiveUsers skips fetch and cached users when disabled', async () => {
  clearActiveUsersCache();
  let callCount = 0;
  const fetchUsersFn = async () => {
    callCount++;
    return { users: [{ id: 'u1', username: 'alice', isDisabled: false }] };
  };

  const enabled = useActiveUsers({ fetchUsersFn });
  await settle();
  assert.equal(enabled.users.value.length, 1);

  const disabled = useActiveUsers({ enabled: false, fetchUsersFn });
  await settle();

  assert.equal(callCount, 1);
  assert.equal(disabled.isLoading.value, false);
  assert.equal(disabled.error.value, null);
  assert.deepEqual(disabled.users.value, []);
});

test('useActiveUsers does not fetch when disabled before cache exists', async () => {
  clearActiveUsersCache();
  let callCount = 0;
  const { users, isLoading, error } = useActiveUsers({
    enabled: false,
    fetchUsersFn: async () => {
      callCount++;
      return { users: [{ id: 'u1', username: 'alice', isDisabled: false }] };
    },
  });

  await settle();

  assert.equal(callCount, 0);
  assert.equal(isLoading.value, false);
  assert.equal(error.value, null);
  assert.deepEqual(users.value, []);
});

test('useActiveUsers deduplicates concurrent fetch calls', async () => {
  clearActiveUsersCache();
  let callCount = 0;
  const fetchUsersFn = async () => {
    callCount++;
    return { users: [{ id: 'u1', username: 'alice', isDisabled: false }] };
  };

  const a = useActiveUsers({ fetchUsersFn });
  const b = useActiveUsers({ fetchUsersFn });

  await settle();

  assert.equal(callCount, 1);
  assert.equal(a.users.value.length, 1);
  assert.equal(b.users.value.length, 1);
});

test('useActiveUsers serves cached result without re-fetching', async () => {
  clearActiveUsersCache();
  let callCount = 0;
  const fetchUsersFn = async () => {
    callCount++;
    return { users: [{ id: 'u1', username: 'alice', isDisabled: false }] };
  };

  const first = useActiveUsers({ fetchUsersFn });
  await settle();

  // Second call after cache is populated
  const second = useActiveUsers({ fetchUsersFn });
  await settle();

  assert.equal(callCount, 1);
  assert.equal(second.isLoading.value, false);
  assert.equal(second.users.value.length, 1);
  assert.equal(first.users.value[0].id, second.users.value[0].id);
});

test('useActiveUsers sets error when fetchUsersFn rejects', async () => {
  clearActiveUsersCache();
  const fetchUsersFn = async () => {
    throw Object.assign(new Error('Network error'), { status: 503 });
  };

  const { users, isLoading, error } = useActiveUsers({ fetchUsersFn });

  await settle();

  assert.equal(isLoading.value, false);
  assert.equal(users.value.length, 0);
  assert.ok(error.value instanceof Error);
});

test('clearActiveUsersCache allows a fresh fetch on next call', async () => {
  clearActiveUsersCache();
  let callCount = 0;
  const fetchUsersFn = async () => {
    callCount++;
    return { users: [] };
  };

  useActiveUsers({ fetchUsersFn });
  await settle();
  clearActiveUsersCache();
  useActiveUsers({ fetchUsersFn });
  await settle();

  assert.equal(callCount, 2);
});

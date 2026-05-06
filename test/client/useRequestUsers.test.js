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
import { useRequestUsers } from '../../src/client/composables/useRequestUsers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'alice',
    role: 'requester',
    mediaRequestTarget: { eligible: true },
    ...overrides,
  };
}

function makeFetchUsersFn(users, { throws } = {}) {
  return async () => {
    if (throws) throw throws;
    return { ok: true, users };
  };
}

// ---------------------------------------------------------------------------
// loadUsers: happy path
// ---------------------------------------------------------------------------

test('useRequestUsers loadUsers populates users from the API response', async () => {
  const alice = makeUser({ id: 'u-1', username: 'alice' });
  const bob = makeUser({ id: 'u-2', username: 'bob' });
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([alice, bob]),
  });

  await loadUsers();

  assert.equal(users.value.length, 2);
  assert.equal(users.value[0].username, 'alice');
  assert.equal(users.value[1].username, 'bob');
});

test('useRequestUsers loadUsers maps users to { id, username, role }', async () => {
  const alice = makeUser({ id: 'u-1', username: 'alice', role: 'requester' });
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([alice]),
  });

  await loadUsers();

  const mapped = users.value[0];
  assert.deepEqual(Object.keys(mapped).sort(), ['id', 'role', 'username']);
  assert.equal(mapped.id, 'u-1');
  assert.equal(mapped.username, 'alice');
  assert.equal(mapped.role, 'requester');
});

test('useRequestUsers loadUsers filters out users where mediaRequestTarget.eligible is false', async () => {
  const eligible = makeUser({ id: 'u-1', username: 'eligible', mediaRequestTarget: { eligible: true } });
  const notEligible = makeUser({ id: 'u-2', username: 'not-eligible', mediaRequestTarget: { eligible: false } });
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([eligible, notEligible]),
  });

  await loadUsers();

  assert.equal(users.value.length, 1);
  assert.equal(users.value[0].username, 'eligible');
});

test('useRequestUsers loadUsers filters out users with no mediaRequestTarget', async () => {
  const withTarget = makeUser({ id: 'u-1', username: 'with-target', mediaRequestTarget: { eligible: true } });
  const noTarget = makeUser({ id: 'u-2', username: 'no-target', mediaRequestTarget: undefined });
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([withTarget, noTarget]),
  });

  await loadUsers();

  assert.equal(users.value.length, 1);
  assert.equal(users.value[0].username, 'with-target');
});

test('useRequestUsers loadUsers handles empty users array', async () => {
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([]),
  });

  await loadUsers();

  assert.equal(users.value.length, 0);
});

test('useRequestUsers loadUsers handles missing users key in response', async () => {
  const { users, loadUsers } = useRequestUsers({
    fetchUsersFn: async () => ({ ok: true }),
  });

  await loadUsers();

  assert.equal(users.value.length, 0);
});

// ---------------------------------------------------------------------------
// loadUsers: loading state management
// ---------------------------------------------------------------------------

test('useRequestUsers isLoading is false before loadUsers is called', () => {
  const { isLoading } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([]),
  });

  assert.equal(isLoading.value, false);
});

test('useRequestUsers isLoading becomes false after loadUsers resolves', async () => {
  const { isLoading, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([]),
  });

  await loadUsers();

  assert.equal(isLoading.value, false);
});

test('useRequestUsers isLoading becomes false after loadUsers fails', async () => {
  const { isLoading, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([], { throws: new Error('network error') }),
  });

  await loadUsers();

  assert.equal(isLoading.value, false);
});

// ---------------------------------------------------------------------------
// loadUsers: error handling
// ---------------------------------------------------------------------------

test('useRequestUsers loadUsers sets errorMessage on fetch failure', async () => {
  const boom = new Error('network error');
  const { errorMessage, loadUsers } = useRequestUsers({
    fetchUsersFn: makeFetchUsersFn([], { throws: boom }),
  });

  await loadUsers();

  assert.equal(errorMessage.value, 'network error');
});

test('useRequestUsers loadUsers sets a fallback errorMessage for non-Error throws', async () => {
  const { errorMessage, loadUsers } = useRequestUsers({
    fetchUsersFn: async () => { throw 'string-error'; },
  });

  await loadUsers();

  assert.match(errorMessage.value, /Could not load users/);
});

test('useRequestUsers loadUsers clears errorMessage before each new fetch attempt', async () => {
  let callCount = 0;
  const { errorMessage, loadUsers, users } = useRequestUsers({
    fetchUsersFn: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('first failure');
      return { ok: true, users: [makeUser()] };
    },
  });

  // First call — populates errorMessage
  await loadUsers();
  assert.equal(errorMessage.value, 'first failure');

  // Reset so the idempotent guard won't block the second call
  users.value = [];

  // Second call — should clear errorMessage and succeed
  await loadUsers();
  assert.equal(errorMessage.value, '');
  assert.equal(users.value.length, 1);
});

// ---------------------------------------------------------------------------
// loadUsers: idempotent guard
// ---------------------------------------------------------------------------

test('useRequestUsers loadUsers is a no-op when users are already populated', async () => {
  let fetchCount = 0;
  const { loadUsers } = useRequestUsers({
    fetchUsersFn: async () => {
      fetchCount += 1;
      return { ok: true, users: [makeUser()] };
    },
  });

  await loadUsers(); // first — fetches
  await loadUsers(); // second — should be skipped

  assert.equal(fetchCount, 1);
});

test('useRequestUsers loadUsers does not re-fetch when called multiple times concurrently', async () => {
  let fetchCount = 0;
  let resolve;
  const pendingPromise = new Promise((r) => { resolve = r; });

  const { loadUsers } = useRequestUsers({
    fetchUsersFn: async () => {
      fetchCount += 1;
      await pendingPromise;
      return { ok: true, users: [makeUser()] };
    },
  });

  // Fire two concurrent loads before the first resolves
  const first = loadUsers();
  const second = loadUsers(); // isLoading is true — should be skipped

  resolve();
  await Promise.all([first, second]);

  assert.equal(fetchCount, 1);
});

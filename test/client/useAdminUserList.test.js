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
import { useAdminUserList } from '../../src/client/composables/useAdminUserList.js';

test('useAdminUserList load fetches users with pagination', async () => {
  const { users, totalCount, isLoading, load } = useAdminUserList({
    fetchUsersFn: async () => ({
      users: [{ id: 'u-1', username: 'admin' }, { id: 'u-2', username: 'listener' }],
      totalCount: 10,
    }),
  });

  await load();

  assert.equal(users.value.length, 2);
  assert.equal(totalCount.value, 10);
  assert.equal(isLoading.value, false);
});

test('useAdminUserList load sets error on failure', async () => {
  const { errorMessage, load } = useAdminUserList({
    fetchUsersFn: async () => { throw new Error('Server error'); },
  });

  await load();

  assert.equal(errorMessage.value, 'Server error');
});

test('useAdminUserList loadMore appends users', async () => {
  let callCount = 0;
  const { users, load, loadMore, hasMore } = useAdminUserList({
    fetchUsersFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        return { users: [{ id: 'u-1' }], totalCount: 3 };
      }
      return { users: [{ id: 'u-2' }, { id: 'u-3' }], totalCount: 3 };
    },
    pageSize: 1,
  });

  await load();
  assert.equal(users.value.length, 1);
  assert.equal(hasMore(), true);

  await loadMore();
  assert.equal(users.value.length, 3);
  assert.equal(hasMore(), false);
  assert.equal(callCount, 2);
});

test('useAdminUserList loadMore is no-op when no more results', async () => {
  let callCount = 0;
  const { users, load, loadMore } = useAdminUserList({
    fetchUsersFn: async () => {
      callCount += 1;
      return { users: [{ id: 'u-1' }], totalCount: 1 };
    },
    pageSize: 50,
  });

  await load();
  await loadMore();

  assert.equal(users.value.length, 1);
  assert.equal(callCount, 1);
});

test('useAdminUserList setSearch and setRoleFilter update filter state', async () => {
  const { search, roleFilter, setSearch, setRoleFilter } = useAdminUserList();

  setSearch('admin');
  setRoleFilter('admin');

  assert.equal(search.value, 'admin');
  assert.equal(roleFilter.value, 'admin');
});

test('useAdminUserList resetFilters clears all filters', async () => {
  const { search, roleFilter, statusFilter, setSearch, setRoleFilter, setStatusFilter, resetFilters } = useAdminUserList();

  setSearch('test');
  setRoleFilter('admin');
  setStatusFilter('true');
  resetFilters();

  assert.equal(search.value, '');
  assert.equal(roleFilter.value, '');
  assert.equal(statusFilter.value, '');
});

test('useAdminUserList reset clears all state', async () => {
  const { users, totalCount, errorMessage, load, reset } = useAdminUserList({
    fetchUsersFn: async () => ({ users: [{ id: 'u-1' }], totalCount: 5 }),
  });

  await load();
  assert.equal(users.value.length, 1);

  reset();
  assert.equal(users.value.length, 0);
  assert.equal(totalCount.value, 0);
  assert.equal(errorMessage.value, '');
});

test('useAdminUserList hasMore returns false when totalCount is 0', async () => {
  const { hasMore, load } = useAdminUserList({
    fetchUsersFn: async () => ({ users: [], totalCount: 0 }),
  });

  await load();
  assert.equal(hasMore(), false);
});

test('useAdminUserList load passes filters to fetchUsersFn', async () => {
  let capturedParams = null;
  const { setSearch, setRoleFilter, setStatusFilter, load } = useAdminUserList({
    fetchUsersFn: async (params) => {
      capturedParams = params;
      return { users: [], totalCount: 0 };
    },
  });

  setSearch('listener');
  setRoleFilter('requester');
  setStatusFilter('false');
  await load();

  assert.equal(capturedParams.search, 'listener');
  assert.equal(capturedParams.role, 'requester');
  assert.equal(capturedParams.isDisabled, 'false');
  assert.equal(capturedParams.limit, 50);
  assert.equal(capturedParams.offset, 0);
});

test('useAdminUserList load skips empty filter values', async () => {
  let capturedParams = null;
  const { load } = useAdminUserList({
    fetchUsersFn: async (params) => {
      capturedParams = params;
      return { users: [], totalCount: 0 };
    },
  });

  await load();

  assert.equal(capturedParams.search, undefined);
  assert.equal(capturedParams.role, undefined);
  assert.equal(capturedParams.isDisabled, undefined);
});

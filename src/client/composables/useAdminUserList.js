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

import { readonly, ref, shallowRef, watch } from 'vue';
import { fetchUsers as defaultFetchUsers } from '../lib/users-api.js';
import { useAsyncResource } from './useAsyncResource.js';

const PAGE_SIZE = 50;

export function useAdminUserList({
  fetchUsersFn = defaultFetchUsers,
  pageSize = PAGE_SIZE,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const users = shallowRef([]);
  const isLoadingMore = ref(false);
  const totalCount = ref(0);
  const search = ref('');
  const roleFilter = ref('');
  const statusFilter = ref('');

  function buildParams({ offset = 0 } = {}) {
    return {
      limit: pageSize,
      offset,
      ...(search.value ? { search: search.value } : {}),
      ...(roleFilter.value ? { role: roleFilter.value } : {}),
      ...(statusFilter.value ? { isDisabled: statusFilter.value } : {}),
    };
  }

  const {
    data: listPayload,
    destroy: destroyResource,
    errorMessage,
    isLoading,
    isRevalidating,
    load: loadResource,
    reset: resetResource,
  } = useAsyncResource({
    fetcher: () => fetchUsersFn(buildParams()),
    project: (payload) => ({
      users: payload.users ?? [],
      totalCount: payload.totalCount ?? 0,
    }),
    initialData: { users: [], totalCount: 0 },
    immediate: false,
    fallbackErrorMessage: 'Failed to load users',
    pollIntervalMs,
    revalidateOnFocus,
  });

  watch(listPayload, (payload) => {
    users.value = payload.users;
    totalCount.value = payload.totalCount;
  });

  async function load() {
    if (isLoading.value) return;
    await loadResource();
    users.value = listPayload.value.users;
    totalCount.value = listPayload.value.totalCount;
  }

  async function revalidate() {
    await loadResource();
    users.value = listPayload.value.users;
    totalCount.value = listPayload.value.totalCount;
  }

  async function loadMore() {
    if (isLoadingMore.value || users.value.length >= totalCount.value) return;
    isLoadingMore.value = true;

    try {
      const payload = await fetchUsersFn(buildParams({ offset: users.value.length }));
      users.value = [...users.value, ...(payload.users ?? [])];
      totalCount.value = payload.totalCount ?? 0;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load more users';
    } finally {
      isLoadingMore.value = false;
    }
  }

  function hasMore() {
    return users.value.length < totalCount.value;
  }

  function setSearch(value) {
    search.value = value;
  }

  function setRoleFilter(value) {
    roleFilter.value = value;
  }

  function setStatusFilter(value) {
    statusFilter.value = value;
  }

  function resetFilters() {
    search.value = '';
    roleFilter.value = '';
    statusFilter.value = '';
  }

  function reset() {
    resetResource();
    users.value = [];
    totalCount.value = 0;
    search.value = '';
    roleFilter.value = '';
    statusFilter.value = '';
  }

  function destroy() {
    destroyResource();
  }

  return {
    destroy,
    errorMessage: readonly(errorMessage),
    hasMore,
    isLoading: readonly(isLoading),
    isLoadingMore: readonly(isLoadingMore),
    isRevalidating: readonly(isRevalidating),
    load,
    loadMore,
    reset,
    resetFilters,
    revalidate,
    roleFilter: readonly(roleFilter),
    search: readonly(search),
    setRoleFilter,
    setSearch,
    setStatusFilter,
    statusFilter: readonly(statusFilter),
    totalCount: readonly(totalCount),
    users,
  };
}

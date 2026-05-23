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

import { readonly, ref, shallowRef } from 'vue';
import { fetchUsers as defaultFetchUsers } from '../lib/users-api.js';

const PAGE_SIZE = 50;

export function useAdminUserList({
  fetchUsersFn = defaultFetchUsers,
  pageSize = PAGE_SIZE,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const users = shallowRef([]);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  const totalCount = ref(0);

  const search = ref('');
  const roleFilter = ref('');
  const statusFilter = ref('');

  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  function buildParams({ offset = 0 } = {}) {
    return {
      limit: pageSize,
      offset,
      ...(search.value ? { search: search.value } : {}),
      ...(roleFilter.value ? { role: roleFilter.value } : {}),
      ...(statusFilter.value ? { isDisabled: statusFilter.value } : {}),
    };
  }

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!hasLoaded) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await revalidate();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void revalidate().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function load() {
    if (isLoading.value) return;
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchUsersFn(buildParams());
      users.value = payload.users ?? [];
      totalCount.value = payload.totalCount ?? 0;
      hasLoaded = true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load users';
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchUsersFn(buildParams());
      users.value = payload.users ?? [];
      totalCount.value = payload.totalCount ?? 0;
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
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
    clearPollTimer();
    users.value = [];
    totalCount.value = 0;
    errorMessage.value = '';
    search.value = '';
    roleFilter.value = '';
    statusFilter.value = '';
    hasLoaded = false;
  }

  return {
    attachVisibilityListener,
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

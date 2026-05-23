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
import { fetchUserDetail as defaultFetchUserDetail, fetchUserActivity as defaultFetchUserActivity } from '../lib/users-api.js';

const ACTIVITY_PAGE_SIZE = 25;

export function useUserDetail({
  fetchUserDetailFn = defaultFetchUserDetail,
  fetchUserActivityFn = defaultFetchUserActivity,
  pageSize = ACTIVITY_PAGE_SIZE,
} = {}) {
  const user = shallowRef(null);
  const requestSummary = shallowRef(null);
  const sessions = shallowRef([]);
  const activityEvents = shallowRef([]);
  const isLoading = ref(false);
  const isLoadingActivity = ref(false);
  const errorMessage = ref('');
  const hasMoreActivity = ref(false);
  const nextCursor = ref(null);

  async function load({ userId }) {
    if (isLoading.value) return;
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchUserDetailFn(userId);
      user.value = payload.user ?? null;
      requestSummary.value = payload.requestSummary ?? null;
      sessions.value = payload.sessions ?? [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load user detail';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadActivity({ userId }) {
    if (isLoadingActivity.value) return;
    isLoadingActivity.value = true;

    try {
      const payload = await fetchUserActivityFn(userId, { cursor: nextCursor.value, limit: pageSize });
      const newEvents = payload.events ?? [];
      if (nextCursor.value) {
        activityEvents.value = [...activityEvents.value, ...newEvents];
      } else {
        activityEvents.value = newEvents;
      }
      hasMoreActivity.value = payload.hasMore ?? false;
      nextCursor.value = payload.nextCursor ?? null;
    } catch {
      // silently ignore activity load failures
    } finally {
      isLoadingActivity.value = false;
    }
  }

  function reset() {
    user.value = null;
    requestSummary.value = null;
    sessions.value = [];
    activityEvents.value = [];
    errorMessage.value = '';
    hasMoreActivity.value = false;
    nextCursor.value = null;
  }

  return {
    activityEvents: readonly(activityEvents),
    errorMessage: readonly(errorMessage),
    hasMoreActivity: readonly(hasMoreActivity),
    isLoading: readonly(isLoading),
    isLoadingActivity: readonly(isLoadingActivity),
    load,
    loadActivity,
    requestSummary: readonly(requestSummary),
    reset,
    sessions: readonly(sessions),
    user: readonly(user),
  };
}

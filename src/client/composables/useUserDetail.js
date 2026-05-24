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

import { computed, readonly, ref, shallowRef } from 'vue';
import {
  adminRevokeAllUserSessions as defaultAdminRevokeAllUserSessions,
  adminRevokeUserSession as defaultAdminRevokeUserSession,
  fetchUserDetail as defaultFetchUserDetail,
  fetchUserActivity as defaultFetchUserActivity,
} from '../lib/users-api.js';
import { useAsyncResource } from './useAsyncResource.js';

const ACTIVITY_PAGE_SIZE = 25;

export function useUserDetail({
  adminRevokeAllUserSessionsFn = defaultAdminRevokeAllUserSessions,
  adminRevokeUserSessionFn = defaultAdminRevokeUserSession,
  fetchUserDetailFn = defaultFetchUserDetail,
  fetchUserActivityFn = defaultFetchUserActivity,
  pageSize = ACTIVITY_PAGE_SIZE,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  let currentUserId = null;

  const {
    data: detailPayload,
    destroy: destroyDetail,
    errorMessage,
    isLoading,
    isRevalidating,
    load: loadDetail,
    reset: resetDetail,
  } = useAsyncResource({
    fetcher: () => fetchUserDetailFn(currentUserId),
    project: (payload) => ({
      user: payload.user ?? null,
      requestSummary: payload.requestSummary ?? null,
      sessions: payload.sessions ?? [],
    }),
    initialData: { user: null, requestSummary: null, sessions: [] },
    immediate: false,
    fallbackErrorMessage: 'Failed to load user detail',
    pollIntervalMs,
    revalidateOnFocus,
  });

  const user = computed(() => detailPayload.value.user);
  const requestSummary = computed(() => detailPayload.value.requestSummary);
  const sessions = computed(() => detailPayload.value.sessions);

  const activityEvents = shallowRef([]);
  const isLoadingActivity = ref(false);
  const hasMoreActivity = ref(false);
  const nextCursor = ref(null);

  const isRevokingSession = ref(false);
  const isRevokingAllSessions = ref(false);
  const revokeErrorMessage = ref('');
  const revokeSuccessMessage = ref('');

  async function load({ userId }) {
    if (isLoading.value) return;
    currentUserId = userId;
    activityEvents.value = [];
    hasMoreActivity.value = false;
    nextCursor.value = null;
    await loadDetail();
  }

  async function loadActivity({ userId }) {
    if (isLoadingActivity.value) return;
    if (!currentUserId) currentUserId = userId;
    isLoadingActivity.value = true;

    try {
      const payload = await fetchUserActivityFn(currentUserId, { cursor: nextCursor.value, limit: pageSize });
      const newEvents = payload.events ?? [];
      if (nextCursor.value) {
        activityEvents.value = [...activityEvents.value, ...newEvents];
      } else {
        activityEvents.value = newEvents;
      }
      hasMoreActivity.value = payload.hasMore ?? false;
      nextCursor.value = payload.nextCursor ?? null;
    } catch {
    } finally {
      isLoadingActivity.value = false;
    }
  }

  function reset() {
    currentUserId = null;
    resetDetail();
    activityEvents.value = [];
    hasMoreActivity.value = false;
    nextCursor.value = null;
    revokeErrorMessage.value = '';
    revokeSuccessMessage.value = '';
  }

  function destroy() {
    destroyDetail();
  }

  async function revalidate() {
    if (!currentUserId) return;
    await loadDetail();
  }

  async function revokeUserSession(refreshTokenId) {
    if (!user.value) return;
    isRevokingSession.value = true;
    revokeErrorMessage.value = '';
    revokeSuccessMessage.value = '';

    try {
      await adminRevokeUserSessionFn(user.value.id, refreshTokenId);
      detailPayload.value = {
        ...detailPayload.value,
        sessions: detailPayload.value.sessions.map((s) =>
          s.id === refreshTokenId ? { ...s, isRevoked: true } : s,
        ),
      };
      revokeSuccessMessage.value = 'Session revoked.';
      void loadDetail();
    } catch (error) {
      revokeErrorMessage.value = error instanceof Error ? error.message : 'Failed to revoke session';
      throw error;
    } finally {
      isRevokingSession.value = false;
    }
  }

  async function revokeAllUserSessions() {
    if (!user.value) return;
    isRevokingAllSessions.value = true;
    revokeErrorMessage.value = '';
    revokeSuccessMessage.value = '';

    try {
      const result = await adminRevokeAllUserSessionsFn(user.value.id);
      detailPayload.value = {
        ...detailPayload.value,
        sessions: detailPayload.value.sessions.map((s) => ({ ...s, isRevoked: true })),
      };
      revokeSuccessMessage.value = `Revoked ${result.revokedSessionCount} session${result.revokedSessionCount === 1 ? '' : 's'}.`;
      void loadDetail();
    } catch (error) {
      revokeErrorMessage.value = error instanceof Error ? error.message : 'Failed to revoke sessions';
      throw error;
    } finally {
      isRevokingAllSessions.value = false;
    }
  }

  return {
    activityEvents: readonly(activityEvents),
    destroy,
    errorMessage: readonly(errorMessage),
    hasMoreActivity: readonly(hasMoreActivity),
    isLoading: readonly(isLoading),
    isLoadingActivity: readonly(isLoadingActivity),
    isRevalidating: readonly(isRevalidating),
    isRevokingAllSessions: readonly(isRevokingAllSessions),
    isRevokingSession: readonly(isRevokingSession),
    load,
    loadActivity,
    requestSummary,
    reset,
    revokeAllUserSessions,
    revokeErrorMessage: readonly(revokeErrorMessage),
    revokeUserSession,
    revokeSuccessMessage: readonly(revokeSuccessMessage),
    revalidate,
    sessions,
    user,
  };
}

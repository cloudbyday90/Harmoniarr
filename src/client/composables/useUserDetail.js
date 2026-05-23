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
import {
  adminRevokeAllUserSessions as defaultAdminRevokeAllUserSessions,
  adminRevokeUserSession as defaultAdminRevokeUserSession,
  fetchUserDetail as defaultFetchUserDetail,
  fetchUserActivity as defaultFetchUserActivity,
} from '../lib/users-api.js';

const ACTIVITY_PAGE_SIZE = 25;

export function useUserDetail({
  adminRevokeAllUserSessionsFn = defaultAdminRevokeAllUserSessions,
  adminRevokeUserSessionFn = defaultAdminRevokeUserSession,
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
  const isRevokingSession = ref(false);
  const isRevokingAllSessions = ref(false);
  const revokeErrorMessage = ref('');
  const revokeSuccessMessage = ref('');

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
    revokeErrorMessage.value = '';
    revokeSuccessMessage.value = '';
  }

  async function revokeUserSession(refreshTokenId) {
    if (!user.value) return;
    isRevokingSession.value = true;
    revokeErrorMessage.value = '';
    revokeSuccessMessage.value = '';

    try {
      await adminRevokeUserSessionFn(user.value.id, refreshTokenId);
      sessions.value = sessions.value.map((s) =>
        s.id === refreshTokenId ? { ...s, isRevoked: true } : s,
      );
      revokeSuccessMessage.value = 'Session revoked.';
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
      sessions.value = sessions.value.map((s) => ({ ...s, isRevoked: true }));
      revokeSuccessMessage.value = `Revoked ${result.revokedSessionCount} session${result.revokedSessionCount === 1 ? '' : 's'}.`;
    } catch (error) {
      revokeErrorMessage.value = error instanceof Error ? error.message : 'Failed to revoke sessions';
      throw error;
    } finally {
      isRevokingAllSessions.value = false;
    }
  }

  return {
    activityEvents: readonly(activityEvents),
    errorMessage: readonly(errorMessage),
    hasMoreActivity: readonly(hasMoreActivity),
    isLoading: readonly(isLoading),
    isLoadingActivity: readonly(isLoadingActivity),
    isRevokingAllSessions: readonly(isRevokingAllSessions),
    isRevokingSession: readonly(isRevokingSession),
    load,
    loadActivity,
    requestSummary: readonly(requestSummary),
    reset,
    revokeAllUserSessions,
    revokeErrorMessage: readonly(revokeErrorMessage),
    revokeUserSession,
    revokeSuccessMessage: readonly(revokeSuccessMessage),
    sessions: readonly(sessions),
    user: readonly(user),
  };
}

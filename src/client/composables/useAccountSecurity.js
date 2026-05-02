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

import { ref } from 'vue';
import {
  changePassword as changePasswordRequest,
  fetchActiveSessions,
  fetchRecentActivity,
  revokeSession as revokeSessionRequest,
} from '../lib/account-security-api.js';
import { sessionStore } from '../state/session.js';

export function useAccountSecurity() {
  const actionErrorMessage = ref('');
  const activityErrorMessage = ref('');
  const isChangingPassword = ref(false);
  const isLoadingActivity = ref(false);
  const isLoadingSessions = ref(false);
  const recentActivity = ref([]);
  const revokingSessionId = ref('');
  const sessionErrorMessage = ref('');
  const sessions = ref([]);
  const successMessage = ref('');

  async function loadSessions() {
    isLoadingSessions.value = true;
    sessionErrorMessage.value = '';

    try {
      const payload = await fetchActiveSessions();
      sessions.value = payload.sessions ?? [];
      return payload;
    } catch (error) {
      sessionErrorMessage.value = error instanceof Error ? error.message : 'Session list failed to load';
      throw error;
    } finally {
      isLoadingSessions.value = false;
    }
  }

  async function loadRecentActivity() {
    isLoadingActivity.value = true;
    activityErrorMessage.value = '';

    try {
      const payload = await fetchRecentActivity();
      recentActivity.value = payload.events ?? [];
      return payload;
    } catch (error) {
      activityErrorMessage.value = error instanceof Error ? error.message : 'Recent activity failed to load';
      throw error;
    } finally {
      isLoadingActivity.value = false;
    }
  }

  async function changePassword({ currentPassword, newPassword }) {
    isChangingPassword.value = true;
    actionErrorMessage.value = '';
    successMessage.value = '';

    try {
      const payload = await changePasswordRequest({ currentPassword, newPassword });
      sessionStore.applySessionPayload(payload);
      successMessage.value = 'Password updated. Other active sessions were revoked.';
      await loadSessions();
      try {
        await loadRecentActivity();
      } catch {
        // Keep the password change successful even if the activity refresh fails.
      }
      return payload;
    } catch (error) {
      actionErrorMessage.value = error instanceof Error ? error.message : 'Password change failed';
      throw error;
    } finally {
      isChangingPassword.value = false;
    }
  }

  async function revokeSession(refreshTokenId) {
    revokingSessionId.value = refreshTokenId;
    actionErrorMessage.value = '';
    successMessage.value = '';

    try {
      await revokeSessionRequest(refreshTokenId);
      sessions.value = sessions.value.filter((session) => session.id !== refreshTokenId);
      successMessage.value = 'Session revoked.';
      try {
        await loadRecentActivity();
      } catch {
        // Keep the revocation successful even if the activity refresh fails.
      }
    } catch (error) {
      actionErrorMessage.value = error instanceof Error ? error.message : 'Session revocation failed';
      throw error;
    } finally {
      revokingSessionId.value = '';
    }
  }

  return {
    actionErrorMessage,
    activityErrorMessage,
    changePassword,
    isChangingPassword,
    isLoadingActivity,
    isLoadingSessions,
    loadRecentActivity,
    loadSessions,
    recentActivity,
    revokeSession,
    revokingSessionId,
    sessionErrorMessage,
    sessions,
    successMessage,
  };
}
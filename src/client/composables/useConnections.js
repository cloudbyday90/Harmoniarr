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

import { readonly, ref } from 'vue';
import {
  clearSpotifyOAuth,
  clearYouTubeOAuth,
  startSpotifyOAuth,
  startYouTubeOAuth,
} from '../lib/settings-api.js';
import { useSettingsForm } from './useSettingsForm.js';

function defaultRedirectToUrl(url) {
  window.location.href = url;
}

function updateOAuthStatus(secretStatus, providerKey, status) {
  if (secretStatus.value?.providers) {
    secretStatus.value.providers[providerKey] = status;
  }
}

function buildOAuthActionFailureMessage(providerName, action) {
  return `${providerName} authorization could not ${action}. Try again.`;
}

export function useConnections({
  clearSpotifyOAuthFn = clearSpotifyOAuth,
  clearYouTubeOAuthFn = clearYouTubeOAuth,
  redirectToUrl = defaultRedirectToUrl,
  startSpotifyOAuthFn = startSpotifyOAuth,
  startYouTubeOAuthFn = startYouTubeOAuth,
  useSettingsFormFn = useSettingsForm,
  onSaveSuccess,
} = {}) {
  const isStartingSpotifyOAuth = ref(false);
  const isClearingSpotifyOAuth = ref(false);
  const isStartingYouTubeOAuth = ref(false);
  const isClearingYouTubeOAuth = ref(false);
  const connectionActionFeedback = ref(null);
  const secretStatus = ref(null);

  const settingsForm = useSettingsFormFn({
    extraApply: (payload) => {
      secretStatus.value = payload.secretStatus ?? null;
      const slskdStatus = secretStatus.value?.slskd;
      if (slskdStatus?.providerModeLocked && settingsForm.form.slskd.providerMode !== 'disabled') {
        settingsForm.form.slskd.providerMode = slskdStatus.providerMode;
      }
    },
    onSaveSuccess,
  });

  const {
    errorMessage,
    form,
    hasSaved,
    isDirty,
    isLoading,
    isSaving,
    loadErrorMessage,
    loadSettings,
    saveErrorMessage,
    saveSettings,
    successMessage,
  } = settingsForm;

  function clearConnectionActionFeedback() {
    connectionActionFeedback.value = null;
  }

  async function connectSpotifyOAuth() {
    isStartingSpotifyOAuth.value = true;
    connectionActionFeedback.value = null;
    errorMessage.value = '';
    try {
      const payload = await startSpotifyOAuthFn();
      redirectToUrl(payload.authorizationUrl);
    } catch {
      const message = buildOAuthActionFailureMessage('Spotify', 'start');
      errorMessage.value = message;
      connectionActionFeedback.value = { message, tone: 'danger' };
      isStartingSpotifyOAuth.value = false;
    }
  }

  async function disconnectSpotifyOAuth() {
    isClearingSpotifyOAuth.value = true;
    connectionActionFeedback.value = null;
    errorMessage.value = '';
    try {
      const payload = await clearSpotifyOAuthFn();
      updateOAuthStatus(secretStatus, 'spotifyOAuth', payload.status);
      successMessage.value = 'Spotify authorization cleared.';
      connectionActionFeedback.value = { message: successMessage.value, tone: 'success' };
    } catch {
      const message = buildOAuthActionFailureMessage('Spotify', 'be cleared');
      errorMessage.value = message;
      connectionActionFeedback.value = { message, tone: 'danger' };
    } finally {
      isClearingSpotifyOAuth.value = false;
    }
  }

  async function connectYouTubeOAuth() {
    isStartingYouTubeOAuth.value = true;
    connectionActionFeedback.value = null;
    errorMessage.value = '';
    try {
      const payload = await startYouTubeOAuthFn();
      redirectToUrl(payload.authorizationUrl);
    } catch {
      const message = buildOAuthActionFailureMessage('YouTube', 'start');
      errorMessage.value = message;
      connectionActionFeedback.value = { message, tone: 'danger' };
      isStartingYouTubeOAuth.value = false;
    }
  }

  async function disconnectYouTubeOAuth() {
    isClearingYouTubeOAuth.value = true;
    connectionActionFeedback.value = null;
    errorMessage.value = '';
    try {
      const payload = await clearYouTubeOAuthFn();
      updateOAuthStatus(secretStatus, 'youtubeOAuth', payload.status);
      successMessage.value = 'YouTube authorization cleared.';
      connectionActionFeedback.value = { message: successMessage.value, tone: 'success' };
    } catch {
      const message = buildOAuthActionFailureMessage('YouTube', 'be cleared');
      errorMessage.value = message;
      connectionActionFeedback.value = { message, tone: 'danger' };
    } finally {
      isClearingYouTubeOAuth.value = false;
    }
  }

  return {
    connectSpotifyOAuth,
    connectYouTubeOAuth,
    clearConnectionActionFeedback,
    connectionActionFeedback: readonly(connectionActionFeedback),
    disconnectSpotifyOAuth,
    disconnectYouTubeOAuth,
    errorMessage,
    form,
    hasSaved,
    isClearingSpotifyOAuth: readonly(isClearingSpotifyOAuth),
    isClearingYouTubeOAuth: readonly(isClearingYouTubeOAuth),
    isDirty,
    isLoading,
    isSaving,
    isStartingSpotifyOAuth: readonly(isStartingSpotifyOAuth),
    isStartingYouTubeOAuth: readonly(isStartingYouTubeOAuth),
    loadErrorMessage,
    loadSettings,
    saveErrorMessage,
    saveSettings,
    secretStatus: readonly(secretStatus),
    successMessage,
  };
}

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
  const secretStatus = ref(null);

  const settingsForm = useSettingsFormFn({
    extraApply: (payload) => {
      secretStatus.value = payload.secretStatus ?? null;
    },
    onSaveSuccess,
  });

  const {
    errorMessage,
    form,
    isLoading,
    isSaving,
    loadSettings,
    saveSettings,
    successMessage,
  } = settingsForm;

  async function connectSpotifyOAuth() {
    isStartingSpotifyOAuth.value = true;
    errorMessage.value = '';
    try {
      const payload = await startSpotifyOAuthFn();
      redirectToUrl(payload.authorizationUrl);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization start failed';
      isStartingSpotifyOAuth.value = false;
    }
  }

  async function disconnectSpotifyOAuth() {
    isClearingSpotifyOAuth.value = true;
    errorMessage.value = '';
    try {
      const payload = await clearSpotifyOAuthFn();
      updateOAuthStatus(secretStatus, 'spotifyOAuth', payload.status);
      successMessage.value = 'Spotify authorization cleared.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization clear failed';
    } finally {
      isClearingSpotifyOAuth.value = false;
    }
  }

  async function connectYouTubeOAuth() {
    isStartingYouTubeOAuth.value = true;
    errorMessage.value = '';
    try {
      const payload = await startYouTubeOAuthFn();
      redirectToUrl(payload.authorizationUrl);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization start failed';
      isStartingYouTubeOAuth.value = false;
    }
  }

  async function disconnectYouTubeOAuth() {
    isClearingYouTubeOAuth.value = true;
    errorMessage.value = '';
    try {
      const payload = await clearYouTubeOAuthFn();
      updateOAuthStatus(secretStatus, 'youtubeOAuth', payload.status);
      successMessage.value = 'YouTube authorization cleared.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization clear failed';
    } finally {
      isClearingYouTubeOAuth.value = false;
    }
  }

  return {
    connectSpotifyOAuth,
    connectYouTubeOAuth,
    disconnectSpotifyOAuth,
    disconnectYouTubeOAuth,
    errorMessage,
    form,
    isClearingSpotifyOAuth: readonly(isClearingSpotifyOAuth),
    isClearingYouTubeOAuth: readonly(isClearingYouTubeOAuth),
    isLoading,
    isSaving,
    isStartingSpotifyOAuth: readonly(isStartingSpotifyOAuth),
    isStartingYouTubeOAuth: readonly(isStartingYouTubeOAuth),
    loadSettings,
    saveSettings,
    secretStatus: readonly(secretStatus),
    successMessage,
  };
}

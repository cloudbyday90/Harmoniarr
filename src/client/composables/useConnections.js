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

import { computed, readonly, ref } from 'vue';
import {
  clearSpotifyOAuth,
  clearYouTubeOAuth,
  startSpotifyOAuth,
  startYouTubeOAuth,
} from '../lib/settings-api.js';
import { useSettingsForm } from './useSettingsForm.js';
import { useProviderAuthorizationActions } from './useProviderAuthorizationActions.js';
import { useProviderAuthorizationStatus } from './useProviderAuthorizationStatus.js';
import { sessionStore } from '../state/session.js';

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
  getSession = () => sessionStore.state,
  fetchSessionFn,
  fetchStatusFn,
  pageTarget,
  onSaveSuccess,
} = {}) {
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
    loadSettings: loadSettingsForm,
    saveErrorMessage,
    saveSettings: saveSettingsForm,
    successMessage,
  } = settingsForm;

  const savedStatus = useProviderAuthorizationStatus({ getSession, fetchSessionFn, fetchStatusFn,
    canCheck: () => !isLoading.value && !isSaving.value && !actions.isPending.value,
    onObserved: (provider, linked) => updateOAuthStatus(secretStatus, `${provider}OAuth`, { linked }),
  });
  const actions = useProviderAuthorizationActions({
    pageTarget,
    start: { spotify: startSpotifyOAuthFn, youtube: startYouTubeOAuthFn },
    clear: { spotify: clearSpotifyOAuthFn, youtube: clearYouTubeOAuthFn },
    redirectToUrl,
    canRun: (provider, kind) => !isLoading.value && !isSaving.value && !savedStatus.sessionBlocked.value
      && (kind === 'start' || secretStatus.value?.providers?.[`${provider}OAuth`]?.linked === true),
    onCleared: (provider, status) => updateOAuthStatus(secretStatus, `${provider}OAuth`, status),
    onAdmitted: savedStatus.reset,
    onReviewNeeded: provider => { void savedStatus.review(provider); },
    onFeedback: feedback => {
      errorMessage.value = feedback?.tone === 'danger' ? feedback.message : '';
      successMessage.value = feedback?.tone === 'success' ? feedback.message : '';
    },
  });
  const isStartingSpotifyOAuth = computed(() => actions.pendingAction.value === 'spotify_start');
  const isClearingSpotifyOAuth = computed(() => actions.pendingAction.value === 'spotify_clear');
  const isStartingYouTubeOAuth = computed(() => actions.pendingAction.value === 'youtube_start');
  const isClearingYouTubeOAuth = computed(() => actions.pendingAction.value === 'youtube_clear');
  const connectSpotifyOAuth = () => actions.run('spotify', 'start');
  const disconnectSpotifyOAuth = () => actions.run('spotify', 'clear');
  const connectYouTubeOAuth = () => actions.run('youtube', 'start');
  const disconnectYouTubeOAuth = () => actions.run('youtube', 'clear');
  async function loadSettings() { if (!actions.isPending.value) { savedStatus.reset(); return loadSettingsForm(); } }
  async function saveSettings() { if (actions.isPending.value) return { ok: false }; savedStatus.reset(); return saveSettingsForm(); }

  return {
    connectSpotifyOAuth,
    connectYouTubeOAuth,
    clearConnectionActionFeedback: actions.clearFeedback,
    connectionActionFeedback: actions.feedback,
    isProviderAuthorizationPending: actions.isPending,
    isProviderAuthorizationSessionBlocked: savedStatus.sessionBlocked,
    providerAuthorizationStatusFeedback: savedStatus.feedback,
    isCheckingProviderAuthorization: savedStatus.isChecking,
    checkProviderAuthorizationStatus: savedStatus.check,
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

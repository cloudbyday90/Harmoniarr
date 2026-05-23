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

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchProviderStatus } from '../lib/provider-api.js';

export function useProviderStatus({
  fetchStatus = fetchProviderStatus,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const status = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isRevalidating = ref(false);

  let destroyed = false;
  let hasLoaded = false;
  let pollTimer = null;
  let visibilityHandler = null;

  const spotify = computed(() => status.value?.spotify ?? null);
  const youtube = computed(() => status.value?.youtube ?? null);
  const appleMusic = computed(() => status.value?.appleMusic ?? null);

  const spotifyLinked = computed(() => spotify.value?.linked === true);
  const youtubeLinked = computed(() => youtube.value?.linked === true);
  const appleMusicConfigured = computed(() => appleMusic.value?.configured === true);

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (pollIntervalMs <= 0 || destroyed) {
      return;
    }
    pollTimer = setTimeout(() => {
      if (!destroyed) {
        void revalidate();
      }
    }, pollIntervalMs);
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function attachVisibilityListener() {
    if (visibilityHandler) {
      return;
    }
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !destroyed) {
        void revalidate();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  async function loadStatus() {
    if (destroyed) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      status.value = await fetchStatus();
      if (destroyed) return;
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      errorMessage.value = getErrorMessage(error, 'Provider status failed');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    const isFirst = !hasLoaded;
    if (isFirst) {
      isLoading.value = true;
    } else {
      isRevalidating.value = true;
    }
    try {
      const result = await fetchStatus();
      if (destroyed) return;
      status.value = result;
      hasLoaded = true;
    } catch {
      if (destroyed) return;
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    appleMusic,
    appleMusicConfigured,
    attachVisibilityListener,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating,
    loadStatus,
    pollIntervalMs,
    revalidate,
    revalidateOnFocus,
    spotify,
    spotifyLinked,
    status,
    youtube,
    youtubeLinked,
  };
}

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
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchOperatorMonitoredArtistProjections } from '../lib/metadata-api.js';

export function useOperatorMonitoredArtists({
  limit = 50,
  fetchArtists = fetchOperatorMonitoredArtistProjections,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const artists = ref([]);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0 || destroyed || artists.value.length === 0) {
      return;
    }

    pollTimer = setTimeout(async () => {
      if (!destroyed) {
        await loadOperatorMonitoredArtists();
      }
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) {
      return;
    }

    void loadOperatorMonitoredArtists().then(() => {
      if (!destroyed) {
        schedulePoll();
      }
    });
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function loadOperatorMonitoredArtists() {
    if (destroyed) {
      return;
    }

    errorMessage.value = '';
    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      const payload = await fetchArtists({ limit });
      artists.value = Array.isArray(payload?.results) ? payload.results : [];
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        artists.value = [];
      }
      errorMessage.value = getErrorMessage(error, 'Could not load your monitored artist profile.');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    artists,
    attachVisibilityListener,
    destroy,
    errorMessage,
    isLoading: readonly(isLoading),
    isRevalidating: readonly(isRevalidating),
    loadOperatorMonitoredArtists,
  };
}

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
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchLibraryWantedReleases as defaultFetchLibraryWantedReleases } from '../lib/library-api.js';

export function useLibraryWantedReleases({
  fetchLibraryWantedReleases = defaultFetchLibraryWantedReleases,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const wantedReleasesResponse = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;
  let lastWantedStatus = null;

  const wantedReleases = computed(() => wantedReleasesResponse.value?.wantedReleases ?? []);
  const missingReleases = computed(() => wantedReleases.value.filter((r) => r.wantedStatus === 'missing'));
  const partialReleases = computed(() => wantedReleases.value.filter((r) => r.wantedStatus === 'partial'));
  const totalCount = computed(() => wantedReleasesResponse.value?.total ?? 0);

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
    if (!wantedReleasesResponse.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadWantedReleases({ wantedStatus: lastWantedStatus });
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadWantedReleases({ wantedStatus: lastWantedStatus }).then(() => {
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

  async function loadWantedReleases({ wantedStatus = null } = {}) {
    if (destroyed) return;
    lastWantedStatus = wantedStatus;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      wantedReleasesResponse.value = await fetchLibraryWantedReleases({ wantedStatus });
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        wantedReleasesResponse.value = null;
      }
      errorMessage.value = getErrorMessage(error, 'Wanted releases failed to load');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    attachVisibilityListener,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    loadWantedReleases,
    missingReleases,
    partialReleases,
    totalCount,
    wantedReleases,
  };
}

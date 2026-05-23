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
import { fetchLibraryReconciliationSummary as defaultFetchLibraryReconciliationSummary } from '../lib/library-api.js';

export function useLibraryReconciliationSummary({
  fetchLibraryReconciliationSummary = defaultFetchLibraryReconciliationSummary,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const libraryReconciliationSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const fileCounts = computed(() => libraryReconciliationSummary.value?.fileCounts ?? null);
  const releaseCounts = computed(() => libraryReconciliationSummary.value?.releaseCounts ?? null);
  const summary = computed(() => libraryReconciliationSummary.value?.summary ?? null);

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
    if (!libraryReconciliationSummary.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadLibraryReconciliationSummary();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadLibraryReconciliationSummary().then(() => {
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

  async function loadLibraryReconciliationSummary() {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      libraryReconciliationSummary.value = await fetchLibraryReconciliationSummary();
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        libraryReconciliationSummary.value = null;
      }
      errorMessage.value = getErrorMessage(error, 'Library reconciliation summary failed');
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
    fileCounts,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    libraryReconciliationSummary,
    loadLibraryReconciliationSummary,
    releaseCounts,
    summary,
  };
}

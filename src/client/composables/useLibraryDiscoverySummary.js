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
import {
  fetchLibraryDiscoverySummary as defaultFetchLibraryDiscoverySummary,
  startLibraryDiscoveryRun as defaultStartLibraryDiscoveryRun,
} from '../lib/library-api.js';
import { canStartDiscoveryDispatch } from '../lib/library-status-presentation.js';

export function useLibraryDiscoverySummary({
  fetchLibraryDiscoverySummary = defaultFetchLibraryDiscoverySummary,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
  startLibraryDiscoveryRun = defaultStartLibraryDiscoveryRun,
} = {}) {
  const discoverySummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  const isStartingDiscovery = ref(false);
  const startErrorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const heartbeat = computed(() => discoverySummary.value?.heartbeat ?? null);
  const latestRun = computed(() => discoverySummary.value?.latestRun ?? null);
  const requestCounts = computed(() => discoverySummary.value?.requestCounts ?? {
    blocked: 0,
    cooldown: 0,
    ready: 0,
    totalRequests: 0,
  });
  const summary = computed(() => discoverySummary.value?.summary ?? null);
  const canStartDiscovery = computed(() => (
    canStartDiscoveryDispatch(discoverySummary.value)
    && isStartingDiscovery.value !== true
  ));

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
    if (!discoverySummary.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadLibraryDiscoverySummary();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadLibraryDiscoverySummary().then(() => {
      if (!destroyed) schedulePoll();
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

  async function loadLibraryDiscoverySummary() {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      discoverySummary.value = await fetchLibraryDiscoverySummary();
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        discoverySummary.value = null;
      }
      errorMessage.value = getErrorMessage(error, 'Discovery dispatch summary failed to load');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function startDiscoveryDispatch() {
    if (destroyed || isStartingDiscovery.value || !canStartDiscoveryDispatch(discoverySummary.value)) {
      return null;
    }

    isStartingDiscovery.value = true;
    startErrorMessage.value = '';

    try {
      const result = await startLibraryDiscoveryRun();
      await loadLibraryDiscoverySummary();
      return result;
    } catch (error) {
      startErrorMessage.value = getErrorMessage(error, 'Discovery dispatch failed to start');
      return null;
    } finally {
      if (!destroyed) {
        isStartingDiscovery.value = false;
      }
    }
  }

  return {
    attachVisibilityListener,
    canStartDiscovery,
    destroy,
    discoverySummary,
    errorMessage,
    heartbeat,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    isStartingDiscovery: readonly(isStartingDiscovery),
    latestRun,
    loadLibraryDiscoverySummary,
    requestCounts,
    startDiscoveryDispatch,
    startErrorMessage,
    summary,
  };
}

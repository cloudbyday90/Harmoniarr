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
  fetchArtworkCleanupHistory as defaultFetchArtworkCleanupHistory,
  fetchArtworkCleanupRunDetail as defaultFetchArtworkCleanupRunDetail,
  fetchArtworkSummary as defaultFetchArtworkSummary,
  startArtworkCleanupRun as defaultStartArtworkCleanupRun,
} from '../lib/artwork-api.js';
import {
  isArtworkCleanupPollingStatus,
  resolveArtworkSelectedRunId,
} from '../lib/artwork-maintenance-status.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useArtworkSummary({
  fetchArtworkCleanupHistory = defaultFetchArtworkCleanupHistory,
  fetchArtworkCleanupRunDetail = defaultFetchArtworkCleanupRunDetail,
  fetchArtworkSummary = defaultFetchArtworkSummary,
  startArtworkCleanupRun = defaultStartArtworkCleanupRun,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  revalidateOnFocus = false,
} = {}) {
  const actionErrorMessage = ref('');
  const artworkCleanupHistory = ref(null);
  const artworkSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isLoadingRunDetail = ref(false);
  const isRevalidating = ref(false);
  const isStarting = ref(false);
  const runDetailErrorMessage = ref('');
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);

  let pollTimeout = null;
  let destroyed = false;
  let hasLoaded = false;

  const cleanup = computed(() => artworkSummary.value?.cleanup ?? null);
  const inventory = computed(() => artworkSummary.value?.inventory ?? null);
  const latestRun = computed(() => artworkSummary.value?.latestRun ?? null);
  const recentRuns = computed(() => artworkCleanupHistory.value?.runs ?? []);
  const selectedRun = computed(() => selectedRunDetail.value?.run ?? null);
  const summary = computed(() => artworkSummary.value?.summary ?? null);

  function clearPollTimeout() {
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = null;
    }
  }

  function schedulePolling() {
    clearPollTimeout();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!hasLoaded) return;

    const runToPoll = isArtworkCleanupPollingStatus(latestRun.value?.status)
      ? latestRun.value
      : selectedRun.value;

    if (!isArtworkCleanupPollingStatus(runToPoll?.status)) {
      return;
    }

    pollTimeout = setTimeout(() => {
      if (destroyed) return;
      void loadArtworkSummary({ preferredRunId: selectedRunId.value });
    }, pollIntervalMs);

    if (typeof pollTimeout?.unref === 'function') {
      pollTimeout.unref();
    }
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    const runToPoll = isArtworkCleanupPollingStatus(latestRun.value?.status)
      ? latestRun.value
      : selectedRun.value;
    if (!isArtworkCleanupPollingStatus(runToPoll?.status)) return;
    void revalidate().then(() => {
      if (!destroyed) schedulePolling();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimeout();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function loadSelectedRunDetail({ runId }) {
    selectedRunId.value = runId;

    if (!runId) {
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      schedulePolling();
      return;
    }

    isLoadingRunDetail.value = true;
    runDetailErrorMessage.value = '';

    try {
      selectedRunDetail.value = await fetchArtworkCleanupRunDetail(runId);
    } catch (error) {
      if (destroyed) return;
      selectedRunDetail.value = null;
      runDetailErrorMessage.value = getErrorMessage(error, 'Artwork cleanup run detail failed');
    } finally {
      isLoadingRunDetail.value = false;
      if (!destroyed) schedulePolling();
    }
  }

  async function loadArtworkSummary({ preferredRunId = selectedRunId.value } = {}) {
    if (destroyed) return;

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = '';

    try {
      const [nextSummary, nextHistory] = await Promise.all([
        fetchArtworkSummary(),
        fetchArtworkCleanupHistory({ limit: 5 }),
      ]);

      if (destroyed) return;

      artworkSummary.value = nextSummary;
      artworkCleanupHistory.value = nextHistory;
      hasLoaded = true;

      await loadSelectedRunDetail({
        runId: resolveArtworkSelectedRunId({
          latestRunId: nextSummary.latestRun?.id ?? null,
          preferredRunId,
          recentRuns: nextHistory.runs ?? [],
        }),
      });
    } catch (error) {
      if (destroyed) return;
      artworkCleanupHistory.value = null;
      artworkSummary.value = null;
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      selectedRunId.value = null;
      errorMessage.value = getErrorMessage(error, 'Artwork summary failed');
      clearPollTimeout();
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;

    try {
      const [nextSummary, nextHistory] = await Promise.all([
        fetchArtworkSummary(),
        fetchArtworkCleanupHistory({ limit: 5 }),
      ]);
      if (destroyed) return;
      artworkSummary.value = nextSummary;
      artworkCleanupHistory.value = nextHistory;
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePolling();
      }
    }
  }

  async function startArtworkCleanup() {
    actionErrorMessage.value = '';
    isStarting.value = true;

    try {
      await startArtworkCleanupRun();
      await loadArtworkSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Artwork cleanup start failed');
    } finally {
      isStarting.value = false;
    }
  }

  async function selectArtworkCleanupRun(runId) {
    await loadSelectedRunDetail({ runId });
  }

  return {
    actionErrorMessage,
    artworkCleanupHistory,
    artworkSummary,
    attachVisibilityListener,
    cleanup,
    destroy,
    errorMessage,
    inventory,
    isLoading,
    isLoadingRunDetail,
    isRevalidating: readonly(isRevalidating),
    isStarting,
    latestRun,
    loadArtworkSummary,
    recentRuns,
    revalidate,
    runDetailErrorMessage,
    selectArtworkCleanupRun,
    selectedRun,
    selectedRunDetail,
    selectedRunId,
    startArtworkCleanup,
    summary,
  };
}

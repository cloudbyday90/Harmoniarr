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

import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  fetchArtworkCleanupHistory as defaultFetchArtworkCleanupHistory,
  fetchArtworkCleanupRunDetail as defaultFetchArtworkCleanupRunDetail,
  fetchArtworkSummary as defaultFetchArtworkSummary,
  startArtworkCleanupRun as defaultStartArtworkCleanupRun,
} from '../lib/artwork-api.js';

const artworkRunPollIntervalMs = 5000;

function isPollingStatus(status) {
  return status === 'pending' || status === 'running';
}

function resolveSelectedRunId({ latestRunId, preferredRunId, recentRuns }) {
  if (preferredRunId) {
    return preferredRunId;
  }

  return latestRunId ?? recentRuns[0]?.id ?? null;
}

export function useArtworkSummary({
  fetchArtworkCleanupHistory = defaultFetchArtworkCleanupHistory,
  fetchArtworkCleanupRunDetail = defaultFetchArtworkCleanupRunDetail,
  fetchArtworkSummary = defaultFetchArtworkSummary,
  startArtworkCleanupRun = defaultStartArtworkCleanupRun,
} = {}) {
  const actionErrorMessage = ref('');
  const artworkCleanupHistory = ref(null);
  const artworkSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isLoadingRunDetail = ref(false);
  const isStarting = ref(false);
  const runDetailErrorMessage = ref('');
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);

  let pollTimeout = null;

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

    const runToPoll = isPollingStatus(latestRun.value?.status)
      ? latestRun.value
      : selectedRun.value;

    if (!isPollingStatus(runToPoll?.status)) {
      return;
    }

    pollTimeout = setTimeout(() => {
      void loadArtworkSummary({ preferredRunId: selectedRunId.value });
    }, artworkRunPollIntervalMs);

    if (typeof pollTimeout?.unref === 'function') {
      pollTimeout.unref();
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
      selectedRunDetail.value = null;
      runDetailErrorMessage.value = getErrorMessage(error, 'Artwork cleanup run detail failed');
    } finally {
      isLoadingRunDetail.value = false;
      schedulePolling();
    }
  }

  async function loadArtworkSummary({ preferredRunId = selectedRunId.value } = {}) {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const [nextSummary, nextHistory] = await Promise.all([
        fetchArtworkSummary(),
        fetchArtworkCleanupHistory({ limit: 5 }),
      ]);

      artworkSummary.value = nextSummary;
      artworkCleanupHistory.value = nextHistory;
      await loadSelectedRunDetail({
        runId: resolveSelectedRunId({
          latestRunId: nextSummary.latestRun?.id ?? null,
          preferredRunId,
          recentRuns: nextHistory.runs ?? [],
        }),
      });
    } catch (error) {
      artworkCleanupHistory.value = null;
      artworkSummary.value = null;
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      selectedRunId.value = null;
      errorMessage.value = getErrorMessage(error, 'Artwork summary failed');
      clearPollTimeout();
    } finally {
      isLoading.value = false;
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

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearPollTimeout();
    });
  }

  return {
    actionErrorMessage,
    artworkCleanupHistory,
    artworkSummary,
    cleanup,
    errorMessage,
    inventory,
    isLoading,
    isLoadingRunDetail,
    isStarting,
    latestRun,
    loadArtworkSummary,
    recentRuns,
    runDetailErrorMessage,
    selectArtworkCleanupRun,
    selectedRun,
    selectedRunDetail,
    selectedRunId,
    startArtworkCleanup,
    summary,
  };
}
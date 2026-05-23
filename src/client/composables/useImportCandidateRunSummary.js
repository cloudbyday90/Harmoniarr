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

const activeRunStatuses = new Set(['pending', 'running']);

function hasActiveRun(runSummaryValue) {
  const status = runSummaryValue?.activeRun?.status ?? runSummaryValue?.currentRun?.status;
  return activeRunStatuses.has(status);
}

export function useImportCandidateRunSummary({
  fetchRunDetail = null,
  fetchSummary = async () => ({}),
  loadErrorMessage,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
  secondaryAction = null,
  secondaryActionErrorMessage = 'Action failed',
  startRun = null,
  startRunErrorMessage = 'Start failed',
  summaryKey,
} = {}) {
  const actionErrorMessage = ref('');
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  const isSecondaryActionPending = ref(false);
  const isStarting = ref(false);
  const runDetailErrorMessage = ref('');
  const runSummary = ref(null);
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const activeRun = computed(() => runSummary.value?.activeRun ?? null);
  const currentRun = computed(() => selectedRunDetail.value?.run ?? runSummary.value?.currentRun ?? null);
  const latestRun = computed(() => runSummary.value?.latestRun ?? null);
  const recentRuns = computed(() => runSummary.value?.recentRuns ?? []);
  const summary = computed(() => runSummary.value?.summary ?? null);

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
    if (!hasActiveRun(runSummary.value)) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadRunSummary();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadRunSummary().then(() => {
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

  async function loadSelectedRunDetail({ runId }) {
    selectedRunId.value = runId;

    if (!runId || typeof fetchRunDetail !== 'function') {
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      return;
    }

    runDetailErrorMessage.value = '';

    try {
      selectedRunDetail.value = await fetchRunDetail(runId);
    } catch (error) {
      selectedRunDetail.value = null;
      runDetailErrorMessage.value = getErrorMessage(error, 'Run details failed');
    }
  }

  async function loadRunSummary({ preferredRunId = selectedRunId.value } = {}) {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      runSummary.value = (await fetchSummary())?.[summaryKey] ?? null;
      hasLoaded = true;
      if (preferredRunId && preferredRunId !== runSummary.value?.currentRun?.id) {
        await loadSelectedRunDetail({ runId: preferredRunId });
      } else {
        await loadSelectedRunDetail({ runId: null });
      }
    } catch (error) {
      if (!isRevalidation) {
        runSummary.value = null;
        selectedRunDetail.value = null;
        selectedRunId.value = null;
        runDetailErrorMessage.value = '';
      }
      errorMessage.value = getErrorMessage(error, loadErrorMessage);
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function startRunAction() {
    if (typeof startRun !== 'function') {
      return;
    }

    actionErrorMessage.value = '';
    isStarting.value = true;

    try {
      await startRun();
      await loadRunSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, startRunErrorMessage);
    } finally {
      isStarting.value = false;
    }
  }

  async function runSecondaryAction() {
    if (typeof secondaryAction !== 'function') {
      return;
    }

    actionErrorMessage.value = '';
    isSecondaryActionPending.value = true;

    try {
      await secondaryAction();
      await loadRunSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, secondaryActionErrorMessage);
    } finally {
      isSecondaryActionPending.value = false;
    }
  }

  return {
    actionErrorMessage,
    activeRun,
    attachVisibilityListener,
    currentRun,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    isSecondaryActionPending,
    isStarting,
    latestRun,
    recentRuns,
    loadSelectedRunDetail,
    loadRunSummary,
    runDetailErrorMessage,
    runSecondaryAction,
    runSummary,
    selectedRunDetail,
    selectedRunId,
    startRunAction,
    summary,
  };
}

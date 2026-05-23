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
  fetchOperationHistory as defaultFetchOperationHistory,
  fetchOperationRunDetail as defaultFetchOperationRunDetail,
  requestOperationRunCancellation as defaultRequestOperationRunCancellation,
  requestOperationRunRetry as defaultRequestOperationRunRetry,
} from '../lib/operations-api.js';

const DEFAULT_POLL_INTERVAL_MS = 15_000;

export function useOperationHistory({
  fetchOperationHistory = defaultFetchOperationHistory,
  fetchOperationRunDetail = defaultFetchOperationRunDetail,
  requestOperationRunCancellation = defaultRequestOperationRunCancellation,
  requestOperationRunRetry = defaultRequestOperationRunRetry,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  revalidateOnFocus = false,
} = {}) {
  const cancellationErrorMessage = ref('');
  const detailErrorMessage = ref('');
  const errorMessage = ref('');
  const historyPayload = ref(null);
  const isCancellingRun = ref(false);
  const isRetryingRun = ref(false);
  const isLoadingDetail = ref(false);
  const isLoadingHistory = ref(true);
  const isPollingActive = ref(false);
  const isRevalidating = ref(false);
  const lastRefreshedAt = ref(null);
  const retryErrorMessage = ref('');
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);

  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const runs = computed(() => historyPayload.value?.runs ?? []);

  const hasActiveRuns = computed(() =>
    runs.value.some((r) => r.status === 'pending' || r.status === 'running'),
  );

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
    if (!hasLoaded) return;
    if (!hasActiveRuns.value) {
      isPollingActive.value = false;
      return;
    }

    isPollingActive.value = true;
    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadOperationHistory({ preferredRunId: selectedRunId.value });
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    if (!hasActiveRuns.value) return;
    void loadOperationHistory({ preferredRunId: selectedRunId.value }).then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    isPollingActive.value = false;
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function mergeRunIntoHistory(run) {
    if (!run || !historyPayload.value?.runs) {
      return;
    }

    historyPayload.value = {
      ...historyPayload.value,
      runs: historyPayload.value.runs.map((entry) => (entry.id === run.id ? {
        ...entry,
        ...run,
      } : entry)),
    };
  }

  async function selectOperationRun({ runId }) {
    selectedRunId.value = runId;

    if (!runId) {
      cancellationErrorMessage.value = '';
      detailErrorMessage.value = '';
      retryErrorMessage.value = '';
      selectedRunDetail.value = null;
      return;
    }

    isLoadingDetail.value = true;
    detailErrorMessage.value = '';

    try {
      selectedRunDetail.value = (await fetchOperationRunDetail(runId)).operationRun ?? null;
    } catch (error) {
      selectedRunDetail.value = null;
      detailErrorMessage.value = getErrorMessage(error, 'Operation run detail failed');
    } finally {
      isLoadingDetail.value = false;
    }
  }

  async function loadOperationHistory({ preferredRunId = selectedRunId.value } = {}) {
    if (destroyed) return;

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoadingHistory.value = true;
    }
    cancellationErrorMessage.value = '';
    errorMessage.value = '';
    retryErrorMessage.value = '';

    try {
      historyPayload.value = await fetchOperationHistory();
      lastRefreshedAt.value = new Date().toISOString();
      const nextRunId = preferredRunId || runs.value[0]?.id || null;
      await selectOperationRun({ runId: nextRunId });
      hasLoaded = true;
      schedulePoll();
    } catch (error) {
      historyPayload.value = null;
      selectedRunDetail.value = null;
      selectedRunId.value = null;
      detailErrorMessage.value = '';
      errorMessage.value = getErrorMessage(error, 'Operation history failed');
    } finally {
      if (!destroyed) {
        isLoadingHistory.value = false;
        isRevalidating.value = false;
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;

    try {
      const payload = await fetchOperationHistory();
      if (destroyed) return;
      historyPayload.value = payload;
      lastRefreshedAt.value = new Date().toISOString();
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function requestCancellation({ runId }) {
    if (!runId) {
      return;
    }

    isCancellingRun.value = true;
    cancellationErrorMessage.value = '';

    try {
      const operationRun = (await requestOperationRunCancellation(runId)).operationRun ?? null;

      if (operationRun) {
        mergeRunIntoHistory(operationRun);

        if (selectedRunId.value === operationRun.id && selectedRunDetail.value?.run) {
          selectedRunDetail.value = {
            ...selectedRunDetail.value,
            run: {
              ...selectedRunDetail.value.run,
              ...operationRun,
            },
          };
        }

        await selectOperationRun({ runId: operationRun.id });
        schedulePoll();
      }
    } catch (error) {
      cancellationErrorMessage.value = getErrorMessage(error, 'Operation cancellation failed');
    } finally {
      isCancellingRun.value = false;
    }
  }

  async function requestRetry({ runId }) {
    if (!runId) {
      return;
    }

    isRetryingRun.value = true;
    retryErrorMessage.value = '';

    try {
      const operationRun = (await requestOperationRunRetry(runId)).operationRun ?? null;

      if (operationRun) {
        mergeRunIntoHistory(operationRun);

        if (selectedRunId.value === operationRun.id && selectedRunDetail.value?.run) {
          selectedRunDetail.value = {
            ...selectedRunDetail.value,
            run: {
              ...selectedRunDetail.value.run,
              ...operationRun,
            },
          };
        }

        await selectOperationRun({ runId: operationRun.id });
        schedulePoll();
      }
    } catch (error) {
      retryErrorMessage.value = getErrorMessage(error, 'Operation retry failed');
    } finally {
      isRetryingRun.value = false;
    }
  }

  return {
    attachVisibilityListener,
    cancellationErrorMessage,
    destroy,
    detailErrorMessage,
    errorMessage,
    hasActiveRuns,
    historyPayload,
    isCancellingRun,
    isLoadingDetail,
    isLoadingHistory,
    isPollingActive: readonly(isPollingActive),
    isRevalidating: readonly(isRevalidating),
    isRetryingRun,
    lastRefreshedAt,
    loadOperationHistory,
    requestCancellation,
    requestRetry,
    revalidate,
    retryErrorMessage,
    runs,
    selectedRunDetail,
    selectedRunId,
    selectOperationRun,
  };
}

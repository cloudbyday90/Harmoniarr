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
import { fetchLibraryScanRunDetail as defaultFetchLibraryScanRunDetail } from '../lib/library-api.js';
import { startLibraryScanRun as defaultStartLibraryScanRun } from '../lib/library-api.js';
import { fetchLibraryScanSummary as defaultFetchLibraryScanSummary } from '../lib/system-api.js';

export function useLibraryScanSummary({
  fetchLibraryScanRunDetail = defaultFetchLibraryScanRunDetail,
  fetchLibraryScanSummary = defaultFetchLibraryScanSummary,
  startLibraryScanRun = defaultStartLibraryScanRun,
} = {}) {
  const actionErrorMessage = ref('');
  const libraryScanSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isStarting = ref(false);
  const runDetailErrorMessage = ref('');
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);

  const currentRun = computed(() => selectedRunDetail.value?.run ?? libraryScanSummary.value?.latestRun ?? null);
  const latestRun = computed(() => libraryScanSummary.value?.latestRun ?? null);
  const nextAction = computed(() => libraryScanSummary.value?.nextAction ?? null);
  const readiness = computed(() => libraryScanSummary.value?.readiness ?? null);
  const summary = computed(() => libraryScanSummary.value?.summary ?? null);

  async function loadSelectedLibraryScanRun({ runId }) {
    selectedRunId.value = runId;

    if (!runId) {
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      return;
    }

    runDetailErrorMessage.value = '';

    try {
      selectedRunDetail.value = (await fetchLibraryScanRunDetail(runId)).libraryScanRun ?? null;
    } catch (error) {
      selectedRunDetail.value = null;
      runDetailErrorMessage.value = getErrorMessage(error, 'Library scan run details failed');
    }
  }

  async function loadLibraryScanSummary({ preferredRunId = selectedRunId.value } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      libraryScanSummary.value = await fetchLibraryScanSummary();

      if (preferredRunId && preferredRunId !== libraryScanSummary.value?.latestRun?.id) {
        await loadSelectedLibraryScanRun({ runId: preferredRunId });
      } else {
        await loadSelectedLibraryScanRun({ runId: null });
      }
    } catch (error) {
      libraryScanSummary.value = null;
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      selectedRunId.value = null;
      errorMessage.value = getErrorMessage(error, 'Library scan summary failed');
    } finally {
      isLoading.value = false;
    }
  }

  async function startLibraryScan() {
    actionErrorMessage.value = '';
    isStarting.value = true;

    try {
      await startLibraryScanRun();
      await loadLibraryScanSummary({ preferredRunId: null });
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Library scan start failed');
    } finally {
      isStarting.value = false;
    }
  }

  return {
    actionErrorMessage,
    currentRun,
    errorMessage,
    isLoading,
    isStarting,
    latestRun,
    libraryScanSummary,
    loadSelectedLibraryScanRun,
    loadLibraryScanSummary,
    nextAction,
    readiness,
    runDetailErrorMessage,
    selectedRunDetail,
    selectedRunId,
    summary,
    startLibraryScan,
  };
}
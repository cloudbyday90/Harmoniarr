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
import {
  fetchLibraryDiscoveryRunDetail as defaultFetchLibraryDiscoveryRunDetail,
  fetchLibraryDiscoverySummary as defaultFetchLibraryDiscoverySummary,
  startLibraryDiscoveryRun as defaultStartLibraryDiscoveryRun,
} from '../lib/library-api.js';

export function useLibraryDiscoverySummary({
  fetchLibraryDiscoveryRunDetail = defaultFetchLibraryDiscoveryRunDetail,
  fetchLibraryDiscoverySummary = defaultFetchLibraryDiscoverySummary,
  startLibraryDiscoveryRun = defaultStartLibraryDiscoveryRun,
} = {}) {
  const actionErrorMessage = ref('');
  const libraryDiscoverySummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isStarting = ref(false);
  const runDetailErrorMessage = ref('');
  const selectedRunDetail = ref(null);
  const selectedRunId = ref(null);

  const currentRun = computed(() => selectedRunDetail.value?.run ?? libraryDiscoverySummary.value?.latestRun ?? null);
  const latestRun = computed(() => libraryDiscoverySummary.value?.latestRun ?? null);
  const requestCounts = computed(() => libraryDiscoverySummary.value?.requestCounts ?? null);
  const summary = computed(() => libraryDiscoverySummary.value?.summary ?? null);

  async function loadSelectedLibraryDiscoveryRun({ runId }) {
    selectedRunId.value = runId;

    if (!runId) {
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      return;
    }

    runDetailErrorMessage.value = '';

    try {
      selectedRunDetail.value = (await fetchLibraryDiscoveryRunDetail(runId)).libraryDiscoveryRun ?? null;
    } catch (error) {
      selectedRunDetail.value = null;
      runDetailErrorMessage.value = getErrorMessage(error, 'Library discovery run details failed');
    }
  }

  async function loadLibraryDiscoverySummary({ preferredRunId = selectedRunId.value } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      libraryDiscoverySummary.value = await fetchLibraryDiscoverySummary();

      if (preferredRunId && preferredRunId !== libraryDiscoverySummary.value?.latestRun?.id) {
        await loadSelectedLibraryDiscoveryRun({ runId: preferredRunId });
      } else {
        await loadSelectedLibraryDiscoveryRun({ runId: null });
      }
    } catch (error) {
      libraryDiscoverySummary.value = null;
      runDetailErrorMessage.value = '';
      selectedRunDetail.value = null;
      selectedRunId.value = null;
      errorMessage.value = getErrorMessage(error, 'Library discovery summary failed');
    } finally {
      isLoading.value = false;
    }
  }

  async function startDiscoveryRun() {
    actionErrorMessage.value = '';
    isStarting.value = true;

    try {
      await startLibraryDiscoveryRun();
      await loadLibraryDiscoverySummary({ preferredRunId: null });
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Library discovery dispatch failed');
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
    libraryDiscoverySummary,
    loadSelectedLibraryDiscoveryRun,
    loadLibraryDiscoverySummary,
    requestCounts,
    runDetailErrorMessage,
    selectedRunDetail,
    selectedRunId,
    startDiscoveryRun,
    summary,
  };
}
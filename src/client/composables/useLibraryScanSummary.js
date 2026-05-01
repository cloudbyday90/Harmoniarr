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
import { startLibraryScanRun as defaultStartLibraryScanRun } from '../lib/library-api.js';
import { fetchLibraryScanSummary as defaultFetchLibraryScanSummary } from '../lib/system-api.js';

export function useLibraryScanSummary({
  fetchLibraryScanSummary = defaultFetchLibraryScanSummary,
  startLibraryScanRun = defaultStartLibraryScanRun,
} = {}) {
  const actionErrorMessage = ref('');
  const libraryScanSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isStarting = ref(false);

  const latestRun = computed(() => libraryScanSummary.value?.latestRun ?? null);
  const nextAction = computed(() => libraryScanSummary.value?.nextAction ?? null);
  const readiness = computed(() => libraryScanSummary.value?.readiness ?? null);
  const summary = computed(() => libraryScanSummary.value?.summary ?? null);

  async function loadLibraryScanSummary() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      libraryScanSummary.value = await fetchLibraryScanSummary();
    } catch (error) {
      libraryScanSummary.value = null;
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
      await loadLibraryScanSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Library scan start failed');
    } finally {
      isStarting.value = false;
    }
  }

  return {
    actionErrorMessage,
    errorMessage,
    isLoading,
    isStarting,
    latestRun,
    libraryScanSummary,
    loadLibraryScanSummary,
    nextAction,
    readiness,
    summary,
    startLibraryScan,
  };
}
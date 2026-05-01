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
  fetchLibraryDiscoverySummary as defaultFetchLibraryDiscoverySummary,
  startLibraryDiscoveryRun as defaultStartLibraryDiscoveryRun,
} from '../lib/library-api.js';

export function useLibraryDiscoverySummary({
  fetchLibraryDiscoverySummary = defaultFetchLibraryDiscoverySummary,
  startLibraryDiscoveryRun = defaultStartLibraryDiscoveryRun,
} = {}) {
  const actionErrorMessage = ref('');
  const libraryDiscoverySummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isStarting = ref(false);

  const latestRun = computed(() => libraryDiscoverySummary.value?.latestRun ?? null);
  const requestCounts = computed(() => libraryDiscoverySummary.value?.requestCounts ?? null);
  const summary = computed(() => libraryDiscoverySummary.value?.summary ?? null);

  async function loadLibraryDiscoverySummary() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      libraryDiscoverySummary.value = await fetchLibraryDiscoverySummary();
    } catch (error) {
      libraryDiscoverySummary.value = null;
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
      await loadLibraryDiscoverySummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Library discovery dispatch failed');
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
    libraryDiscoverySummary,
    loadLibraryDiscoverySummary,
    requestCounts,
    startDiscoveryRun,
    summary,
  };
}